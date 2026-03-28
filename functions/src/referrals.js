const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();
const REWARD_AMOUNT = 37;
const EXPIRY_DAYS = 30;

/**
 * Stage 2: First order placed → referral: pending → processing
 * Trigger: orders/{orderId} onCreate
 */
exports.onOrderCreated = functions.firestore
  .document('orders/{orderId}')
  .onCreate(async (snap, context) => {
    const order = snap.data();
    if (!order || !order.userId) return null;

    const userId = order.userId;
    const orderId = context.params.orderId;

    // Check how many orders this user has total
    const ordersSnap = await db.collection('orders')
      .where('userId', '==', userId)
      .get();

    const orderCount = ordersSnap.size;
    if (orderCount !== 1) return null; // Only trigger on first order

    // Find a referral doc where this user is the referee and status is pending
    const refSnap = await db.collection('referrals')
      .where('refereeId', '==', userId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (refSnap.empty) return null;

    const refDoc = refSnap.docs[0];
    await refDoc.ref.update({
      status: 'processing',
      firstOrderId: orderId,
      firstOrderPlacedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Referral ${refDoc.id}: pending → processing (first order: ${orderId})`);
    return null;
  });

/**
 * Stage 3: First order delivered → atomic batch reward
 * Trigger: orders/{orderId} onUpdate where status → 'delivered'
 */
exports.onOrderDelivered = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const wasDelivered = before.status !== 'delivered' && after.status === 'delivered';
    if (!wasDelivered || !after.userId) return null;

    const userId = after.userId;
    const orderId = context.params.orderId;

    // Find referral doc for this user that is in 'processing' with this orderId
    const refSnap = await db.collection('referrals')
      .where('refereeId', '==', userId)
      .where('status', '==', 'processing')
      .where('firstOrderId', '==', orderId)
      .limit(1)
      .get();

    if (refSnap.empty) return null;

    const refDoc = refSnap.docs[0];
    const referral = refDoc.data();
    const referrerId = referral.referrerId;
    const refereeName = referral.refereeName || 'Friend';
    const rewardAmount = referral.rewardAmount || REWARD_AMOUNT;

    // Find referrer user document
    const referrerSnap = await db.collection('users')
      .where('customerId', '==', referrerId)
      .limit(1)
      .get();

    if (referrerSnap.empty) {
      console.error(`Referrer ${referrerId} not found`);
      return null;
    }

    const referrerDoc = referrerSnap.docs[0];
    const txnRef = db.collection('transactions').doc();

    // ATOMIC BATCH — all 3 or none
    const batch = db.batch();

    // 1. Mark referral as rewarded
    batch.update(refDoc.ref, {
      status: 'rewarded',
      deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
      creditedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 2. Credit wallet to referrer
    batch.update(referrerDoc.ref, {
      wallet_balance: admin.firestore.FieldValue.increment(rewardAmount),
    });

    // 3. Log transaction
    batch.set(txnRef, {
      userId: referrerId,
      type: 'credit',
      category: 'referral',
      amount: rewardAmount,
      note: `Referral reward: ${refereeName} first order delivered`,
      referralId: refDoc.id,
      refereeId: userId,
      orderId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    console.log(`Referral ${refDoc.id}: rewarded. ₹${rewardAmount} credited to ${referrerId}`);
    return null;
  });

/**
 * Edge case: First order cancelled → snap back processing → pending
 * Trigger: orders/{orderId} onUpdate where status → 'cancelled'
 */
exports.onOrderStatusChange = functions.firestore
  .document('orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const wasCancelled = after.status === 'cancelled' && before.status !== 'delivered';
    if (!wasCancelled || !after.userId) return null;

    const userId = after.userId;
    const orderId = context.params.orderId;

    // Find referral doc in processing with this order
    const refSnap = await db.collection('referrals')
      .where('refereeId', '==', userId)
      .where('status', '==', 'processing')
      .where('firstOrderId', '==', orderId)
      .limit(1)
      .get();

    if (refSnap.empty) return null;

    // Snap back to pending
    await refSnap.docs[0].ref.update({
      status: 'pending',
      firstOrderId: null,
      firstOrderPlacedAt: null,
    });

    console.log(`Referral ${refSnap.docs[0].id}: processing → pending (order cancelled)`);
    return null;
  });

/**
 * Expiry: Daily job — flip pending referrals older than 30 days to 'expired'
 * Schedule: every 24 hours
 */
exports.dailyReferralExpiry = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - EXPIRY_DAYS);

    const expiredSnap = await db.collection('referrals')
      .where('status', '==', 'pending')
      .where('downloadedAt', '<', cutoff)
      .get();

    if (expiredSnap.empty) {
      console.log('No referrals to expire today.');
      return null;
    }

    const batch = db.batch();
    expiredSnap.docs.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'expired',
        expiredAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log(`Expired ${expiredSnap.size} stale referrals.`);
    return null;
  });

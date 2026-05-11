const functions = require('firebase-functions/v1');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const slack = require('./slack-notify');

/**
 * Helper: Lazy load Razorpay
 */
function getRazorpay() {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || functions.config().razorpay?.key_id || 'YOUR_KEY_ID',
    key_secret: process.env.RAZORPAY_KEY_SECRET || functions.config().razorpay?.key_secret || 'YOUR_KEY_SECRET'
  });
}

// Helper: Secure Notification Engine
async function sendNotification(userId, type, data) {
  const db = admin.firestore();
  console.log(`[Notification] User: ${userId}, Type: ${type}, Data:`, data);
  
  // Store in notifications collection for beta auditing
  await db.collection('notifications').add({
    userId,
    type,
    data,
    status: 'pending',
    createdAt: admin.firestore.Timestamp.now()
  });

  // TODO: Integrate with Fast2SMS / WhatsApp API when credentials are set
}

// initialization moved inside functions

const PRO_PLANS = {
  lite: { fee: 15, maxJars: 10, pricePerJar: 37 },
  pro: { fee: 35, maxJars: 25, pricePerJar: 37 },
  proMax: { fee: 55, maxJars: 999999, pricePerJar: 37 }
};

// Users created before this date are automatically considered "Legacy" (Standard Deposit Model)
// Date: April 14, 2026 (Launch Date)
const PRO_LAUNCH_DATE = new Date('2026-04-14T00:00:00Z');

// Helper: Generate Sequential Customer ID (matches Android App logic but with transaction safety)
async function generateSequentialCustomerId() {
  const db = admin.firestore();
  const counterRef = db.collection('counters').doc('customers');
  
  return await db.runTransaction(async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    let nextNumber = 1001;
    
    if (counterSnap.exists()) {
      nextNumber = counterSnap.data().lastNumber + 1;
      transaction.update(counterRef, { lastNumber: nextNumber });
    } else {
      transaction.set(counterRef, { lastNumber: nextNumber });
    }
    
    return `HYDRA-${nextNumber}`;
  });
}

// 1. Hook for new users: 3-day Pro Max Trial with Phone Strict Check (v1)
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
  const db = admin.firestore();
  const { uid, phoneNumber, displayName, email } = user;
  
  if (!phoneNumber) {
    console.log(`User ${uid} created without phone number. Skipping trial.`);
    return;
  }

  // Check if this phone number was ever used before (Trial Abuse Prevention)
  const existingUsers = await db.collection('users')
    .where('phone', '==', phoneNumber)
    .limit(1)
    .get();

  const isNewPhone = existingUsers.empty;
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 3);

  // Generate Sequential Customer ID (HYDRA-1001, 1002...)
  const customerId = await generateSequentialCustomerId();

  // Initialize basic user info (Aligned with Android App snake_case schema)
  await db.collection('users').doc(uid).set({
    customerId,
    full_name: displayName || '',
    name: displayName || '', // Legacy support
    phone: phoneNumber,
    phoneNumber: phoneNumber, // Legacy support
    email: email || '',
    isLegacy: false,
    wallet_balance: 0,
    walletBalance: 0, // Legacy support
    jars_occupied: 0,
    createdAt: admin.firestore.Timestamp.now()
  }, { merge: true });

  // Initialize separate Pro Membership document
  await db.collection('pro_memberships').doc(uid).set({
    userId: uid,
    proTrialStart: isNewPhone ? admin.firestore.Timestamp.now() : null,
    proTrialEnd: isNewPhone ? admin.firestore.Timestamp.fromDate(trialEnd) : null,
    proStatus: isNewPhone ? 'trial' : 'expired',
    proPlanId: null,
    proPeriodEnd: null,
    proJarsUsedThisMonth: 0,
    updatedAt: admin.firestore.Timestamp.now()
  });

  // 📢 Notify Slack: New User Joined
  await slack.notifyUserSignup({ 
    customerId: customerId, 
    phone: phoneNumber, 
    isLegacy: false 
  });

  console.log(`User ${uid} initialized with ID ${customerId}. Pro Status: ${isNewPhone ? 'trial' : 'expired'}`);
});

// 1.1 Helper: Sync User Details from Auth to Firestore (Gen 2)
exports.syncUserAuthDetails = onCall({ region: 'us-central1' }, async (request) => {
  const db = admin.firestore();
  if (!request.auth) throw new HttpsError('unauthenticated', 'Unauthorized');
  
  const { userId } = request.data;
  if (!userId) throw new HttpsError('invalid-argument', 'userId is required');

  try {
    const userAuth = await admin.auth().getUser(userId);
    const { displayName, email, phoneNumber } = userAuth;

    const updateData = {
      updatedAt: admin.firestore.Timestamp.now()
    };

    if (displayName) {
      updateData.full_name = displayName;
      updateData.name = displayName; // Legacy support
    }
    if (email) {
      updateData.email = email;
    }
    if (phoneNumber) {
      updateData.phone = phoneNumber;
      updateData.phoneNumber = phoneNumber; // Legacy support
    }

    await db.collection('users').doc(userId).update(updateData);
    
    return { 
      success: true, 
      synced: { displayName, email, phoneNumber } 
    };
  } catch (error) {
    console.error('Error syncing user details:', error);
    throw new HttpsError('internal', 'Sync failed');
  }
});

// 2. Core Ordering logic applying Pro Model constraints (Gen 2)
exports.placeOrder = onCall({ region: 'us-central1' }, async (request) => {
  const db = admin.firestore();
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const uid = request.auth.uid;
  const { qty, paymentMethod, slot } = request.data;
  
  const userDoc = await db.collection('users').doc(uid).get();
  const user = userDoc.data();
  if (!user) throw new HttpsError('not-found', 'User not found');

  // Boundary Logic: existing users order smoothly as usual
  const userCreatedAt = user.createdAt?.toDate() || new Date(0);
  const isAutoLegacy = userCreatedAt < PRO_LAUNCH_DATE;

  if (user.isLegacy || isAutoLegacy) {
    // Legacy users fallback to standard ₹37 / Jar logic unconditionally
    return handleLegacyOrder(uid, qty, paymentMethod, user);
  }

  const now = admin.firestore.Timestamp.now();
  let pricePerJar = 37;
  let maxJars = null;
  let planId = null;
  let overageAmount = 0;

  // Lookup Pro Membership state from the dedicated collection (Phase 3)
  const membershipDoc = await db.collection('pro_memberships').doc(uid).get();
  const membership = membershipDoc.data();

  if (!membership) {
    throw new HttpsError('failed-precondition', 'Pro membership profile missing. New users must have a valid membership doc.');
  }

  if (membership.proStatus === 'trial' && membership.proTrialEnd > now) {
    // Free Trial allows max 1 Jar total
    pricePerJar = PRO_PLANS.proMax.pricePerJar;
    maxJars = PRO_PLANS.proMax.maxJars;
    planId = 'proMax';
    if (qty > 1) {
      throw new HttpsError('invalid-argument', 'Trial allows only 1 jar per order. Please select a plan for more.');
    }
  }
  else if (membership.proStatus === 'active' && membership.proPeriodEnd > now) {
    const plan = PRO_PLANS[membership.proPlanId];
    if (!plan) throw new HttpsError('not-found', 'Plan not found');
    pricePerJar = plan.pricePerJar;
    maxJars = plan.maxJars;
    planId = membership.proPlanId;
    
    // Check for Overdue Jars (7+ days) before processing order
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const overdueJars = await db.collection('jars')
      .where('currentUserId', '==', uid)
      .where('assignedAt', '<', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
      .limit(1)
      .get();

    if (!overdueJars.empty) {
      throw new HttpsError('failed-precondition', 'ORDER_BLOCKED: You have at least one unreturned jar for over 7 days. Please return it or pay the ₹165 penalty to continue.');
    }

    const currentUsage = membership.proJarsUsedThisMonth || 0;
    const totalPotentialUsage = currentUsage + qty;
    
    // Overage Fee Logic (₹40 per extra jar) - Recommended for Beta
    let overageAmount = 0;
    if (totalPotentialUsage > maxJars) {
      const overageQty = Math.min(qty, totalPotentialUsage - maxJars);
      overageAmount = overageQty * 40;
      console.log(`User ${uid} overage detected: ${overageQty} jars. Fee: ₹${overageAmount}`);
    }
  }
  else {
    throw new HttpsError('failed-precondition', 'ORDER_BLOCKED: Your free 3-day trial has expired. To continue ordering fresh water, please select a Pro Subscription plan in the app.');
  }
 
  const amount = (qty * pricePerJar) + (overageAmount || 0);
  if (user.walletBalance < amount && paymentMethod !== 'cash') {
    throw new HttpsError('resource-exhausted', `Insufficient wallet balance. Total: ₹${amount} (includes ₹${overageAmount || 0} overage)`);
  }

  if (paymentMethod !== 'cash') {
    await db.collection('users').doc(uid).update({
      walletBalance: FieldValue.increment(-amount)
    });
  }

  const orderRef = await db.collection('orders').add({
    userId: uid,
    qty,
    delivered: 0,
    returned: 0,
    holdJars: 0,
    amount,
    paymentMethod,
    status: 'pending',
    createdAt: now,
    planId,
    deliverySlot: slot || 'ASAP'
  });

  if (!user.isLegacy) {
    await db.collection('pro_memberships').doc(uid).update({
      proJarsUsedThisMonth: FieldValue.increment(qty)
    });
  }

  // 📢 Notify Slack: New Order Created
  try {
    await slack.notifyOrderUpdate(
      { id: orderRef.id, qty, amount, paymentMethod, deliverySlot: slot || 'ASAP' },
      { customerId: user.customerId || 'N/A', phone: user.phone || 'N/A', walletBalance: (user.walletBalance || 0) - (paymentMethod !== 'cash' ? amount : 0) }
    );
  } catch (error) {
    console.warn('Slack notify failed in placeOrder:', error);
  }

  return { success: true, orderId: orderRef.id, amount };
});

async function handleLegacyOrder(uid, qty, paymentMethod, user) {
  const db = admin.firestore();
  const amount = qty * 37;
  if (user.walletBalance < amount && paymentMethod !== 'cash') {
    throw new functions.https.HttpsError('resource-exhausted', 'Insufficient wallet balance');
  }

  if (paymentMethod !== 'cash') {
    await db.collection('users').doc(uid).update({
      walletBalance: FieldValue.increment(-amount)
    });
  }

  const orderRef = await db.collection('orders').add({
    userId: uid,
    qty,
    delivered: 0,
    returned: 0,
    holdJars: 0,
    amount,
    paymentMethod,
    status: 'pending',
    createdAt: admin.firestore.Timestamp.now(),
    planId: 'legacy'
  });

  return { success: true, orderId: orderRef.id, amount };
}

// 3. Assign Jar functionality (Gen 2)
exports.assignJar = onCall({ region: 'us-central1' }, async (request) => {
  const db = admin.firestore();
  if (!request.auth) throw new HttpsError('unauthenticated', 'Unauthorized');
  const { jarId, userId, orderId } = request.data;
  const jarRef = db.collection('jars').doc(jarId);
  
  await db.runTransaction(async (transaction) => {
    const jar = await transaction.get(jarRef);
    if (!jar.exists) throw new HttpsError('not-found', 'Jar not found');
    if (jar.data().status !== 'available') throw new HttpsError('failed-precondition', 'Jar not available');
    
    transaction.update(jarRef, {
      currentUserId: userId,
      assignedAt: admin.firestore.Timestamp.now(),
      status: 'assigned',
      lastOrderId: orderId
    });
    
    if (orderId) {
      const orderRef = db.collection('orders').doc(orderId);
      transaction.update(orderRef, { jarId });
    }
  });

  return { success: true };
});

// 4. Return Jar functionality (Gen 2)
exports.returnJar = onCall({ region: 'us-central1' }, async (request) => {
  const db = admin.firestore();
  if (!request.auth) throw new HttpsError('unauthenticated', 'Unauthorized');
  const { jarId } = request.data;
  const jarRef = db.collection('jars').doc(jarId);
  const jar = await jarRef.get();
  if (!jar.exists) throw new HttpsError('not-found', 'Jar not found');
  
  await jarRef.update({
    currentUserId: null,
    returnedAt: admin.firestore.Timestamp.now(),
    status: 'available'
  });
  
  return { success: true };
});

// 5. CRON - Expire Trials (Gen 2)
exports.expireTrials = onSchedule({ schedule: '0 1 * * *', region: 'us-central1' }, async (event) => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const trialMemberships = await db.collection('pro_memberships')
    .where('proStatus', '==', 'trial')
    .where('proTrialEnd', '<', now)
    .get();
    
  const batch = db.batch();
  for (const membershipDoc of trialMemberships.docs) {
    const userId = membershipDoc.id;
    batch.update(membershipDoc.ref, { proStatus: 'expired' });
    
    // Create "Collect Jar" tasks for delivery fleet
    // Find all jars currently assigned to this user
    const jarsToCollect = await db.collection('jars')
      .where('currentUserId', '==', userId)
      .where('status', '==', 'assigned')
      .get();
      
    jarsToCollect.forEach(jarDoc => {
      const taskRef = db.collection('tasks').doc();
      batch.set(taskRef, {
        type: 'collect_jar',
        userId: userId,
        jarId: jarDoc.id,
        status: 'pending',
        assignedTo: null,
        createdAt: now,
        priority: 'high'
      });
    });

    await sendNotification(userId, 'TRIAL_EXPIRED', { message: 'Your trial has ended. Please subscribe to keep your jars or a collection task will be generated.' });
  }

  await batch.commit();
  console.log(`Expired ${trialMemberships.size} trial memberships and created collection tasks.`);
});

// 6. CRON - Reset Monthly Limits (Gen 2)
exports.resetMonthlyJars = onSchedule({ schedule: '0 0 1 * *', region: 'us-central1' }, async (event) => {
  const db = admin.firestore();
  const activeMemberships = await db.collection('pro_memberships')
    .where('proStatus', '==', 'active')
    .get();
    
  const batch = db.batch();
  activeMemberships.forEach(doc => batch.update(doc.ref, { proJarsUsedThisMonth: 0 }));
  await batch.commit();
  console.log(`Reset counters for ${activeMemberships.size} memberships`);
});

// 7. Enroll user in Pro Plan (Gen 2)
exports.enrollPro = onCall({ region: 'us-central1' }, async (request) => {
  const razorpay = getRazorpay();
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const { planId } = request.data;
  const uid = request.auth.uid;
  const plan = PRO_PLANS[planId];
  if (!plan) throw new HttpsError('invalid-argument', 'Invalid plan');
  
  try {
    // Generate Razorpay Subscription (Backend-driven)
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId === 'lite' ? 'plan_LITE_ID' : planId === 'pro' ? 'plan_PRO_ID' : 'plan_PROMAX_ID', // Replace with actual Razorpay Plan IDs
      customer_notify: 1,
      total_count: 12, // example: for 1 year
      addons: [],
      notes: {
        userId: uid,
        planId: planId
      }
    });

    return { 
      success: true, 
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url 
    };
  } catch (error) {
    console.error('Razorpay Subscription Error:', error);
    throw new HttpsError('internal', 'Could not create subscription');
  }
});

// 7.1 Admin Manual Enrollment Override (Gen 2)
exports.adminManualEnrollPro = onCall({ region: 'us-central1' }, async (request) => {
  const db = admin.firestore();
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  
  // Optionally check if requester is an admin
  // const adminSnap = await db.collection('admins').doc(request.auth.uid).get();
  // if (!adminSnap.exists) throw new HttpsError('permission-denied', 'Admin access required');

  const { targetUserId, planId } = request.data;
  if (!targetUserId || !planId) throw new HttpsError('invalid-argument', 'Missing targetUserId or planId');
  if (!PRO_PLANS[planId]) throw new HttpsError('invalid-argument', 'Invalid planId');

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db.collection('pro_memberships').doc(targetUserId).update({
    proPlanId: planId,
    proStatus: 'active',
    proPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
    proJarsUsedThisMonth: 0,
    proTrialEnd: null,
    updatedAt: admin.firestore.Timestamp.now(),
    manualEnrollment: true,
    enrolledBy: request.auth.uid
  });

  await sendNotification(targetUserId, 'PLAN_ACTIVATED_MANUAL', { planId, periodEnd });

  return { success: true, message: `User ${targetUserId} manually enrolled in ${planId}` };
});

// 8. Razorpay Webhook Handler (Gen 2)
exports.razorpayWebhook = onRequest({ region: 'us-central1' }, async (req, res) => {
  const db = admin.firestore();
  const secret = functions.config().razorpay?.webhook_secret || 'YOUR_WEBHOOK_SECRET';
  const signature = req.headers['x-razorpay-signature'];

  const shasum = crypto.createHmac('sha256', secret);
  shasum.update(JSON.stringify(req.body));
  const digest = shasum.digest('hex');

  if (signature !== digest) {
    console.error('Invalid Razorpay Signature');
    return res.status(403).send('Invalid signature');
  }

  const event = req.body.event;
  const payload = req.body.payload.subscription?.entity || req.body.payload.payment?.entity;
  const userId = payload?.notes?.userId;
  const planId = payload?.notes?.planId;

  if (!userId) {
    console.log('Webhook event without userId in notes. Skipping.');
    return res.status(200).send('ok');
  }

  console.log(`Processing Razorpay Event: ${event} for User: ${userId}`);

  switch (event) {
    case 'subscription.charged':
    case 'subscription.activated':
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await db.collection('pro_memberships').doc(userId).update({
        proPlanId: planId || 'pro', // Default to pro if missing
        proStatus: 'active',
        proPeriodEnd: admin.firestore.Timestamp.fromDate(periodEnd),
        proJarsUsedThisMonth: 0,
        proTrialEnd: null,
        updatedAt: admin.firestore.Timestamp.now()
      });
      
      await sendNotification(userId, 'PLAN_ACTIVATED', { planId, periodEnd });
      break;

    case 'subscription.paused':
      await db.collection('pro_memberships').doc(userId).update({
        proStatus: 'expired', // Treat paused as expired/inactive for service
        updatedAt: admin.firestore.Timestamp.now()
      });
      await sendNotification(userId, 'PLAN_PAUSED', { reason: 'Payment issue or manual pause' });
      break;

    case 'subscription.cancelled':
      await db.collection('pro_memberships').doc(userId).update({
        proStatus: 'expired',
        proPlanId: null,
        updatedAt: admin.firestore.Timestamp.now()
      });
      await sendNotification(userId, 'PLAN_CANCELLED', {});
      break;

    case 'payment.failed':
      await sendNotification(userId, 'PAYMENT_FAILED', { amount: payload.amount / 100 });
      break;

    default:
      console.log(`Unhandled event type: ${event}`);
  }

  res.status(200).send('ok');
});

// 9. CRON - Charge Overdue Jars (Gen 2)
exports.chargeOverdueJar = onSchedule({ schedule: '0 2 * * *', region: 'us-central1' }, async (event) => {
  const db = admin.firestore();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const overdueJars = await db.collection('jars')
    .where('status', '==', 'assigned')
    .where('assignedAt', '<', admin.firestore.Timestamp.fromDate(sevenDaysAgo))
    .get();

  const batch = db.batch();
  for (const doc of overdueJars.docs) {
    const jarData = doc.data();
    const userId = jarData.currentUserId;
    
    if (userId) {
      console.log(`Charging User ${userId} for overdue jar ${doc.id}`);
      const userRef = db.collection('users').doc(userId);
      batch.update(userRef, {
        walletBalance: FieldValue.increment(-165), // Penalty charge
        lastPenaltyReason: `Unreturned jar ${doc.id} > 7 days`
      });
    }
  }
  
  await batch.commit();
  console.log(`Processed ${overdueJars.size} overdue jars`);
});

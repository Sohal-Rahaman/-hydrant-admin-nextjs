// Script: find-and-delete-merged-duplicates.mjs
// Purpose: Find duplicate user accounts by phone/email, verify they have NO orders/subscriptions,
// and delete them safely. Only deletes if the account has NO active data.

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Load env manually
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const [k, ...v] = l.split('=');
      return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '')];
    })
);

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

const db = getFirestore(app);

const normalizePhone = (p) => {
  if (!p) return null;
  const digits = String(p).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
};

async function main() {
  console.log('🔍 Loading all users...');
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map(d => ({
    id: d.id,
    ...d.data(),
    _createTime: d.createTime?.toDate?.() || new Date(0)
  }));
  console.log(`✅ Loaded ${users.length} users.`);

  // Group by normalized phone
  const phoneGroups = {};
  users.forEach(u => {
    const phone = normalizePhone(u.phone || u.phoneNumber);
    if (!phone) return;
    if (!phoneGroups[phone]) phoneGroups[phone] = [];
    phoneGroups[phone].push(u);
  });

  // Group by email
  const emailGroups = {};
  users.forEach(u => {
    const email = (u.email || '').toLowerCase().trim();
    if (!email || email === 'sss@gmail.com') return; // skip test emails
    if (!emailGroups[email]) emailGroups[email] = [];
    emailGroups[email].push(u);
  });

  // Collect all groups with duplicates (de-dup by user ID)
  const seen = new Set();
  const dupGroups = [];

  const processGroup = (group) => {
    if (group.length < 2) return;
    const key = group.map(u => u.id).sort().join('|');
    if (seen.has(key)) return;
    seen.add(key);
    // Sort: newest first (last created = primary/keep)
    const sorted = [...group].sort((a, b) => b._createTime - a._createTime);
    dupGroups.push(sorted);
  };

  Object.values(phoneGroups).forEach(g => processGroup(g));
  Object.values(emailGroups).forEach(g => processGroup(g));

  console.log(`\n📊 Found ${dupGroups.length} duplicate groups.\n`);

  if (dupGroups.length === 0) {
    console.log('✨ Database is clean - no duplicates found!');
    process.exit(0);
  }

  const toDelete = [];
  const toSkip = [];

  for (const group of dupGroups) {
    const primary = group[0]; // newest = keep
    const oldIds = group.slice(1).map(u => u.id);

    console.log(`\n👥 Group:`);
    console.log(`   KEEP    → ${primary.customerId} (${primary.id}) | ${primary.full_name || primary.name} | created: ${primary._createTime?.toISOString?.()}`);

    for (const oldId of oldIds) {
      // Check for orders still referencing old ID
      const ordersSnap = await getDocs(query(collection(db, 'orders'), where('userId', '==', oldId)));
      const subsSnap = await getDocs(query(collection(db, 'subscriptions'), where('userId', '==', oldId)));
      const oldUser = group.find(u => u.id === oldId);
      const jars = (oldUser?.jars_occupied || 0) + (oldUser?.jarHold || 0);

      const isClean = ordersSnap.empty && subsSnap.empty && jars === 0;
      const status = isClean ? '✅ SAFE TO DELETE' : '⚠️  SKIP - HAS DATA';

      console.log(`   ${isClean ? 'DELETE' : 'SKIP  '} → ${oldUser?.customerId} (${oldId}) | orders: ${ordersSnap.size} | subs: ${subsSnap.size} | jars: ${jars} | ${status}`);

      if (isClean) {
        toDelete.push(oldId);
      } else {
        toSkip.push({ id: oldId, reason: `orders:${ordersSnap.size} subs:${subsSnap.size} jars:${jars}` });
      }
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📋 SUMMARY:`);
  console.log(`   ✅ Safe to delete: ${toDelete.length} old IDs`);
  console.log(`   ⚠️  Must skip:      ${toSkip.length} old IDs (still have data)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (toDelete.length === 0) {
    console.log('🎉 Nothing to delete. All duplicates already cleaned or have active data.');
    process.exit(0);
  }

  // Batch delete in chunks of 400
  console.log(`🗑️  Deleting ${toDelete.length} orphaned accounts...`);
  const chunkSize = 400;
  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const chunk = toDelete.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach(id => batch.delete(doc(db, 'users', id)));
    await batch.commit();
    console.log(`   Deleted batch ${Math.floor(i / chunkSize) + 1}: ${chunk.length} accounts`);
  }

  console.log(`\n✅ Done! Deleted ${toDelete.length} orphaned duplicate accounts.`);
  if (toSkip.length > 0) {
    console.log(`⚠️  ${toSkip.length} accounts were skipped (they still have orders/jars - run merge first):`);
    toSkip.forEach(s => console.log(`   - ${s.id}: ${s.reason}`));
  }
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

import { 
  writeBatch, 
  doc, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * Merges source users into a target user.
 * 
 * Logic:
 * 1. Move all orders, addresses, transactions, activity logs, and subscriptions to targetUserId.
 * 2. Keep the target user's wallet_balance and jars_occupied (as per user instructions).
 * 3. Delete the source user documents.
 * 4. Record the merge in activity_logs for audit.
 */
export const mergeUserAccounts = async (targetUserId: string, sourceUserIds: string[]) => {
  if (!sourceUserIds.length) return;

  const batch = writeBatch(db);
  const now = serverTimestamp();

  // Collections that use 'userId' as the foreign key
  const dependentCollections = [
    'orders',
    'addresses',
    'transactions',
    'wallet_transactions',
    'activity_logs',
    'subscriptions'
  ];

  console.log(`🔄 Merging ${sourceUserIds.length} accounts into ${targetUserId}...`);

  // 1. Migrate all dependent records
  for (const collectionName of dependentCollections) {
    const colRef = collection(db, collectionName);
    const q = query(colRef, where('userId', 'in', sourceUserIds));
    const snapshot = await getDocs(q);
    
    console.log(`   - Moving ${snapshot.size} records from ${collectionName}...`);
    
    snapshot.forEach((d) => {
      batch.update(doc(db, collectionName, d.id), {
        userId: targetUserId,
        mergedFrom: d.data().userId, // Keep a record of the original owner
        updatedAt: now
      });
    });
  }

  // 2. Log the merge operation for the target user
  const auditLogRef = doc(collection(db, 'activity_logs'));
  batch.set(auditLogRef, {
    action: 'user_merge',
    userId: targetUserId,
    sourceUserIds: sourceUserIds,
    mergedAt: now,
    details: `Merged ${sourceUserIds.length} accounts into this primary account.`
  });

  // 3. Delete source user documents
  for (const sourceId of sourceUserIds) {
    batch.delete(doc(db, 'users', sourceId));
  }

  // 4. Commit the batch
  await batch.commit();
  console.log('✅ Merge complete!');
};

import { db } from './firebase';
import { 
  collection, 
  doc, 
  Timestamp, 
  Transaction,
  runTransaction
} from 'firebase/firestore';

export type TransactionType = 
  | 'ORDER_PAYMENT' 
  | 'TOP_UP' 
  | 'REFUND' 
  | 'ADMIN_ADJUSTMENT' 
  | 'CANCELLATION_REFUND'
  | 'BONUS';

interface WalletTxnParams {
  userId: string;
  amount: number;
  type: TransactionType;
  referenceId?: string;
  description: string;
  createdBy: string;
}

/**
 * Core logic to update wallet and record transaction within an EXISTING firestore transaction.
 * Use this inside runTransaction block.
 */
export const executeWalletUpdate = async (
  transaction: Transaction,
  params: WalletTxnParams
) => {
  const { userId, amount, type, referenceId, description, createdBy } = params;
  const userRef = doc(db, 'users', userId);
  const userDoc = await transaction.get(userRef);

  if (!userDoc.exists()) {
    throw new Error(`User ${userId} not found`);
  }

  const userData = userDoc.data();
  const currentBalance = userData.wallet_balance ?? userData.walletBalance ?? 0;
  const newBalance = currentBalance + amount;

  // 1. Update User Balance (Both fields for consistency)
  transaction.update(userRef, {
    wallet_balance: newBalance,
    walletBalance: newBalance,
    updatedAt: Timestamp.now()
  });

  // 2. Record Transaction Ledger Entry
  const txnRef = doc(collection(db, 'wallet_transactions'));
  transaction.set(txnRef, {
    userId,
    amount,
    previous_balance: currentBalance,
    new_balance: newBalance,
    type,
    referenceId: referenceId ?? null,
    description,
    createdAt: Timestamp.now(),
    createdBy,
    status: 'completed'
  });

  return { previous_balance: currentBalance, new_balance: newBalance };
};

/**
 * Helper to run a standalone wallet update transaction.
 */
export const runWalletTransaction = async (params: WalletTxnParams) => {
  return await runTransaction(db, async (transaction) => {
    return await executeWalletUpdate(transaction, params);
  });
};

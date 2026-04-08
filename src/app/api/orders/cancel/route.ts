import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { runTransaction, doc, Timestamp } from 'firebase/firestore';
import { executeWalletUpdate } from '@/lib/wallet';

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const orderRef = doc(db, 'orders', orderId);

    let refundedAmount = 0;
    let newBalance = 0;

    // ATOMIC TRANSACTION: Check Order -> Mark Cancelled -> Refund Wallet
    await runTransaction(db, async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists()) {
        throw new Error("Order not found");
      }

      const orderData = orderDoc.data();
      if (orderData.status === 'cancelled') {
        throw new Error("Order is already cancelled.");
      }

      if (orderData.status === 'completed' || orderData.status === 'delivered') {
        throw new Error("Cannot cancel an already delivered order.");
      }

      const userId = orderData.userId;
      const totalCost = orderData.totalCost || (orderData.quantity * 37) || 37;
      refundedAmount = totalCost;

      const userRef = doc(db, 'users', userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error("User associated with order not found.");
      }

      // 1. Credit Wallet using Ledger Helper
      const { new_balance } = await executeWalletUpdate(transaction, {
        userId,
        amount: totalCost,
        type: 'CANCELLATION_REFUND',
        referenceId: orderId,
        description: `Refund for cancelled Order #${orderId.substring(0, 8)}`,
        createdBy: 'system'
      });
      
      newBalance = new_balance;

      // 2. Mark Order Cancelled
      transaction.update(orderRef, { 
        status: 'cancelled', 
        updatedAt: Timestamp.now(),
        refundedAmount: totalCost
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Order Cancelled & Wallet Refunded.',
      refundedAmount,
      newBalance
    });

  } catch (err: any) {
    console.error("Atomic Order Cancellation Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { runTransaction, doc } from 'firebase/firestore';

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

      const currentBalance = userDoc.data().walletBalance || 0;
      newBalance = currentBalance + totalCost;

      // 1. Credit Wallet
      transaction.update(userRef, { walletBalance: newBalance });

      // 2. Mark Order Cancelled
      transaction.update(orderRef, { 
        status: 'cancelled', 
        updatedAt: new Date(),
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

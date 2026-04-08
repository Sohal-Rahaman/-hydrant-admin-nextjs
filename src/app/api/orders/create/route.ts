import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { runTransaction, doc, collection, Timestamp } from 'firebase/firestore';
import { sendEmail } from '@/lib/email';
import { executeWalletUpdate } from '@/lib/wallet';

export async function POST(request: Request) {
  try {
    const { userId, quantity = 1, address } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const JAR_PRICE = 37;
    const totalCost = quantity * JAR_PRICE;
    const userRef = doc(db, 'users', userId);
    // When using custom ids for new documents in a transaction with JS Client SDK, 
    // it's easier to generate an ID manually or just use addDoc outside, wait, runTransaction supports setting to a new document reference with an auto-id.
    const newOrderRef = doc(collection(db, 'orders'));

    let finalBalance = 0;
    let userName = 'Customer';
    let userEmail = '';
    let insufficientFunds = false;

    // ATOMIC TRANSACTION: Read Wallet -> Deduct (Allow Negative) -> Record Txn -> Create Order
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error("User does not exist!");
      }

      const userData = userDoc.data();
      userName = userData.name || userData.displayName || 'Customer';
      userEmail = userData.email || '';

      // 1. Deduct Wallet using Ledger Helper (Allowing negative balance)
      const { new_balance } = await executeWalletUpdate(transaction, {
        userId,
        amount: -totalCost,
        type: 'ORDER_PAYMENT',
        referenceId: newOrderRef.id,
        description: `Payment for Order of ${quantity} jars`,
        createdBy: userId // In client flow, user is the actor
      });

      finalBalance = new_balance;

      // 2. Create Confirmed Order
      const orderPayload = {
        id: newOrderRef.id,
        userId: userId,
        customerName: userName,
        quantity: quantity,
        jarPrice: JAR_PRICE,
        totalCost: totalCost,
        status: 'confirmed',
        paymentMethod: 'wallet',
        address: address || userData.address || '',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      transaction.set(newOrderRef, orderPayload);
    });

    // Send warning email if balance went negative
    if (finalBalance < 0 && userEmail) {
      await sendEmail(
        userEmail,
        "Order Processed: HYDRANT 2.0 Trust Credit Applied",
        `<p>Hi ${userName},</p>
         <p>Your order for ${quantity}x 20L Water Jars has been placed successfully!</p>
         <p>Your current wallet balance is <strong>-₹${Math.abs(finalBalance)}</strong>. We've processed this order using our Trust Credit system to ensure you don't run out of water.</p>
         <p>Please top up your wallet at your earliest convenience to maintain your service.</p>
         <br><p>Stay Hydrated,<br>Team Hydrant</p>`
      );
    }


    // Success response
    return NextResponse.json({ 
      success: true, 
      message: 'Order Placed & Wallet Deducted Successfully.',
      orderId: newOrderRef.id,
      remainingBalance: finalBalance
    });

  } catch (err: any) {
    console.error("Atomic Order Creation Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

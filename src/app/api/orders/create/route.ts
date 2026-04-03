import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { runTransaction, doc, collection } from 'firebase/firestore';
import { sendEmail } from '@/lib/email';

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

    // ATOMIC TRANSACTION: Read Wallet -> Check Balance -> Deduct -> Create Order
    await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) {
        throw new Error("User does not exist!");
      }

      const userData = userDoc.data();
      const currentBalance = userData.walletBalance || 0;
      userName = userData.name || userData.displayName || 'Customer';
      userEmail = userData.email || '';

      if (currentBalance < totalCost) {
        insufficientFunds = true;
        // We abort the transaction logic here but we don't throw an error, 
        // we just exit cleanly to handle the notification immediately after.
        return;
      }

      finalBalance = currentBalance - totalCost;

      // 1. Deduct Wallet
      transaction.update(userRef, { walletBalance: finalBalance });

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
        createdAt: new Date(),
        updatedAt: new Date()
      };

      transaction.set(newOrderRef, orderPayload);
    });

    if (insufficientFunds) {
      // TRIGGER REJECTION EMAIL
      if (userEmail) {
        await sendEmail(
          userEmail,
          "Action Required: Hydrant Order Failed due to Low Balance",
          `<p>Hi ${userName},</p>
           <p>Your order for ${quantity}x 20L Water Jars could not be placed because your wallet balance (₹${finalBalance}) is insufficient for the total cost of ₹${totalCost}.</p>
           <p>Please top up your wallet via the App to schedule tomorrow's delivery.</p>
           <br><p>Stay Hydrated,<br>Team Hydrant</p>`
        );
      }
      return NextResponse.json({ 
        success: false, 
        message: 'Insufficient Funds. Order rejected.', 
        required: totalCost 
      }, { status: 402 }); 
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

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { getValidZohoToken, getZohoOrgId } from '@/lib/zoho';

export async function POST(request: Request) {
  try {
    const { userId, year, month } = await request.json();

    if (!userId || !year || month === undefined) {
      return NextResponse.json({ error: 'userId, year, and month are required' }, { status: 400 });
    }

    // 1. Validate Customer & Zoho Mapping
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userSnap.data();
    const contactId = userData.zoho_contact_id;

    if (!contactId) {
      return NextResponse.json({ error: 'User is not synced with Zoho. Sync customer first.' }, { status: 400 });
    }

    // 2. Aggregate Orders for the Month
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    let biledJars = 0;
    
    querySnapshot.forEach((docSnap) => {
      const order = docSnap.data();
      const dt = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      
      if (dt.getFullYear() === year && dt.getMonth() === month) {
         // Hydrant Logic: Any order not cancelled is considered a delivered jar.
         if (order.status !== 'cancelled') {
             biledJars += 1;
         }
      }
    });

    if (biledJars === 0) {
      return NextResponse.json({ message: 'No billable orders for this month', biledJars: 0 });
    }

    // 3. Prepare Zoho Invoice Payload
    const accessToken = await getValidZohoToken();
    const orgId = await getZohoOrgId(accessToken);
    
    // Construct MM and YYYY for invoice metadata
    const formattedMonth = (month + 1).toString().padStart(2, '0');
    // Calculate last day of the month for invoice date
    const lastDay = new Date(year, month + 1, 0).getDate();
    const invoiceDate = `${year}-${formattedMonth}-${lastDay}`;
    
    const payload = {
      customer_id: contactId,
      date: invoiceDate,
      line_items: [
        {
          name: `20L Water Jar - ${new Date(year, month).toLocaleString('default', { month: 'long' })} Subscriptions`,
          rate: 37,
          quantity: biledJars
        }
      ],
      // We assume pre-paid wallet, so status might be Draft or Sent depending on configuration.
      // By default Zoho creates as Draft, which we can approve immediately if we want.
    };

    // 4. Create Invoice in Zoho Books
    const invoiceRes = await fetch(`https://www.zohoapis.in/books/v3/invoices?organization_id=${orgId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const invoiceData = await invoiceRes.json();

    if (invoiceData.code !== 0) {
      throw new Error(`Zoho API Error: ${invoiceData.message}`);
    }

    const invoiceId = invoiceData.invoice.invoice_id;

    // 5. Optionally email the invoice to customer
    // Push an email trigger to Zoho Books directly
    const emailRes = await fetch(`https://www.zohoapis.in/books/v3/invoices/${invoiceId}/email?organization_id=${orgId}`, {
         method: 'POST',
         headers: {
             'Authorization': `Zoho-oauthtoken ${accessToken}`,
             'Content-Type': 'application/json'
         },
         body: JSON.stringify({ send_me_a_copy: false })
    });
    
    // 6. Save reference back to Hydrant
    // Store generated invoices in a subcollection or root collection for history tracking
    await setDoc(doc(db, `users/${userId}/invoices`, invoiceId), {
       zoho_invoice_id: invoiceId,
       year,
       month,
       biledJars,
       totalValue: biledJars * 37,
       createdAt: new Date(),
       status: 'synced_and_emailed'
    });

    return NextResponse.json({ 
       success: true, 
       invoice_id: invoiceId,
       biledJars,
       message: 'Monthly Invoice Created and Emailed via Zoho.' 
    });

  } catch (err: any) {
    console.error("Zoho Invoice Gen Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

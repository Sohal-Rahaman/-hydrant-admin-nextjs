import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, query, where } from 'firebase/firestore';

export async function GET(request: Request) {
  // Authentication check for Cron environments
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    // Default to the previous month for automated billing runs on the 1st
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth() - 1; 

    if (targetMonth < 0) {
      targetMonth = 11;
      targetYear -= 1;
    }

    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);

    let invoicesGenerated = 0;
    const baseApiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Only attempt on users who have a Zoho mapping
      if (!userData.zoho_contact_id) continue;

      try {
          // Trigger the Phase 1 Zoho Generator purely internally
          const res = await fetch(`${baseApiUrl}/api/zoho/generate-invoice`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  userId,
                  year: targetYear,
                  month: targetMonth
              })
          });
          
          const data = await res.json();
          if (data.success && data.biledJars > 0) {
              invoicesGenerated++;
          }
      } catch (err) {
          console.error(`Failed to automate invoice for user ${userId}:`, err);
      }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Monthly billing chron executed. Triggered ${invoicesGenerated} invoices for ${targetMonth + 1}/${targetYear}.`
    });

  } catch (err: any) {
    console.error("Billing Cron Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

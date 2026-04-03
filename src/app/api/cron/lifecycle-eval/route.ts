import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { sendEmail } from '@/lib/email';

export async function GET(request: Request) {
  // Authentication check for Cron environments
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);

    let processedCount = 0;
    
    // We execute synchronously over the batch to prevent rate limits
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      
      const lastOrderDate = userData.lastOrderDate?.toDate ? userData.lastOrderDate.toDate() : (userData.lastOrderDate ? new Date(userData.lastOrderDate) : null);
      const email = userData.email;
      const userName = userData.name || userData.displayName || 'Hydrant Member';

      // Skip invalid accounts
      if (!lastOrderDate || !email) continue;

      const now = new Date();
      const daysSinceOrder = Math.floor((now.getTime() - lastOrderDate.getTime()) / (1000 * 3600 * 24));

      let newState = 'active';
      let emailSent = false;

      if (daysSinceOrder > 15) {
        newState = 'churned';
        if (userData.lifecycleState !== 'churned') {
            await sendEmail(
                email,
                "We Miss You! Here's 10% Off Your Next Water Jar",
                `<p>Hi ${userName},</p>
                 <p>It's been a while since your last order with Hydrant. Staying hydrated is essential, so we're offering you a 10% discount on your next 20L Water Jar!</p>
                 <p>Use code <b>HYDRATE10</b> in the app.</p>
                 <br><p>Stay Hydrated,<br>Team Hydrant</p>`
              );
            emailSent = true;
        }
      } else if (daysSinceOrder > 7) {
        newState = 'inactive';
        if (userData.lifecycleState !== 'inactive') {
            await sendEmail(
                email,
                "Running Low on Hydration? Let's fix that.",
                `<p>Hi ${userName},</p>
                 <p>We noticed you haven't ordered in a week. Are you running low on your 20L Water Jar?</p>
                 <p>Tap the app to schedule your next refill for tomorrow morning!</p>
                 <br><p>Stay Hydrated,<br>Team Hydrant</p>`
              );
            emailSent = true;
        }
      }

      // Update their lifecycle metadata if it changed
      if (userData.lifecycleState !== newState) {
        await setDoc(doc(db, 'users', userId), { 
            lifecycleState: newState,
            lastLifecycleUpdate: new Date(),
        }, { merge: true });
        
        processedCount++;
      }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Lifecycle eval complete. Updated ${processedCount} users.`
    });

  } catch (err: any) {
    console.error("Lifecycle Cron Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

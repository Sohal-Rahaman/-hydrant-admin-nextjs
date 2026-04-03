import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { getValidZohoToken, getZohoOrgId } from '@/lib/zoho';

export async function GET(request: Request) {
  try {
    const usersRef = collection(db, 'users');
    const usersSnap = await getDocs(usersRef);

    const accessToken = await getValidZohoToken();
    const orgId = await getZohoOrgId(accessToken);

    let syncedCount = 0;
    let skippedCount = 0;
    let errors = [];

    // Loop through all users in Hydrant
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;

      // Skip already synced users to prevent duplicates/unnecessary API calls
      if (userData.zoho_contact_id) {
        skippedCount++;
        continue;
      }

      const phoneStr = userData.phone || userData.phoneNumber || '';
      const nameStr = userData.name || userData.displayName || `Hydrant Customer (${userId.slice(-4)})`;
      
      try {
        // 1. Search Zoho to prevent absolute duplicates
        const searchRes = await fetch(`https://www.zohoapis.in/books/v3/contacts?organization_id=${orgId}&mobile=${encodeURIComponent(phoneStr)}`, {
          headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const searchData = await searchRes.json();

        let contactId = null;

        if (searchData.code === 0 && searchData.contacts && searchData.contacts.length > 0) {
          // Customer already exists in Zoho
          contactId = searchData.contacts[0].contact_id;
        } else {
          // 2. Create them in Zoho
          const payload = {
            contact_name: nameStr,
            company_name: "Hydrant Consumer",
            mobile: phoneStr,
            email: userData.email || '',
            contact_type: "customer",
            billing_address: {
              address: userData.address || "Hydrant Default Address",
              city: "New Delhi",
              state: "Delhi",
              country: "India"
            }
          };

          const createRes = await fetch(`https://www.zohoapis.in/books/v3/contacts?organization_id=${orgId}`, {
            method: 'POST',
            headers: { 
              'Authorization': `Zoho-oauthtoken ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          const createData = await createRes.json();

          if (createData.code !== 0) {
             throw new Error(`Zoho API Error: ${createData.message}`);
          }
          contactId = createData.contact.contact_id;
        }

        // 3. Mark the Firebase user with the Zoho ID
        await setDoc(doc(db, 'users', userId), { zoho_contact_id: contactId }, { merge: true });
        syncedCount++;
        
      } catch (err: any) {
        console.error(`Error syncing user ${userId}:`, err.message);
        errors.push({ userId, error: err.message });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Global Customer Sync Completed',
      stats: {
          totalChecked: usersSnap.docs.length,
          newlySynced: syncedCount,
          skippedAlreadySynced: skippedCount,
          errors: errors.length
      },
      errors
    });

  } catch (err: any) {
    console.error("Global Zoho Sync Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

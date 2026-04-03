import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getValidZohoToken, getZohoOrgId } from '@/lib/zoho';

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Fetch Hydrant User from Firestore
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return NextResponse.json({ error: 'User not found in Firebase' }, { status: 404 });
    }

    const userData = userSnap.data();
    
    // If we've already synced this user, just return the existing Zoho Contact ID
    if (userData.zoho_contact_id) {
      return NextResponse.json({ 
        success: true, 
        contact_id: userData.zoho_contact_id,
        message: 'Already synced'
      });
    }

    // 2. Fetch Active Zoho Token and Org ID
    const accessToken = await getValidZohoToken();
    const orgId = await getZohoOrgId(accessToken);
    const phoneStr = userData.phone || userData.phoneNumber || '';
    
    // Ensure we send valid strings for required fields
    const nameStr = userData.name || userData.displayName || 'Hydrant Customer';
    
    // 3. Search Zoho to prevent absolute duplicates (search by phone/mobile)
    // Zoho API requires organization_id param on all requests
    const searchRes = await fetch(`https://www.zohoapis.in/books/v3/contacts?organization_id=${orgId}&mobile=${encodeURIComponent(phoneStr)}`, {
      headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
    });
    const searchData = await searchRes.json();

    let contactId = null;

    if (searchData.code === 0 && searchData.contacts && searchData.contacts.length > 0) {
      // Customer already exists in Zoho but Hydrant didn't know
      contactId = searchData.contacts[0].contact_id;
    } else {
      // 4. Customer does not exist in Zoho, Create them.
      const payload = {
        contact_name: nameStr,
        company_name: "Hydrant Consumer", // B2C flag
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

    // 5. Update Firebase with the mapped Zoho Contact ID
    await setDoc(userRef, { zoho_contact_id: contactId }, { merge: true });

    return NextResponse.json({ 
      success: true, 
      contact_id: contactId,
      message: 'Zoho Customer Synced'
    });

  } catch (err: any) {
    console.error("Zoho Sync Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

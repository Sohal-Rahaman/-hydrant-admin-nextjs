import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface ZohoTokens {
  access_token: string;
  refresh_token: string;
  api_domain: string;
  expires_in: number;
}

/**
 * Retrieves a valid Zoho access token.
 * If the current token is expired, it automatically uses the refresh_token
 * to fetch a new one, updates Firestore, and returns the new token.
 */
export async function getValidZohoToken(): Promise<string> {
  const tokenDocRef = doc(db, 'settings', 'zoho_integration');
  const docSnap = await getDoc(tokenDocRef);

  if (!docSnap.exists()) {
    throw new Error("Zoho integration is not configured. Please connect from the Admin Settings.");
  }

  const data = docSnap.data();
  const { access_token, refresh_token, updated_at, expires_in } = data;

  if (!refresh_token) {
    throw new Error("No refresh_token found. Please authorize Zoho again.");
  }

  // Check if token is expired. Zoho tokens usually last 1 hour (3600 seconds).
  // We'll give it a 5-minute buffer to be safe.
  const updatedAt = updated_at?.toDate ? updated_at.toDate() : new Date(updated_at);
  const now = new Date();
  
  const secondsSinceUpdate = (now.getTime() - updatedAt.getTime()) / 1000;
  
  if (secondsSinceUpdate < (expires_in - 300) && access_token) {
    // Token is still valid
    return access_token;
  }

  // Token is expired, we must refresh it
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET from environment.");
  }

  try {
    const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      })
    });

    const refreshedData = await response.json();

    if (refreshedData.error) {
      console.error("Zoho Refresh Error:", refreshedData);
      throw new Error(`Failed to refresh token: ${refreshedData.error}`);
    }

    const newAccessToken = refreshedData.access_token;
    const newExpiresIn = refreshedData.expires_in || 3600;

    // Save the new access token back to Firestore
    await setDoc(tokenDocRef, {
      access_token: newAccessToken,
      expires_in: newExpiresIn,
      updated_at: new Date(),
      // ZoHo does not always return a new refresh_token on refresh grants.
      // So we retain the old one.
    }, { merge: true });

    return newAccessToken;

  } catch (err: any) {
    console.error("Error generating new Zoho access token:", err);
    throw new Error("Could not retrieve a valid Zoho token.");
  }
}

/**
 * Retrieves the Zoho Organization ID.
 * Zoho Books strictly requires the organization_id for all API operations.
 */
export async function getZohoOrgId(accessToken: string): Promise<string> {
  // First, check if we have it cached in Firestore to save an API call
  const tokenDocRef = doc(db, 'settings', 'zoho_integration');
  const docSnap = await getDoc(tokenDocRef);
  if (docSnap.exists() && docSnap.data().organization_id) {
    return docSnap.data().organization_id;
  }

  // Not cached, fetch from Zoho Books API
  const response = await fetch('https://www.zohoapis.in/books/v3/organizations', {
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`
    }
  });

  const data = await response.json();
  if (data.code === 0 && data.organizations?.length > 0) {
    const orgId = data.organizations[0].organization_id;
    // Cache it
    await setDoc(tokenDocRef, { organization_id: orgId }, { merge: true });
    return orgId;
  }

  throw new Error("Failed to retrieve Zoho Organization ID. Ensure Zoho Books is set up.");
}

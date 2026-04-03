import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    const { origin } = new URL(request.url);
    
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const redirectUri = `${origin}/oauth/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'OAuth secrets missing from environment' }, { status: 500 });
    }

    const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      })
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    // Save tokens securely to Firestore 'settings/zoho_integration'
    await setDoc(doc(db, 'settings', 'zoho_integration'), {
      access_token: data.access_token || '',
      refresh_token: data.refresh_token || '',
      api_domain: data.api_domain || '',
      expires_in: data.expires_in || 3600,
      updated_at: new Date()
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const clientId = process.env.ZOHO_CLIENT_ID;
  
  if (!clientId) {
    return NextResponse.json({ error: 'Zoho Client ID missing' }, { status: 500 });
  }

  // The redirect URI matches exactly what is registered in Zoho Developer Console dynamically
  const redirectUri = `${origin}/oauth/callback`;
  const scope = "ZohoBooks.fullaccess.all,ZohoCRM.modules.ALL,ZohoMail.accounts.READ,ZohoMail.messages.ALL,ZohoSheet.dataAPI.READ,ZohoSheet.dataAPI.UPDATE"; 
  
  const authUrl = new URL("https://accounts.zoho.in/oauth/v2/auth");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("scope", scope);
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("access_type", "offline"); 
  authUrl.searchParams.append("prompt", "consent"); 

  return NextResponse.redirect(authUrl.toString());
}

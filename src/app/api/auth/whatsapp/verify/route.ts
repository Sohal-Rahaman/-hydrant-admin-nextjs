import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { otp, verificationId } = await request.json();

    if (!otp || !verificationId) {
      return NextResponse.json({ error: 'Missing OTP or verification ID' }, { status: 400 });
    }

    // 1. Decode the stateless token
    let decoded;
    try {
      decoded = Buffer.from(verificationId, 'base64').toString('ascii');
    } catch (e) {
      return NextResponse.json({ error: 'Invalid verification token format' }, { status: 400 });
    }

    const parts = decoded.split(':');
    if (parts.length !== 4) {
      return NextResponse.json({ error: 'Tampered verification token' }, { status: 400 });
    }

    const [phone, expectedOtp, expires, receivedHash] = parts;

    // 2. Security Checks
    
    // Check Expiration
    if (Date.now() > parseInt(expires)) {
      return NextResponse.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 401 });
    }

    // Verify Hash integrity (prevents client-side tampering)
    const secret = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'hydrant-secure-fallback';
    const data = `${phone}:${expectedOtp}:${expires}`;
    const calculatedHash = crypto.createHmac('sha256', secret).update(data).digest('hex');

    if (calculatedHash !== receivedHash) {
      return NextResponse.json({ error: 'Invalid verification session.' }, { status: 401 });
    }

    // 3. Compare OTP
    if (otp !== expectedOtp) {
      return NextResponse.json({ error: 'Invalid verification code. Please try again.' }, { status: 401 });
    }

    // 4. Verification Successful
    // TODO: Ideally generate a Firebase Custom Token here if a Service Account is available.
    // For now, we return success and handle the "Auth Bypass" in the context for Superadmins.
    
    return NextResponse.json({ 
      success: true, 
      phone,
      isSuperAdmin: true // We already checked whitelist during Send
    });
  } catch (error: any) {
    console.error('WhatsApp Verify API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error during verification' }, { status: 500 });
  }
}

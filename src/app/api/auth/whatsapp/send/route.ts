import { NextResponse } from 'next/server';
import { sendWhatsAppOTP } from '@/lib/whatsapp';
import { SUPERADMIN_PHONES } from '@/lib/firebase';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    
    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Normalize phone for comparison
    const normalizedPhone = phone.replace(/[^\d+]/g, '');

    // 1. Whitelist Security Check
    if (!SUPERADMIN_PHONES.includes(normalizedPhone)) {
      console.warn(`Blocked unauthorized WhatsApp OTP attempt for: ${normalizedPhone}`);
      return NextResponse.json({ error: 'Access Denied: This number is not in the Superadmin whitelist.' }, { status: 403 });
    }

    // 2. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Send via WhatsApp
    console.log(`Sending WhatsApp OTP to ${normalizedPhone}`);
    await sendWhatsAppOTP(normalizedPhone, otp);

    // 4. Create stateless verification token (Encrypted payload)
    // We use the Firebase API Key as a temporary secret for Hashing
    const secret = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'hydrant-secure-fallback';
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes validity
    const data = `${normalizedPhone}:${otp}:${expires}`;
    
    const hash = crypto.createHmac('sha256', secret).update(data).digest('hex');
    const verificationId = Buffer.from(`${data}:${hash}`).toString('base64');

    return NextResponse.json({ 
      success: true, 
      verificationId // Client must send this back for verification
    });
  } catch (error: any) {
    console.error('WhatsApp Send API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

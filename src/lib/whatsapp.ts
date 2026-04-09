/**
 * WhatsApp integration via Fast2SMS API
 * Used for OTP delivery.
 */

export async function sendWhatsAppOTP(phone: string, otp: string) {
  const token = (process.env.WHATSAPP_API_TOKEN || '').trim();
  const messageId = (process.env.WHATSAPP_MESSAGE_ID || '13862').trim();
  const phoneId = (process.env.WHATSAPP_PHONE_ID || '1048208491702174').trim();
  
  if (!token) {
    throw new Error('WhatsApp API Token (WHATSAPP_API_TOKEN) is missing in .env.local');
  }

  // Fast2SMS expects numbers without '+' prefix and non-digits
  const normalizedPhone = phone.replace(/\D/g, '');

  // Using the proven dev/whatsapp endpoint from the working user app
  const url = new URL('https://www.fast2sms.com/dev/whatsapp');
  url.searchParams.append('authorization', token);
  url.searchParams.append('message_id', messageId);
  url.searchParams.append('phone_number_id', phoneId);
  url.searchParams.append('numbers', normalizedPhone);
  url.searchParams.append('variables_values', otp);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
    });

    const data = await response.json();

    // Fast2SMS returns data.return properly on success
    if (!response.ok || !data.return) {
      console.error('Fast2SMS WhatsApp API Error:', data);
      throw new Error(data.message || 'Failed to send WhatsApp OTP via Fast2SMS');
    }

    return { 
      success: true, 
      request_id: data.request_id 
    };
  } catch (error) {
    console.error('WhatsApp Service Error (Fast2SMS):', error);
    throw error;
  }
}

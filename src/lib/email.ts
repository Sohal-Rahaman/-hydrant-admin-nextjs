import nodemailer from 'nodemailer';

/**
 * Enterprise standard Gmail SMTP transport wrapper.
 * Requires process.env.EMAIL_USER and process.env.EMAIL_APP_PASSWORD.
 */
export async function sendEmail(to: string, subject: string, html: string) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.warn("⚠️ Email credentials missing. Logging email instead:");
    console.log(`To: ${to}\nSubject: ${subject}\nBody: ${html}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  try {
    const info = await transporter.sendMail({
      from: `"Hydrant Support" <${user}>`,
      to,
      subject,
      html,
    });
    console.log("Email sent successfully: ", info.messageId);
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

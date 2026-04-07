import nodemailer from 'nodemailer';

function apiBaseUrl(): string {
  const raw = process.env.API_PUBLIC_URL?.trim();
  if (raw) return raw;
  return `http://localhost:${process.env.PORT || 4000}`;
}

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendVerifyEmail(to: string, token: string): Promise<boolean> {
  const transporter = getTransport();
  if (!transporter) return false;
  const from = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || 'no-reply@reseller.local';
  const verifyUrl = `${apiBaseUrl().replace(/\/+$/, '')}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  await transporter.sendMail({
    from,
    to,
    subject: 'Verify your email - Reseller',
    html: `
      <p>Welcome to Reseller.</p>
      <p>Please verify your email to activate login:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>If you did not create this account, please ignore this email.</p>
    `,
  });
  return true;
}

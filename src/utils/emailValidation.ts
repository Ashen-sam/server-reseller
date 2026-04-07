import dns from 'dns/promises';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BLOCKED_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
]);

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  return /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
}

export async function validateEmailForRegistration(raw: string): Promise<{ ok: boolean; reason?: string }> {
  const email = normalizeEmail(raw);
  if (!EMAIL_RE.test(email)) return { ok: false, reason: 'Invalid email format' };
  const domain = email.split('@')[1] ?? '';
  if (!domain) return { ok: false, reason: 'Invalid email domain' };
  if (BLOCKED_DOMAINS.has(domain)) return { ok: false, reason: 'Disposable email addresses are not allowed' };
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0) return { ok: false, reason: 'Email domain has no MX records' };
  } catch {
    return { ok: false, reason: 'Could not validate email domain MX records' };
  }
  return { ok: true };
}

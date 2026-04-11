/** Server-side Clerk is enabled when a secret key is present (never commit real keys). */
export function isClerkEnabled(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY?.trim());
}

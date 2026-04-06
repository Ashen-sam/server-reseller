import type { Request } from 'express';
import { cookieName } from './jwt';

/** Cookie (same-origin / legacy) or `Authorization: Bearer` (SPA on another domain). */
export function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(\S+)/i);
    if (m?.[1]) return m[1].trim();
  }
  const c = req.cookies?.[cookieName()];
  return typeof c === 'string' && c ? c : null;
}

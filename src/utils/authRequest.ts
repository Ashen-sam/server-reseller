import type { Request } from 'express';
import { cookieName } from './jwt';

/** Cookie (same-origin / legacy) or `Authorization: Bearer` (SPA on another domain). */
export function getTokenFromRequest(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const c = req.cookies?.[cookieName()];
  return typeof c === 'string' && c ? c : null;
}

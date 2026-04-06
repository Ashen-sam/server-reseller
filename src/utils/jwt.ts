import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';

const COOKIE_NAME = 'token';
const JWT_EXPIRES = '7d';

export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

export function signToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, getJwtSecret(), { expiresIn: JWT_EXPIRES });
}

export interface JwtPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload;
}

export function cookieName(): string {
  return COOKIE_NAME;
}

/**
 * SameSite=None; Secure for cross-origin cookie fallback (Vercel + Render).
 * Defaults to on in production unless CROSS_SITE_COOKIES=0|false.
 * Bearer token in Authorization header is the primary cross-origin auth.
 */
function crossSiteCookies(): boolean {
  const v = process.env.CROSS_SITE_COOKIES;
  if (v === 'false' || v === '0') return false;
  if (v === 'true' || v === '1') return true;
  return process.env.NODE_ENV === 'production';
}

export function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  const crossSite = crossSiteCookies();
  const sameSite = crossSite ? ('none' as const) : ('lax' as const);
  const secure = crossSite || isProd;
  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

/** Match set options so browsers actually remove the cookie on logout. */
export function cookieClearOptions() {
  const o = cookieOptions();
  return {
    path: o.path,
    sameSite: o.sameSite,
    secure: o.secure,
    httpOnly: o.httpOnly,
  };
}

export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

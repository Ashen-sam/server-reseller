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

export function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

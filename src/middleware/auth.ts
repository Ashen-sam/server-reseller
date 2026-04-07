import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { User, IUser } from '../models/User';
import { ensureMongoUserFromClerk } from '../utils/clerkSync';

export interface AuthRequest extends Request {
  user?: IUser;
  userId?: string;
}

function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function getOrCreateUserFromAuth(
  clerkUserId: string,
  claims: Record<string, unknown> | null | undefined,
): Promise<IUser | null> {
  const existing = await User.findOne({ clerkUserId }).select('-passwordHash');
  if (existing) return existing;

  const emailFromClaims =
    (typeof claims?.email === 'string' && claims.email) ||
    (typeof claims?.email_address === 'string' && claims.email_address) ||
    (typeof claims?.primary_email_address === 'string' && claims.primary_email_address) ||
    '';
  const email = emailFromClaims.trim().toLowerCase();

  const first = typeof claims?.given_name === 'string' ? claims.given_name.trim() : '';
  const last = typeof claims?.family_name === 'string' ? claims.family_name.trim() : '';
  const full = typeof claims?.name === 'string' ? claims.name.trim() : '';
  const name = full || `${first} ${last}`.trim() || 'User';

  if (email) {
    const byEmail = await User.findOne({ email }).select('-passwordHash');
    if (byEmail) {
      byEmail.clerkUserId = clerkUserId;
      byEmail.authProvider = 'google';
      byEmail.emailVerified = true;
      if (!byEmail.name) byEmail.name = name;
      await byEmail.save();
      return byEmail;
    }

    const role = adminEmails().has(email) ? 'admin' : 'user';
    return User.create({
      clerkUserId,
      email,
      name,
      role,
      authProvider: 'google',
      emailVerified: true,
      passwordHash: '',
    });
  }

  return ensureMongoUserFromClerk(clerkUserId);
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const clerkUserId = auth.userId || null;
  if (!clerkUserId) return next();
  try {
    const user = await getOrCreateUserFromAuth(
      clerkUserId,
      (auth.sessionClaims as Record<string, unknown> | null | undefined) ?? null,
    );
    if (user) {
      req.user = user;
      req.userId = user.id;
    }
  } catch {
    /* invalid token */
  }
  next();
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!process.env.CLERK_SECRET_KEY?.trim() || !process.env.CLERK_PUBLISHABLE_KEY?.trim()) {
    res.status(500).json({ message: 'Auth is not configured on server' });
    return;
  }
  const auth = getAuth(req);
  const clerkUserId = auth.userId || null;
  if (!clerkUserId) {
    res.status(401).json({ message: 'Not authenticated' });
    return;
  }
  try {
    const user = await getOrCreateUserFromAuth(
      clerkUserId,
      (auth.sessionClaims as Record<string, unknown> | null | undefined) ?? null,
    );
    if (!user) {
      res.status(401).json({ message: 'User not found in Clerk/Mongo sync' });
      return;
    }
    req.user = user;
    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

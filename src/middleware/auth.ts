import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { verifyToken } from '../utils/jwt';
import { getTokenFromRequest } from '../utils/authRequest';
import { User, IUser } from '../models/User';
import { isClerkEnabled } from '../config/clerk';
import { findOrCreateUserFromClerkId } from '../utils/clerkUserSync';

export interface AuthRequest extends Request {
  user?: IUser;
  userId?: string;
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  if (isClerkEnabled()) {
    next();
    return;
  }
  const token = getTokenFromRequest(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).select('-passwordHash');
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
  if (isClerkEnabled()) {
    const { userId } = getAuth(req);
    if (!userId) {
      const hasBearer = /^Bearer\s+\S+/i.test(req.headers.authorization || '');
      res.status(401).json({
        message: 'Not authenticated',
        code: 'CLERK_SESSION_MISSING',
        hint: hasBearer
          ? 'Clerk rejected the session token — use the same Clerk app secret (CLERK_SECRET_KEY) as your VITE_CLERK_PUBLISHABLE_KEY.'
          : 'No session JWT was sent — the app must send Authorization: Bearer from Clerk getToken(). If Clerk network requests fail in DevTools, fix firewall/ad-block or DNS so the browser can reach Clerk.',
      });
      return;
    }
    const user = await findOrCreateUserFromClerkId(userId);
    if (!user) {
      res.status(503).json({
        message:
          'Could not load your marketplace profile. Ensure MongoDB is running, the API can reach Clerk, and your Clerk user has an email address.',
        code: 'PROFILE_SYNC_FAILED',
      });
      return;
    }
    req.user = user;
    req.userId = user.id;
    next();
    return;
  }

  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ message: 'Not authenticated' });
    return;
  }
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }
    req.user = user;
    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Admin access required' });
      return;
    }
    next();
  });
}

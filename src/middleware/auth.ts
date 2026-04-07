import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { User, IUser } from '../models/User';
import { ensureMongoUserFromClerk } from '../utils/clerkSync';

export interface AuthRequest extends Request {
  user?: IUser;
  userId?: string;
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const clerkUserId = auth.userId || null;
  if (!clerkUserId) return next();
  try {
    const user =
      (await User.findOne({ clerkUserId }).select('-passwordHash')) ||
      (await ensureMongoUserFromClerk(clerkUserId));
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
  const auth = getAuth(req);
  const clerkUserId = auth.userId || null;
  if (!clerkUserId) {
    res.status(401).json({ message: 'Not authenticated' });
    return;
  }
  try {
    const user =
      (await User.findOne({ clerkUserId }).select('-passwordHash')) ||
      (await ensureMongoUserFromClerk(clerkUserId));
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

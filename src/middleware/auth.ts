import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { getTokenFromRequest } from '../utils/authRequest';
import { User, IUser } from '../models/User';

export interface AuthRequest extends Request {
  user?: IUser;
  userId?: string;
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
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

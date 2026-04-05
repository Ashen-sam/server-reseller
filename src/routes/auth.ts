import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { signToken, cookieName, cookieOptions } from '../utils/jwt';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { limitsPayload, publicUserFields } from '../utils/serializeUser';

const router = Router();

function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

router.post('/register', async (req, res: Response) => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };
    if (!email || !password || !name) {
      res.status(400).json({ message: 'Email, password, and name are required' });
      return;
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const role = adminEmails().has(email.toLowerCase()) ? 'admin' : 'user';
    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name: name.trim(),
      role,
    });
    const token = signToken(user.id, user.role);
    res.cookie(cookieName(), token, cookieOptions());
    res.status(201).json({
      user: publicUserFields(user),
      limits: limitsPayload(user),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password required' });
      return;
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    const token = signToken(user.id, user.role);
    res.cookie(cookieName(), token, cookieOptions());
    res.json({
      user: publicUserFields(user),
      limits: limitsPayload(user),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/logout', (_req, res: Response) => {
  res.clearCookie(cookieName(), { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  const u = req.user!;
  res.json({
    user: publicUserFields(u),
    limits: limitsPayload(u),
  });
});

export default router;

import { Router, Response } from 'express';
import { getAuth } from '@clerk/express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { signToken, cookieName, cookieOptions, cookieClearOptions } from '../utils/jwt';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { limitsPayload, publicUserFields } from '../utils/serializeUser';
import { DEFAULT_ADMIN_EMAIL } from '../utils/seedDefaultAdmin';
import { AVATAR_STYLES } from '../constants/avatarStyles';
import { isClerkEnabled } from '../config/clerk';

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
  if (isClerkEnabled()) {
    res.status(410).json({ message: 'Sign up is handled in the app (Clerk).' });
    return;
  }
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
    if (email.toLowerCase() === DEFAULT_ADMIN_EMAIL) {
      res.status(403).json({ message: 'This email is reserved for the system administrator account' });
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
      token,
      user: publicUserFields(user),
      limits: limitsPayload(user),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Registration failed' });
  }
});

router.post('/login', async (req, res: Response) => {
  if (isClerkEnabled()) {
    res.status(410).json({ message: 'Sign in is handled in the app (Clerk).' });
    return;
  }
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password required' });
      return;
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash || ''))) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }
    const token = signToken(user.id, user.role);
    res.cookie(cookieName(), token, cookieOptions());
    res.json({
      token,
      user: publicUserFields(user),
      limits: limitsPayload(user),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Login failed' });
  }
});

router.post('/logout', (_req, res: Response) => {
  res.clearCookie(cookieName(), cookieClearOptions());
  res.json({ ok: true });
});

/**
 * Dev helper: see whether the API receives a Clerk JWT and whether `getAuth` accepts it.
 * Open: GET http://localhost:4000/api/auth/clerk-debug (with the same Authorization header the SPA sends, or none).
 */
router.get('/clerk-debug', (req, res: Response) => {
  const allow =
    process.env.NODE_ENV !== 'production' || process.env.CLERK_DEBUG === '1';
  if (!allow) {
    res.status(404).end();
    return;
  }
  if (!isClerkEnabled()) {
    res.json({ clerkEnabled: false });
    return;
  }
  const { userId, sessionId } = getAuth(req);
  const authz = req.headers.authorization || '';
  const hasBearer = /^Bearer\s+\S+/i.test(authz);
  res.json({
    clerkEnabled: true,
    hasPublishableKey: Boolean(process.env.CLERK_PUBLISHABLE_KEY?.trim()),
    hasBearer,
    clerkUserId: userId ?? null,
    sessionId: sessionId ?? null,
    hint: !hasBearer
      ? 'Browser did not send Authorization — Clerk getToken() is empty (often because Clerk Frontend API requests are blocked).'
      : !userId
        ? 'Bearer sent but not accepted — CLERK_SECRET_KEY must be from the same Clerk application as VITE_CLERK_PUBLISHABLE_KEY.'
        : 'Clerk session OK — if /me still fails, the problem is MongoDB or user sync.',
  });
});

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  const u = req.user!;
  res.json({
    user: publicUserFields(u),
    limits: limitsPayload(u),
  });
});

router.put('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { name, email, phone, avatarStyle } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      avatarStyle?: string;
    };
    const nextName = String(name ?? '').trim();
    const nextEmail = String(email ?? '').trim().toLowerCase();
    const nextPhone = String(phone ?? '').trim();

    if (!nextName || !nextEmail) {
      res.status(400).json({ message: 'Name and email are required' });
      return;
    }

    if (user.clerkUserId && nextEmail !== user.email) {
      res.status(400).json({ message: 'Email is managed in your Clerk account.' });
      return;
    }

    const emailTaken = await User.findOne({
      email: nextEmail,
      _id: { $ne: user._id },
    }).select('_id');
    if (emailTaken) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    user.name = nextName;
    user.email = nextEmail;
    user.phone = nextPhone;
    if (avatarStyle !== undefined) {
      if (!AVATAR_STYLES.includes(avatarStyle as (typeof AVATAR_STYLES)[number])) {
        res.status(400).json({ message: 'Invalid avatar style' });
        return;
      }
      user.avatarStyle = avatarStyle as (typeof AVATAR_STYLES)[number];
    }
    await user.save();

    res.json({
      user: publicUserFields(user),
      limits: limitsPayload(user),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Could not update profile' });
  }
});

router.put('/password', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    if (user.clerkUserId || !user.passwordHash) {
      res.status(400).json({ message: 'Password is managed in your Clerk account.' });
      return;
    }
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Current and new password are required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters' });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(401).json({ message: 'Current password is incorrect' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Could not update password' });
  }
});

export default router;

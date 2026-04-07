import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { limitsPayload, publicUserFields } from '../utils/serializeUser';

const router = Router();

router.post('/logout', (_req, res: Response) => {
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

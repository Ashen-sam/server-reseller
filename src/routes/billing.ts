import { Router, Response } from 'express';
import { User } from '../models/User';
import { requireAuth, AuthRequest } from '../middleware/auth';
import {
  BILLING_PRODUCTS,
  type BillingProductId,
} from '../constants/billing';
import { maxImagesPerListingForUser } from '../utils/listingLimits';

const router = Router();

function mockPaymentsEnabled(): boolean {
  const v = process.env.MOCK_PAYMENTS ?? 'true';
  return v === '1' || v.toLowerCase() === 'true';
}

router.get('/catalog', (_req, res: Response) => {
  res.json({
    products: BILLING_PRODUCTS.map((p) => ({ ...p })),
    currency: 'LKR',
    mockMode: mockPaymentsEnabled(),
  });
});

router.post('/purchase', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!mockPaymentsEnabled()) {
      res.status(501).json({
        message:
          'Payments are not configured. Set MOCK_PAYMENTS=true for demo checkout or integrate PayHere/Stripe.',
      });
      return;
    }

    const { productId } = req.body as { productId?: string };
    if (!productId || !BILLING_PRODUCTS.some((p) => p.id === productId)) {
      res.status(400).json({ message: 'Invalid product' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    const id = productId as BillingProductId;
    if (id === 'image_pack_8') {
      if (user.listingImagePackPurchased) {
        res.status(400).json({ message: 'You already have the photo pack.' });
        return;
      }
      user.listingImagePackPurchased = true;
    } else if (id === 'featured_listing_token') {
      user.featuredTokens = (user.featuredTokens ?? 0) + 1;
    }

    await user.save();

    res.json({
      ok: true,
      productId: id,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        listingImagePackPurchased: user.listingImagePackPurchased,
        featuredTokens: user.featuredTokens ?? 0,
      },
      limits: {
        maxImagesPerListing: maxImagesPerListingForUser(user),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Purchase failed' });
  }
});

export default router;

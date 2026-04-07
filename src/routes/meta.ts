import { Router } from 'express';
import { LISTING_CATEGORIES, LISTING_CURRENCIES } from '../models/Listing';

const router = Router();

router.get('/categories', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600');
  res.json({ categories: [...LISTING_CATEGORIES] });
});

router.get('/currencies', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600');
  res.json({ currencies: [...LISTING_CURRENCIES] });
});

export default router;

import { Router } from 'express';
import { LISTING_CATEGORIES, LISTING_CURRENCIES } from '../models/Listing';

const router = Router();

router.get('/categories', (_req, res) => {
  res.json({ categories: [...LISTING_CATEGORIES] });
});

router.get('/currencies', (_req, res) => {
  res.json({ currencies: [...LISTING_CURRENCIES] });
});

export default router;

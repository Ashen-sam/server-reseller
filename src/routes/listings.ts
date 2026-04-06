import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Listing, LISTING_CATEGORIES, LISTING_CURRENCIES } from '../models/Listing';
import { User } from '../models/User';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';
import { maxImagesPerListingForUser } from '../utils/listingLimits';
import { Types } from 'mongoose';
import { isCloudinaryEnabled, uploadImageBuffer } from '../config/cloudinary';

const router = Router();

function paramId(req: { params: { id?: string | string[] } }): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
}

const useCloudinary = isCloudinaryEnabled();

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!useCloudinary && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
      },
    });

const upload = multer({
  storage,
  limits: { files: 10, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, ok);
  },
});

function publicImageUrl(filename: string): string {
  return `/uploads/${filename}`;
}

async function imageUrlsFromFiles(files: Express.Multer.File[] | undefined): Promise<string[]> {
  if (!files?.length) return [];
  if (useCloudinary) {
    return Promise.all(files.map((f) => uploadImageBuffer(f.buffer, f.mimetype)));
  }
  return files.map((f) => publicImageUrl(f.filename));
}

router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      sort = 'latest',
      page = '1',
      limit = '12',
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (category && LISTING_CATEGORIES.includes(category as (typeof LISTING_CATEGORIES)[number])) {
      filter.category = category;
    }
    if (minPrice !== undefined && minPrice !== '') {
      filter.price = { ...(filter.price as object), $gte: Number(minPrice) };
    }
    if (maxPrice !== undefined && maxPrice !== '') {
      filter.price = { ...(filter.price as object), $lte: Number(maxPrice) };
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (p - 1) * lim;

    let sortSpec: Record<string, 1 | -1> = { featured: -1, createdAt: -1 };
    if (sort === 'popular') sortSpec = { featured: -1, views: -1, createdAt: -1 };

    const [items, total] = await Promise.all([
      Listing.find(filter)
        .sort(sortSpec)
        .skip(skip)
        .limit(lim)
        .populate('seller', 'name email')
        .lean(),
      Listing.countDocuments(filter),
    ]);

    res.json({
      listings: items.map((l) => ({
        ...l,
        id: l._id,
        currency: l.currency || 'USD',
        featured: Boolean(l.featured),
        seller: l.seller
          ? { id: (l.seller as { _id: Types.ObjectId })._id, ...(l.seller as object) }
          : l.seller,
      })),
      total,
      page: p,
      pages: Math.ceil(total / lim) || 1,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load listings' });
  }
});

router.get('/mine', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const listings = await Listing.find({ seller: req.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      listings: listings.map((l) => ({
        ...l,
        id: l._id,
        currency: l.currency || 'USD',
        featured: Boolean(l.featured),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load your listings' });
  }
});

router.get('/dashboard-stats', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const mine = await Listing.find({ seller: req.userId }).lean();
    const listingCount = mine.length;
    const totalViews = mine.reduce((s, l) => s + (l.views || 0), 0);
    const totalContactClicks = mine.reduce((s, l) => s + (l.contactClicks || 0), 0);
    res.json({ listingCount, totalViews, totalContactClicks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = paramId(req);
    if (!Types.ObjectId.isValid(id)) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const listing = await Listing.findById(id).populate('seller', 'name email').lean();
    if (!listing) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const seller = listing.seller as { _id: Types.ObjectId; name?: string; email?: string } | null;
    res.json({
      listing: {
        ...listing,
        id: listing._id,
        currency: listing.currency || 'USD',
        featured: Boolean(listing.featured),
        seller: seller
          ? { id: seller._id, name: seller.name, email: seller.email }
          : null,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load listing' });
  }
});

router.post('/:id/view', async (req, res: Response) => {
  try {
    const id = paramId(req);
    if (!Types.ObjectId.isValid(id)) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const listing = await Listing.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    ).select('views');
    if (!listing) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.json({ views: listing.views });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to record view' });
  }
});

router.post('/:id/contact-click', async (req, res: Response) => {
  try {
    const id = paramId(req);
    if (!Types.ObjectId.isValid(id)) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const listing = await Listing.findByIdAndUpdate(
      id,
      { $inc: { contactClicks: 1 } },
      { new: true }
    ).select('contactClicks');
    if (!listing) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    res.json({ contactClicks: listing.contactClicks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to record click' });
  }
});

router.post('/', requireAuth, upload.array('images', 10), async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      price,
      category,
      currency: currencyRaw,
      phone,
      whatsapp,
      email,
      featured: featuredRaw,
    } = req.body as Record<string, string>;
    if (!title || !description || price === undefined || !category) {
      res.status(400).json({ message: 'Title, description, price, and category are required' });
      return;
    }
    if (!LISTING_CATEGORIES.includes(category as (typeof LISTING_CATEGORIES)[number])) {
      res.status(400).json({ message: 'Invalid category' });
      return;
    }
    const currency = (currencyRaw || 'USD').toUpperCase();
    if (!LISTING_CURRENCIES.includes(currency as (typeof LISTING_CURRENCIES)[number])) {
      res.status(400).json({ message: 'Invalid currency' });
      return;
    }
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      res.status(400).json({ message: 'Invalid price' });
      return;
    }

    const dbUser = await User.findById(req.userId);
    if (!dbUser) {
      res.status(401).json({ message: 'User not found' });
      return;
    }
    const maxImg = maxImagesPerListingForUser(dbUser);
    const files = req.files as Express.Multer.File[] | undefined;
    const fileCount = files?.length ?? 0;
    if (fileCount > maxImg) {
      res.status(400).json({
        message: `You can upload up to ${maxImg} images. Purchase the photo pack for up to 10 photos per product.`,
        maxImagesPerListing: maxImg,
      });
      return;
    }

    let featured = false;
    if (featuredRaw === 'true') {
      const tokens = dbUser.featuredTokens ?? 0;
      if (tokens < 1) {
        res.status(400).json({
          message: 'No featured listing credits. Purchase a featured listing token in Billing.',
        });
        return;
      }
      dbUser.featuredTokens = tokens - 1;
      await dbUser.save();
      featured = true;
    }

    const images = await imageUrlsFromFiles(files);

    const listing = await Listing.create({
      title: title.trim(),
      description: description.trim(),
      price: priceNum,
      currency: currency as (typeof LISTING_CURRENCIES)[number],
      category,
      featured,
      images,
      contact: {
        phone: phone?.trim() || '',
        whatsapp: whatsapp?.trim() || '',
        email: email?.trim() || '',
      },
      seller: req.userId,
    });
    const populated = await Listing.findById(listing._id).populate('seller', 'name email').lean();
    res.status(201).json({
      listing: {
        ...populated!,
        id: populated!._id,
        seller: populated!.seller
          ? {
              id: (populated!.seller as { _id: Types.ObjectId })._id,
              ...(populated!.seller as object),
            }
          : populated!.seller,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to create listing' });
  }
});

router.put(
  '/:id',
  requireAuth,
  upload.array('images', 10),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = paramId(req);
      if (!Types.ObjectId.isValid(id)) {
        res.status(404).json({ message: 'Not found' });
        return;
      }
      const listing = await Listing.findById(id);
      if (!listing) {
        res.status(404).json({ message: 'Not found' });
        return;
      }
      if (listing.seller.toString() !== req.userId) {
        res.status(403).json({ message: 'Not your listing' });
        return;
      }

      const dbUser = await User.findById(req.userId);
      const maxImg = maxImagesPerListingForUser(dbUser);

      const { title, description, price, category, currency: currencyRaw, phone, whatsapp, email, keepImages } =
        req.body as Record<string, string>;
      if (title !== undefined) listing.title = title.trim();
      if (description !== undefined) listing.description = description.trim();
      if (price !== undefined) {
        const priceNum = Number(price);
        if (Number.isNaN(priceNum) || priceNum < 0) {
          res.status(400).json({ message: 'Invalid price' });
          return;
        }
        listing.price = priceNum;
      }
      if (category !== undefined) {
        if (!LISTING_CATEGORIES.includes(category as (typeof LISTING_CATEGORIES)[number])) {
          res.status(400).json({ message: 'Invalid category' });
          return;
        }
        listing.category = category as (typeof LISTING_CATEGORIES)[number];
      }
      if (currencyRaw !== undefined) {
        const c = currencyRaw.toUpperCase();
        if (!LISTING_CURRENCIES.includes(c as (typeof LISTING_CURRENCIES)[number])) {
          res.status(400).json({ message: 'Invalid currency' });
          return;
        }
        listing.currency = c as (typeof LISTING_CURRENCIES)[number];
      }
      if (phone !== undefined) listing.contact.phone = phone.trim();
      if (whatsapp !== undefined) listing.contact.whatsapp = whatsapp.trim();
      if (email !== undefined) listing.contact.email = email.trim();

      const files = req.files as Express.Multer.File[] | undefined;
      if (files && files.length > 0) {
        let existing: string[] = [];
        try {
          existing = keepImages ? JSON.parse(keepImages) : [...listing.images];
        } catch {
          existing = [...listing.images];
        }
        if (existing.length + files.length > maxImg) {
          res.status(400).json({
            message: `Total images cannot exceed ${maxImg} for your plan.`,
            maxImagesPerListing: maxImg,
          });
          return;
        }
        const newUrls = await imageUrlsFromFiles(files);
        listing.images = [...existing, ...newUrls];
      } else if (keepImages !== undefined) {
        try {
          const arr = JSON.parse(keepImages) as string[];
          if (Array.isArray(arr)) {
            if (arr.length > maxImg) {
              res.status(400).json({
                message: `Total images cannot exceed ${maxImg} for your plan.`,
                maxImagesPerListing: maxImg,
              });
              return;
            }
            listing.images = arr;
          }
        } catch {
          /* ignore */
        }
      }

      await listing.save();
      const populated = await Listing.findById(listing._id).populate('seller', 'name email').lean();
      res.json({
        listing: {
          ...populated!,
          id: populated!._id,
          seller: populated!.seller
            ? {
                id: (populated!.seller as { _id: Types.ObjectId })._id,
                ...(populated!.seller as object),
              }
            : populated!.seller,
        },
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: 'Failed to update listing' });
    }
  }
);

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = paramId(req);
    if (!Types.ObjectId.isValid(id)) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    const listing = await Listing.findById(id);
    if (!listing) {
      res.status(404).json({ message: 'Not found' });
      return;
    }
    if (listing.seller.toString() !== req.userId && req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Not allowed' });
      return;
    }
    await listing.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to delete' });
  }
});

export default router;

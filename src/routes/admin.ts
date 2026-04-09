import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User } from '../models/User';
import {
  Listing,
  LISTING_CATEGORIES,
  LISTING_CURRENCIES,
  LISTING_TYPES,
  LISTING_STATUSES,
} from '../models/Listing';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { isCloudinaryEnabled, uploadImageBuffer } from '../config/cloudinary';
import { DEFAULT_ADMIN_EMAIL } from '../utils/seedDefaultAdmin';

const router = Router();

const useCloudinary = isCloudinaryEnabled();
const uploadsDir = path.join(process.cwd(), 'uploads');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 10, fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    cb(null, ok);
  },
});

function publicImageUrl(filename: string): string {
  return `/uploads/${filename}`;
}

async function saveBufferToUploads(buffer: Buffer, originalName: string): Promise<string> {
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const ext = path.extname(originalName) || '.jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  await fs.promises.writeFile(path.join(uploadsDir, filename), buffer);
  return publicImageUrl(filename);
}

async function imageUrlsFromFiles(files: Express.Multer.File[] | undefined): Promise<string[]> {
  if (!files?.length) return [];
  return Promise.all(
    files.map(async (f) => {
      const buf = f.buffer;
      if (!buf?.length) throw new Error('Empty image file');
      if (useCloudinary) return uploadImageBuffer(buf, f.mimetype);
      return saveBufferToUploads(buf, f.originalname || 'image');
    }),
  );
}

router.get('/stats', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const [userCount, listingCount, serviceCount, productCount, viewsAgg] = await Promise.all([
      User.countDocuments(),
      Listing.countDocuments(),
      Listing.countDocuments({ type: 'service' }),
      Listing.countDocuments({ $or: [{ type: 'product' }, { type: { $exists: false } }] }),
      Listing.aggregate<{ total: number }>([
        { $group: { _id: null, total: { $sum: { $ifNull: ['$views', 0] } } } },
      ]),
    ]);
    const totalViews = viewsAgg[0]?.total ?? 0;
    res.json({
      userCount,
      listingCount,
      serviceCount,
      productCount,
      totalViews,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load stats' });
  }
});

router.get('/users', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit).select('-passwordHash').lean(),
      User.countDocuments(),
    ]);
    res.json({
      users: items.map((u) => ({
        id: String(u._id),
        email: u.email,
        name: u.name,
        role: u.role,
        phone: (u as { phone?: string }).phone || '',
        listingImagePackPurchased: Boolean(u.listingImagePackPurchased),
        featuredTokens: u.featuredTokens ?? 0,
        createdAt: u.createdAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load users' });
  }
});

router.post('/users', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
    };
    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ message: 'Name, email, and password are required' });
      return;
    }
    const em = email.trim().toLowerCase();
    if (em === DEFAULT_ADMIN_EMAIL) {
      res.status(409).json({ message: 'This email is reserved for the system administrator' });
      return;
    }
    const exists = await User.findOne({ email: em });
    if (exists) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: em,
      name: name.trim(),
      passwordHash,
      role: 'user',
    });
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone || '',
        listingImagePackPurchased: Boolean(user.listingImagePackPurchased),
        featuredTokens: user.featuredTokens ?? 0,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to create user' });
  }
});

router.get('/listings', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '24'), 10) || 24));
    const skip = (page - 1) * limit;
    const sort = String(req.query.sort || 'latest') === 'popular' ? 'popular' : 'latest';
    const listingQuery = Listing.find();
    if (sort === 'popular') {
      listingQuery.sort({ featured: -1, views: -1, createdAt: -1 });
    } else {
      listingQuery.sort({ featured: -1, createdAt: -1 });
    }

    const [items, total] = await Promise.all([
      listingQuery
        .select('title price currency type status category images featured views contactClicks seller createdAt')
        .skip(skip)
        .limit(limit)
        .populate('seller', 'name email')
        .lean(),
      Listing.countDocuments(),
    ]);

    res.json({
      listings: items.map((l) => ({
        ...l,
        id: l._id,
        currency: l.currency || 'USD',
        type: l.type || 'product',
        status: l.status || 'inStock',
        featured: Boolean(l.featured),
        seller: l.seller
          ? { id: (l.seller as { _id: Types.ObjectId })._id, ...(l.seller as object) }
          : l.seller,
      })),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to load listings' });
  }
});

router.post('/listings', requireAdmin, upload.array('images', 10), async (req: AuthRequest, res: Response) => {
  try {
    const {
      sellerId,
      title,
      description,
      price,
      category,
      type: typeRaw,
      status: statusRaw,
      currency: currencyRaw,
      phone,
      whatsapp,
      email,
      featured: featuredRaw,
    } = req.body as Record<string, string>;

    if (!sellerId || !Types.ObjectId.isValid(sellerId)) {
      res.status(400).json({ message: 'Valid seller (user) ID is required' });
      return;
    }
    const seller = await User.findById(sellerId);
    if (!seller) {
      res.status(404).json({ message: 'Seller user not found' });
      return;
    }

    if (!title || !description || price === undefined || !category) {
      res.status(400).json({ message: 'Title, description, price, and category are required' });
      return;
    }
    if (!LISTING_CATEGORIES.includes(category as (typeof LISTING_CATEGORIES)[number])) {
      res.status(400).json({ message: 'Invalid category' });
      return;
    }
    const listingType = (typeRaw || 'product').toLowerCase();
    if (!LISTING_TYPES.includes(listingType as (typeof LISTING_TYPES)[number])) {
      res.status(400).json({ message: 'Invalid listing type' });
      return;
    }
    const currency = (currencyRaw || 'USD').toUpperCase();
    const listingStatus = (statusRaw || 'inStock').trim();
    if (!LISTING_STATUSES.includes(listingStatus as (typeof LISTING_STATUSES)[number])) {
      res.status(400).json({ message: 'Invalid listing status' });
      return;
    }

    if (!LISTING_CURRENCIES.includes(currency as (typeof LISTING_CURRENCIES)[number])) {
      res.status(400).json({ message: 'Invalid currency' });
      return;
    }
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      res.status(400).json({ message: 'Invalid price' });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;
    const images = await imageUrlsFromFiles(files);
    const featured = featuredRaw === 'true';

    const listing = await Listing.create({
      title: title.trim(),
      description: description.trim(),
      price: priceNum,
      currency: currency as (typeof LISTING_CURRENCIES)[number],
      type: listingType as (typeof LISTING_TYPES)[number],
      status: listingStatus as (typeof LISTING_STATUSES)[number],
      category,
      featured,
      images,
      contact: {
        phone: phone?.trim() || '',
        whatsapp: whatsapp?.trim() || '',
        email: email?.trim() || '',
      },
      seller: sellerId,
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
    console.error('[admin] POST /listings', e);
    res.status(500).json({ message: 'Failed to create listing' });
  }
});

export default router;

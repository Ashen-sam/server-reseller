import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export const LISTING_CATEGORIES = [
  'electronics',
  'fashion',
  'home',
  'sports',
  'vehicles',
  'other',
] as const;

export const LISTING_CURRENCIES = ['USD', 'LKR', 'EUR', 'GBP', 'INR', 'AUD'] as const;
export const LISTING_TYPES = ['product', 'service'] as const;
export const LISTING_STATUSES = ['inStock', 'outOfStock', 'sold'] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];
export type ListingCurrency = (typeof LISTING_CURRENCIES)[number];
export type ListingType = (typeof LISTING_TYPES)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export interface IListing extends Document {
  title: string;
  description: string;
  price: number;
  currency: ListingCurrency;
  type: ListingType;
  status: ListingStatus;
  category: ListingCategory;
  images: string[];
  featured: boolean;
  contact: {
    phone: string;
    whatsapp: string;
    email: string;
  };
  seller: Types.ObjectId;
  views: number;
  contactClicks: number;
  createdAt: Date;
  updatedAt: Date;
}

const listingSchema = new Schema<IListing>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 10000 },
    price: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      enum: LISTING_CURRENCIES,
      default: 'USD',
    },
    type: {
      type: String,
      enum: LISTING_TYPES,
      default: 'product',
    },
    status: {
      type: String,
      enum: LISTING_STATUSES,
      default: 'inStock',
    },
    category: {
      type: String,
      required: true,
      enum: LISTING_CATEGORIES,
    },
    featured: { type: Boolean, default: false },
    images: [{ type: String }],
    contact: {
      phone: { type: String, default: '' },
      whatsapp: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    seller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    views: { type: Number, default: 0 },
    contactClicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

listingSchema.index({ category: 1, price: 1 });
listingSchema.index({ createdAt: -1 });
listingSchema.index({ views: -1 });
listingSchema.index({ featured: -1, createdAt: -1 });
/** Popular sort: featured → views → recency */
listingSchema.index({ featured: -1, views: -1, createdAt: -1 });
listingSchema.index({ seller: 1, createdAt: -1 });
listingSchema.index({ seller: 1 });

export const Listing: Model<IListing> =
  mongoose.models.Listing || mongoose.model<IListing>('Listing', listingSchema);

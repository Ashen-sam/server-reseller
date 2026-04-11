import mongoose, { Schema, Document, Model } from 'mongoose';
import { AVATAR_STYLES, type AvatarStyle } from '../constants/avatarStyles';

export type UserRole = 'user' | 'admin';

export interface IUser extends Document {
  email: string;
  /** Empty for Clerk-only accounts; set for legacy email/password users. */
  passwordHash: string;
  /** Clerk user id (`sub` in session JWT) when using Clerk. */
  clerkUserId?: string;
  name: string;
  phone?: string;
  avatarStyle: AvatarStyle;
  role: UserRole;
  /** One-time unlock: more images per listing (see billing constants). */
  listingImagePackPurchased: boolean;
  /** Spend one when publishing a featured listing. */
  featuredTokens: number;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: '' },
    clerkUserId: { type: String, unique: true, sparse: true, trim: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: '' },
    avatarStyle: { type: String, enum: AVATAR_STYLES, default: 'avataaars' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    listingImagePackPurchased: { type: Boolean, default: false },
    featuredTokens: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

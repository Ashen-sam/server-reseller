import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'user' | 'admin';

export interface IUser extends Document {
  clerkUserId?: string | null;
  email: string;
  passwordHash?: string;
  name: string;
  role: UserRole;
  authProvider: 'local' | 'google';
  emailVerified: boolean;
  emailVerifyTokenHash?: string | null;
  emailVerifyExpiresAt?: Date | null;
  /** One-time unlock: more images per listing (see billing constants). */
  listingImagePackPurchased: boolean;
  /** Spend one when publishing a featured listing. */
  featuredTokens: number;
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    clerkUserId: { type: String, unique: true, sparse: true, trim: true, default: null },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    emailVerified: { type: Boolean, default: false },
    emailVerifyTokenHash: { type: String, default: null },
    emailVerifyExpiresAt: { type: Date, default: null },
    listingImagePackPurchased: { type: Boolean, default: false },
    featuredTokens: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

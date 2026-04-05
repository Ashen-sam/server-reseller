import type { IUser } from '../models/User';
import { FREE_MAX_IMAGES_PER_LISTING, PAID_MAX_IMAGES_PER_LISTING } from '../constants/billing';

export function maxImagesPerListingForUser(user: IUser | null): number {
  if (!user) return FREE_MAX_IMAGES_PER_LISTING;
  if (user.role === 'admin') return PAID_MAX_IMAGES_PER_LISTING;
  return user.listingImagePackPurchased ? PAID_MAX_IMAGES_PER_LISTING : FREE_MAX_IMAGES_PER_LISTING;
}

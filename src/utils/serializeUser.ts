import type { IUser } from '../models/User';
import { maxImagesPerListingForUser } from './listingLimits';
import {
  BILLING_PRODUCTS,
  FREE_MAX_IMAGES_PER_LISTING,
  IMAGE_PACK_10_PRICE_LKR,
  FEATURED_LISTING_TOKEN_PRICE_LKR,
} from '../constants/billing';

export function publicUserFields(user: IUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone || '',
    avatarStyle: user.avatarStyle || 'avataaars',
    role: user.role,
    listingImagePackPurchased: Boolean(user.listingImagePackPurchased),
    featuredTokens: user.featuredTokens ?? 0,
  };
}

export function limitsPayload(user: IUser) {
  return {
    maxImagesPerListing: maxImagesPerListingForUser(user),
    freeMaxImages: FREE_MAX_IMAGES_PER_LISTING,
    imagePackPriceLkr: IMAGE_PACK_10_PRICE_LKR,
    featuredTokenPriceLkr: FEATURED_LISTING_TOKEN_PRICE_LKR,
    products: BILLING_PRODUCTS.map((p) => ({ ...p })),
  };
}

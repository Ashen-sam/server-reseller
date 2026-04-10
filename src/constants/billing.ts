/** LKR amounts — swap for real gateway (PayHere, Stripe) later */
export const IMAGE_PACK_PRICE_LKR = 150;
/** @deprecated Use IMAGE_PACK_PRICE_LKR */
export const IMAGE_PACK_10_PRICE_LKR = IMAGE_PACK_PRICE_LKR;
export const FEATURED_LISTING_TOKEN_PRICE_LKR = 199;

export const FREE_MAX_IMAGES_PER_LISTING = 3;
export const PAID_MAX_IMAGES_PER_LISTING = 8;

export const BILLING_PRODUCTS = [
  {
    id: 'image_pack_8',
    name: 'Up to 8 product photos',
    description: 'Unlock 8 images per listing (free tier: 3 photos).',
    priceLkr: IMAGE_PACK_PRICE_LKR,
  },
  {
    id: 'featured_listing_token',
    name: 'Featured listing (1×)',
    description: 'One listing appears at the top of the marketplace until newer featured ads appear.',
    priceLkr: FEATURED_LISTING_TOKEN_PRICE_LKR,
  },
] as const;

export type BillingProductId = (typeof BILLING_PRODUCTS)[number]['id'];

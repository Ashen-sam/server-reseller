export const AVATAR_STYLES = [
  'adventurer',
  'avataaars',
  'bottts',
  'identicon',
  'lorelei',
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number];


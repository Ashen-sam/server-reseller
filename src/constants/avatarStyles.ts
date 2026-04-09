export const AVATAR_STYLES = [
  'avataaars',
  'adventurer',
  'adventurer-neutral',
  'lorelei',
  'lorelei-neutral',
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number];


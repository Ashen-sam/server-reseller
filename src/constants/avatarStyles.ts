export const AVATAR_STYLES = [
  'personas',
  'initials',
  'micah',
  'identicon',
  'shapes',
] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number];


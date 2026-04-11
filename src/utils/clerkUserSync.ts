import { createClerkClient } from '@clerk/backend';
import { User, IUser } from '../models/User';
import { DEFAULT_ADMIN_EMAIL } from './seedDefaultAdmin';

function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function displayNameFromClerk(cu: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}): string {
  const n = [cu.firstName, cu.lastName].filter(Boolean).join(' ').trim();
  if (n) return n;
  if (cu.username?.trim()) return cu.username.trim();
  return 'User';
}

/**
 * Loads or creates the MongoDB user for a Clerk `userId` (JWT `sub`).
 * Links an existing row by primary email when `clerkUserId` was not set yet.
 */
export async function findOrCreateUserFromClerkId(clerkUserId: string): Promise<IUser | null> {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) return null;

  const existingByClerk = await User.findOne({ clerkUserId }).select('-passwordHash');
  if (existingByClerk) return existingByClerk;

  const clerk = createClerkClient({ secretKey: secret });
  let cu: Awaited<ReturnType<typeof clerk.users.getUser>>;
  try {
    cu = await clerk.users.getUser(clerkUserId);
  } catch (e) {
    console.error('[clerk] users.getUser failed:', e);
    return null;
  }

  const primaryId = cu.primaryEmailAddressId;
  const emailObj =
    cu.emailAddresses?.find((e) => e.id === primaryId) ?? cu.emailAddresses?.[0];
  const email = emailObj?.emailAddress?.toLowerCase().trim();
  if (!email) {
    console.error('[clerk] user has no email:', clerkUserId);
    return null;
  }

  const admins = adminEmails();
  const role: 'user' | 'admin' =
    admins.has(email) || email === DEFAULT_ADMIN_EMAIL ? 'admin' : 'user';
  const name = displayNameFromClerk(cu);

  const byEmail = await User.findOne({ email });
  if (byEmail) {
    if (byEmail.clerkUserId && byEmail.clerkUserId !== clerkUserId) {
      console.error('[clerk] email already linked to another Clerk user:', email);
      return null;
    }
    byEmail.clerkUserId = clerkUserId;
    if (!byEmail.name?.trim()) byEmail.name = name;
    byEmail.role = role;
    await byEmail.save();
    const linked = await User.findById(byEmail._id).select('-passwordHash').exec();
    return linked;
  }

  const created = await User.create({
    email,
    name,
    clerkUserId,
    passwordHash: '',
    role,
  });
  const fresh = await User.findById(created._id).select('-passwordHash').exec();
  return fresh;
}

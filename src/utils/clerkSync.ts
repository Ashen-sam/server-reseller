import { createClerkClient } from '@clerk/backend';
import { User, type IUser } from '../models/User';

function clerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set');
  return createClerkClient({ secretKey });
}

function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function ensureMongoUserFromClerk(clerkUserId: string): Promise<IUser | null> {
  if (!clerkUserId) return null;

  let local = await User.findOne({ clerkUserId });
  if (local) return local;

  let user;
  try {
    user = await clerkClient().users.getUser(clerkUserId);
  } catch {
    return null;
  }
  const primary = user.primaryEmailAddressId
    ? user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
    : user.emailAddresses[0];
  const email = (primary?.emailAddress || '').trim().toLowerCase();
  if (!email) return null;

  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'User';

  local = await User.findOne({ email });
  if (local) {
    if (!local.clerkUserId) local.clerkUserId = clerkUserId;
    local.authProvider = 'google';
    local.emailVerified = true;
    if (!local.name) local.name = name;
    await local.save();
    return local;
  }

  const role = adminEmails().has(email) ? 'admin' : 'user';
  return User.create({
    clerkUserId,
    email,
    name,
    role,
    authProvider: 'google',
    emailVerified: true,
    passwordHash: '',
  });
}

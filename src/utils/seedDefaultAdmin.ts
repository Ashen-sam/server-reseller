import bcrypt from 'bcryptjs';
import { User } from '../models/User';

/** Single system administrator (seeded on startup). */
export const DEFAULT_ADMIN_EMAIL = 'admin9090@ad.com';
export const DEFAULT_ADMIN_PASSWORD = 'admin123';
export const DEFAULT_ADMIN_NAME = 'Admin';

/**
 * Ensures the default admin account exists and is the only user with role `admin`.
 */
export async function ensureDefaultAdmin(): Promise<void> {
  try {
    const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    let admin = await User.findOne({ email: DEFAULT_ADMIN_EMAIL });

    if (!admin) {
      await User.create({
        email: DEFAULT_ADMIN_EMAIL,
        passwordHash: hash,
        name: DEFAULT_ADMIN_NAME,
        role: 'admin',
      });
      console.log(`[seed] Created default admin: ${DEFAULT_ADMIN_EMAIL}`);
    } else {
      admin.role = 'admin';
      admin.passwordHash = hash;
      admin.name = admin.name || DEFAULT_ADMIN_NAME;
      await admin.save();
      console.log(`[seed] Default admin ready: ${DEFAULT_ADMIN_EMAIL}`);
    }

    const demoted = await User.updateMany(
      { role: 'admin', email: { $ne: DEFAULT_ADMIN_EMAIL } },
      { $set: { role: 'user' } },
    );
    if (demoted.modifiedCount > 0) {
      console.log(`[seed] Demoted ${demoted.modifiedCount} extra admin(s) to user (single-admin policy).`);
    }
  } catch (e) {
    console.error('[seed] ensureDefaultAdmin failed:', e);
  }
}

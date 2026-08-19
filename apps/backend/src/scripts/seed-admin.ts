/**
 * Promotes an already-registered user to the 'admin' role, by email. The bootstrapping story for
 * the very first admin: registration always creates a plain 'user' (§ auth.service.ts), and there
 * is deliberately no API route that can grant admin access to yourself or anyone else — that would
 * be a privilege-escalation hole. This script requires direct server/CLI access instead.
 *
 * Usage: npm run seed:admin -- someone@example.com
 */
import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../db/mongoose.js';
import { logger } from '../common/logger/logger.js';
import { UserModel } from '../modules/auth/user.model.js';

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    // eslint-disable-next-line no-console
    console.error('Usage: npm run seed:admin -- <email>');
    process.exit(1);
  }

  await connectDatabase();
  const user = await UserModel.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    logger.error({ email }, 'no user with this email — register the account first, then re-run this script');
    await disconnectDatabase();
    process.exit(1);
  }

  user.role = 'admin';
  await user.save();
  logger.info({ email: user.email }, 'user promoted to admin');
  await disconnectDatabase();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to promote user to admin', err);
  process.exit(1);
});

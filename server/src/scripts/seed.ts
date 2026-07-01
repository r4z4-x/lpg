import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { seedAccounts } from '../services/account.service';
import { seedOwner } from '../services/user.service';
import { seedCylinderTypes } from '../services/cylinderType.service';
import { seedPaymentAccounts } from '../services/paymentAccount.service';
import { seedExpenseCategories } from '../services/expense.service';
import { getSettings } from '../services/companySettings.service';

async function run(): Promise<void> {
  await connectDB(env.MONGODB_URI);
  await seedAccounts();
  await seedOwner();
  await getSettings(); // create default company settings
  await seedCylinderTypes();
  await seedPaymentAccounts();
  await seedExpenseCategories();
  await disconnectDB();
}

run().catch((err) => {
  logger.error('Seed failed', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

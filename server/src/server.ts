import { createApp } from './app';
import { connectDB, disconnectDB } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { seedAccounts } from './services/account.service';
import { seedOwner } from './services/user.service';
import { seedCylinderTypes } from './services/cylinderType.service';
import { seedPaymentAccounts } from './services/paymentAccount.service';
import { seedExpenseCategories } from './services/expense.service';
import { getSettings } from './services/companySettings.service';

async function main(): Promise<void> {
  await connectDB(env.MONGODB_URI);
  await seedAccounts();
  await seedOwner();
  await getSettings();
  await seedCylinderTypes();
  await seedPaymentAccounts();
  await seedExpenseCategories();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`, { env: env.NODE_ENV });
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down`);
    server.close();
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal startup error', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

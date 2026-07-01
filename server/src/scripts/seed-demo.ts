/**
 * Demo seed — populates a realistic, ready-to-show business on top of the base seed.
 * Idempotent: base reference data is upserted; demo business data is only created on a
 * fresh database (skipped if vendors already exist) and opening balances are skipped if
 * already locked.
 *
 *   npm run seed:demo
 */
import { connectDB, disconnectDB } from '../config/db';
import { env } from '../config/env';
import { logger } from '../config/logger';

import { seedAccounts } from '../services/account.service';
import { seedOwner, createUser } from '../services/user.service';
import { getSettings } from '../services/companySettings.service';
import { seedCylinderTypes } from '../services/cylinderType.service';
import { seedPaymentAccounts } from '../services/paymentAccount.service';
import { seedExpenseCategories } from '../services/expense.service';
import { postOpeningBalances } from '../services/openingBalance.service';
import { createVendor } from '../services/vendor.service';
import { createPurchase } from '../services/purchase.service';
import { createCustomer } from '../services/customer.service';
import { createSale } from '../services/sale.service';
import { createExpense } from '../services/expense.service';

import { User } from '../models/user.model';
import { Vendor } from '../models/vendor.model';
import { PaymentAccount } from '../models/paymentAccount.model';
import { CylinderType } from '../models/cylinderType.model';

async function run(): Promise<void> {
  await connectDB(env.MONGODB_URI);

  // --- Base reference data (idempotent) ---
  await seedAccounts();
  await seedOwner();
  await getSettings();
  await seedCylinderTypes();
  await seedPaymentAccounts();
  await seedExpenseCategories();

  const owner = await User.findOne({ role: 'Owner' });
  const ownerId = String(owner!._id);

  // A demo Operator (for the RBAC part of the demo).
  if (!(await User.findOne({ email: 'operator@example.com' }))) {
    await createUser({
      name: 'Front Desk',
      email: 'operator@example.com',
      password: 'operator123',
      role: 'Operator',
    });
    logger.info('Demo operator created', { email: 'operator@example.com' });
  }

  // Only build demo business data on a fresh database.
  if ((await Vendor.countDocuments()) > 0) {
    logger.info('Demo business data already present — skipping');
    await disconnectDB();
    return;
  }

  const cash = await PaymentAccount.findOne({ type: 'Cash' });
  const cashId = String(cash!._id);
  const cylType = (await CylinderType.findOne({ name: 'Domestic Standard' })) ?? (await CylinderType.findOne());
  const cylTypeId = String(cylType!._id);

  // --- Opening balances (skip if already locked) ---
  const settings = await getSettings();
  if (!settings.openingLocked) {
    await postOpeningBalances(
      {
        paymentAccounts: [{ accountId: cashId, amount: '100000' }],
        gas: { kg: '1000', value: '250000' }, // opening WAC = 250.00 / kg
        cylinders: [{ cylinderTypeId: cylTypeId, filled: 100, empty: 50, shellAssetValue: '50000' }],
      },
      ownerId,
    );
    logger.info('Opening balances posted');
  }

  // --- A vendor + a purchase (blends WAC toward ~246.67) ---
  const vendor = await createVendor({ name: 'Sui Gas Co', contact: '0300-1234567' }, ownerId);
  await createPurchase(
    { vendorId: String(vendor._id), qtyKg: '500', ratePerKg: '230', transport: '5000', paymentType: 'full', paymentAccountId: cashId },
    ownerId,
  );

  // --- Customers ---
  const walkIn = await createCustomer({ name: 'Walk-in Customer' }, ownerId);
  const oldDebtor = await createCustomer({ name: 'Old Debtor', openingReceivable: '10000' }, ownerId);
  const newHotel = await createCustomer({ name: 'New Hotel', creditLimit: '50000' }, ownerId);

  // --- Sample sales (priced above WAC ~246.67 so margins are healthy) ---
  await createSale(
    {
      customerId: String(walkIn._id),
      customerType: 'exchange',
      cylinderTypeId: cylTypeId,
      cylinderCount: 1,
      qtyKg: '50',
      saleRate: '300',
      charges: [{ name: 'Delivery', amount: '200' }],
      discount: '100',
      paymentType: 'full',
      paymentAccountId: cashId,
    },
    ownerId,
  );
  await createSale(
    {
      customerId: String(newHotel._id),
      customerType: 'exchange',
      cylinderTypeId: cylTypeId,
      cylinderCount: 1,
      qtyKg: '100',
      saleRate: '310',
      paymentType: 'full',
      paymentAccountId: cashId,
    },
    ownerId,
  );
  await createSale(
    {
      customerId: String(walkIn._id),
      customerType: 'exchange',
      cylinderTypeId: cylTypeId,
      cylinderCount: 1,
      qtyKg: '75',
      saleRate: '308',
      charges: [{ name: 'Delivery', amount: '150' }],
      paymentType: 'full',
      paymentAccountId: cashId,
    },
    ownerId,
  );
  // Demonstrates previous-balance recovery: clears Old Debtor's 10,000 without inflating revenue.
  await createSale(
    {
      customerId: String(oldDebtor._id),
      customerType: 'exchange',
      cylinderTypeId: cylTypeId,
      cylinderCount: 1,
      qtyKg: '25',
      saleRate: '300',
      paymentType: 'full',
      previousBalanceRecovery: '10000',
      paymentAccountId: cashId,
    },
    ownerId,
  );

  // --- Sample expenses (kept below gross profit so net profit stays positive) ---
  await createExpense({ category: 'Fuel', amount: '5000', paymentAccountId: cashId }, ownerId);
  await createExpense({ category: 'Salary', amount: '3000', paymentAccountId: cashId }, ownerId);

  logger.info('Demo business data seeded', {
    owner: 'owner@example.com / changeme123',
    operator: 'operator@example.com / operator123',
  });

  await disconnectDB();
}

run().catch((err) => {
  logger.error('Demo seed failed', { err: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

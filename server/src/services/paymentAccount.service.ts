import { Types } from 'mongoose';
import { PaymentAccount, type PaymentAccountType } from '../models/paymentAccount.model';
import { Money } from '../utils/money';
import { ConflictError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';

export interface CreatePaymentAccountInput {
  name: string;
  type: PaymentAccountType;
  openingBalance?: string; // human money
}

export async function createPaymentAccount(input: CreatePaymentAccountInput) {
  const exists = await PaymentAccount.findOne({ name: input.name.trim() });
  if (exists) throw new ConflictError('Payment account name already exists', 'NAME_TAKEN');
  const openingMinor = input.openingBalance
    ? Money.fromMajor(input.openingBalance).toMinorNumber()
    : 0;
  return PaymentAccount.create({
    name: input.name.trim(),
    type: input.type,
    openingBalanceMinor: openingMinor,
    currentBalanceMinor: openingMinor,
  });
}

export function listPaymentAccounts() {
  return PaymentAccount.find().sort({ name: 1 });
}

export async function getPaymentAccount(id: string | Types.ObjectId) {
  const acc = await PaymentAccount.findById(id);
  if (!acc) throw new NotFoundError('Payment account not found');
  return acc;
}

/** Seeds the default Cash and Bank accounts (Q5). Idempotent by name. */
export async function seedPaymentAccounts(): Promise<void> {
  const defaults: { name: string; type: PaymentAccountType }[] = [
    { name: 'Cash', type: 'Cash' },
    { name: 'Bank', type: 'Bank' },
  ];
  for (const d of defaults) {
    await PaymentAccount.updateOne(
      { name: d.name },
      { $setOnInsert: { name: d.name, type: d.type, openingBalanceMinor: 0, currentBalanceMinor: 0, isActive: true } },
      { upsert: true },
    );
  }
  logger.info('Payment accounts seeded', { count: defaults.length });
}

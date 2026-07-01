import { CHART_OF_ACCOUNTS } from '../constants/accounts';
import { Account } from '../models/account.model';
import { logger } from '../config/logger';

/**
 * Idempotently seeds the chart of accounts. Safe to run repeatedly — existing accounts
 * are updated in place (no duplicates), missing ones are created.
 */
export async function seedAccounts(): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  for (const acc of CHART_OF_ACCOUNTS) {
    const res = await Account.updateOne(
      { code: acc.code },
      {
        $set: {
          name: acc.name,
          type: acc.type,
          normalSide: acc.normalSide,
          isContra: acc.isContra ?? false,
        },
        $setOnInsert: { isActive: true },
      },
      { upsert: true },
    );
    if (res.upsertedCount) created += 1;
    else if (res.modifiedCount) updated += 1;
  }
  logger.info('Chart of accounts seeded', { created, updated, total: CHART_OF_ACCOUNTS.length });
  return { created, updated };
}

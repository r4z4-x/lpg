import { withTransaction } from '../utils/transaction';
import { Money } from '../utils/money';
import { Quantity } from '../utils/quantity';
import { toBusinessDate } from '../utils/businessDay';
import { ConflictError, NotFoundError } from '../utils/errors';
import { PaymentAccount, ledgerCodeForAccountType } from '../models/paymentAccount.model';
import { getSettings } from './companySettings.service';
import * as costing from './costing.service';
import * as inventory from './inventory.service';
import * as ledger from './ledger.service';
import * as audit from './audit.service';
import type { LedgerLineInput } from './ledger.service';

export interface OpeningBalanceInput {
  paymentAccounts?: { accountId: string; amount: string }[];
  gas?: { kg: string; value: string };
  cylinders?: { cylinderTypeId: string; filled: number; empty: number; shellAssetValue?: string }[];
}

/**
 * Posts opening balances once: cash/bank, gas stock (sets opening WAC) and cylinder shells,
 * all credited to Opening Balance Equity (3020) in a single balanced ledger entry. Per-party
 * opening receivables/payables are handled when customers/vendors are created (M4/M5).
 */
export async function postOpeningBalances(input: OpeningBalanceInput, userId: string) {
  return withTransaction(async (session) => {
    const settings = await getSettings(session);
    if (settings.openingLocked) {
      throw new ConflictError('Opening balances have already been posted', 'OPENING_LOCKED');
    }

    const lines: LedgerLineInput[] = [];
    let totalDebit = 0n;

    // Cash / bank accounts.
    for (const pa of input.paymentAccounts ?? []) {
      const account = await PaymentAccount.findById(pa.accountId).session(session);
      if (!account) throw new NotFoundError(`Payment account ${pa.accountId} not found`);
      const amountMinor = Money.fromMajor(pa.amount).toMinorNumber();
      account.openingBalanceMinor = amountMinor;
      account.currentBalanceMinor = amountMinor;
      await account.save({ session });
      if (amountMinor > 0) {
        lines.push({ accountCode: ledgerCodeForAccountType(account.type), debitMinor: amountMinor });
        totalDebit += BigInt(amountMinor);
      }
    }

    // Gas stock (sets opening WAC).
    if (input.gas) {
      const value = Money.fromMajor(input.gas.value);
      await costing.setOpening(Quantity.fromKg(input.gas.kg), value, session);
      const valueMinor = value.toMinorNumber();
      if (valueMinor > 0) {
        lines.push({ accountCode: '1200', debitMinor: valueMinor });
        totalDebit += BigInt(valueMinor);
      }
    }

    // Cylinder shells (steel asset value only).
    let cylinderValue = 0n;
    for (const c of input.cylinders ?? []) {
      const shellValueMinor = c.shellAssetValue
        ? Money.fromMajor(c.shellAssetValue).toMinorNumber()
        : 0;
      await inventory.setOpening(
        c.cylinderTypeId,
        { filled: c.filled, empty: c.empty, shellAssetValueMinor: shellValueMinor },
        session,
      );
      cylinderValue += BigInt(shellValueMinor);
    }
    if (cylinderValue > 0n) {
      lines.push({ accountCode: '1300', debitMinor: Number(cylinderValue) });
      totalDebit += cylinderValue;
    }

    // Balancing credit to Opening Balance Equity.
    if (totalDebit > 0n) {
      lines.push({ accountCode: '3020', creditMinor: Number(totalDebit) });
      await ledger.post(
        {
          date: new Date(),
          businessDate: toBusinessDate(new Date(), settings.businessTimezone),
          sourceType: 'Opening',
          memo: 'Opening balances',
          createdBy: userId,
          lines,
        },
        session,
      );
    }

    settings.openingLocked = true;
    await settings.save({ session });

    await audit.record(
      { userId, action: 'create', entity: 'OpeningBalance', newValue: input },
      session,
    );

    return { locked: true, totalDebitMinor: Number(totalDebit) };
  });
}

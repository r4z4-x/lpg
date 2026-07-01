import { CashClosing } from '../models/cashClosing.model';
import { PaymentAccount, ledgerCodeForAccountType } from '../models/paymentAccount.model';
import { Money } from '../utils/money';
import { withTransaction } from '../utils/transaction';
import { toBusinessDate } from '../utils/businessDay';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { getSettings } from './companySettings.service';
import * as ledger from './ledger.service';
import * as audit from './audit.service';
import type { LedgerLineInput } from './ledger.service';

export interface CashMovementInput {
  paymentAccountId: string;
  direction: 'in' | 'out';
  amount: string;
  note?: string;
  date?: string;
}

/**
 * Manual cash movement not tied to a sale/purchase. `in` = owner capital injection
 * (Cr Owner Capital); `out` = owner drawings (Dr Owner Drawings).
 */
export async function cashMovement(input: CashMovementInput, userId: string) {
  return withTransaction(async (session) => {
    const account = await PaymentAccount.findById(input.paymentAccountId).session(session);
    if (!account) throw new NotFoundError('Payment account not found');
    const amount = Money.fromMajor(input.amount);
    if (!amount.isPositive()) throw new ValidationError('Amount must be positive');

    const settings = await getSettings(session);
    const date = input.date ? new Date(input.date) : new Date();
    const code = ledgerCodeForAccountType(account.type);
    const amt = amount.toMinorNumber();

    const lines: LedgerLineInput[] =
      input.direction === 'in'
        ? [
            { accountCode: code, debitMinor: amt },
            { accountCode: '3010', creditMinor: amt }, // Owner Capital
          ]
        : [
            { accountCode: '3040', debitMinor: amt }, // Owner Drawings
            { accountCode: code, creditMinor: amt },
          ];

    const entry = await ledger.post(
      {
        date,
        businessDate: toBusinessDate(date, settings.businessTimezone),
        sourceType: 'Payment',
        memo: input.note ?? `Cash ${input.direction}`,
        createdBy: userId,
        lines,
      },
      session,
    );

    account.currentBalanceMinor += input.direction === 'in' ? amt : -amt;
    await account.save({ session });

    await audit.record(
      { userId, action: 'create', entity: 'CashMovement', entityId: entry._id, newValue: input },
      session,
    );
    return { ledgerEntryId: entry._id, balanceMinor: account.currentBalanceMinor };
  });
}

export interface CloseDayInput {
  paymentAccountId: string;
  businessDate: string;
  actualCash: string;
}

/**
 * Daily cash closing: compares the system (expected) balance to the counted (actual) cash
 * and posts the variance — shortage to Cash Short (6080), overage to Cash Over (4040) —
 * leaving the account equal to the counted amount.
 */
export async function closeDay(input: CloseDayInput, userId: string) {
  return withTransaction(async (session) => {
    const account = await PaymentAccount.findById(input.paymentAccountId).session(session);
    if (!account) throw new NotFoundError('Payment account not found');

    const existing = await CashClosing.findOne({
      businessDate: input.businessDate,
      paymentAccountId: account._id,
    }).session(session);
    if (existing) throw new ConflictError('Day already closed for this account', 'ALREADY_CLOSED');

    const expected = account.currentBalanceMinor;
    const actual = Money.fromMajor(input.actualCash).toMinorNumber();
    const variance = actual - expected; // + overage, - shortage

    const code = ledgerCodeForAccountType(account.type);
    let ledgerEntryId = null;

    if (variance !== 0) {
      const lines: LedgerLineInput[] =
        variance > 0
          ? [
              { accountCode: code, debitMinor: variance },
              { accountCode: '4040', creditMinor: variance }, // Cash Over (income)
            ]
          : [
              { accountCode: '6080', debitMinor: -variance }, // Cash Short (expense)
              { accountCode: code, creditMinor: -variance },
            ];
      const entry = await ledger.post(
        {
          date: new Date(),
          businessDate: input.businessDate,
          sourceType: 'Closing',
          memo: `Daily cash closing (${variance > 0 ? 'overage' : 'shortage'})`,
          createdBy: userId,
          lines,
        },
        session,
      );
      ledgerEntryId = entry._id;
      account.currentBalanceMinor = actual;
      await account.save({ session });
    }

    const [closing] = await CashClosing.create(
      [
        {
          businessDate: input.businessDate,
          paymentAccountId: account._id,
          expectedCashMinor: expected,
          actualCashMinor: actual,
          varianceMinor: variance,
          ledgerEntryId,
          closedBy: userId,
        },
      ],
      { session },
    );

    await audit.record(
      { userId, action: 'create', entity: 'CashClosing', entityId: closing!._id, newValue: input },
      session,
    );
    return closing!;
  });
}

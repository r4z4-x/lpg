import { type ClientSession, Types } from 'mongoose';
import { LedgerEntry } from '../models/ledgerEntry.model';
import { Counter } from '../models/counter.model';
import { ValidationError, NotFoundError } from '../utils/errors';

export type SourceType =
  | 'Sale'
  | 'Purchase'
  | 'Payment'
  | 'Expense'
  | 'Adjustment'
  | 'Return'
  | 'Opening'
  | 'Closing'
  | 'Reversal';

export interface LedgerLineInput {
  accountCode: string;
  /** Minor units (paisa). Provide debit OR credit, not both. */
  debitMinor?: number;
  creditMinor?: number;
  partyType?: 'Customer' | 'Vendor' | null;
  partyId?: Types.ObjectId | string | null;
}

export interface PostEntryInput {
  date: Date;
  businessDate: string;
  sourceType: SourceType;
  sourceId?: Types.ObjectId | string | null;
  memo?: string;
  lines: LedgerLineInput[];
  createdBy: Types.ObjectId | string;
  reversalOf?: Types.ObjectId | string | null;
}

const ENTRY_COUNTER_ID = 'ledgerEntryNo';

async function nextEntryNo(session: ClientSession): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    ENTRY_COUNTER_ID,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );
  return counter!.seq;
}

/** Validates balance + line integrity, then appends an immutable journal entry. */
export async function post(input: PostEntryInput, session: ClientSession) {
  if (!input.lines || input.lines.length < 2) {
    throw new ValidationError('A ledger entry requires at least 2 lines');
  }

  let totalDebit = 0n;
  let totalCredit = 0n;

  for (const line of input.lines) {
    const debit = BigInt(line.debitMinor ?? 0);
    const credit = BigInt(line.creditMinor ?? 0);
    if (debit < 0n || credit < 0n) {
      throw new ValidationError('Ledger amounts must be non-negative');
    }
    if (debit > 0n && credit > 0n) {
      throw new ValidationError('A ledger line cannot carry both a debit and a credit');
    }
    if (debit === 0n && credit === 0n) {
      throw new ValidationError('A ledger line must carry either a debit or a credit');
    }
    totalDebit += debit;
    totalCredit += credit;
  }

  if (totalDebit !== totalCredit) {
    throw new ValidationError(
      `Unbalanced entry: debit ${totalDebit} != credit ${totalCredit} (minor units)`,
    );
  }

  const entryNo = await nextEntryNo(session);

  const [doc] = await LedgerEntry.create(
    [
      {
        entryNo,
        date: input.date,
        businessDate: input.businessDate,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        memo: input.memo ?? '',
        lines: input.lines.map((l) => ({
          accountCode: l.accountCode,
          debitMinor: l.debitMinor ?? 0,
          creditMinor: l.creditMinor ?? 0,
          partyType: l.partyType ?? null,
          partyId: l.partyId ?? null,
        })),
        totalDebitMinor: Number(totalDebit),
        totalCreditMinor: Number(totalCredit),
        reversalOf: input.reversalOf ?? null,
        createdBy: input.createdBy,
      },
    ],
    { session },
  );

  return doc!;
}

/** All ledger entries that reference a given party (customer/vendor) on any line. */
export function entriesForParty(partyId: Types.ObjectId | string) {
  return LedgerEntry.find({ 'lines.partyId': partyId }).sort({ date: 1, entryNo: 1 });
}

export interface TrialBalanceRow {
  accountCode: string;
  debitMinor: number;
  creditMinor: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebitMinor: number;
  totalCreditMinor: number;
  balanced: boolean;
}

/**
 * Aggregates all ledger lines per account into a trial balance. Because every posted
 * entry is itself balanced, a correct ledger always returns balanced === true.
 */
export async function trialBalance(): Promise<TrialBalance> {
  const grouped = await LedgerEntry.aggregate<{
    _id: string;
    debitMinor: number;
    creditMinor: number;
  }>([
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountCode',
        debitMinor: { $sum: '$lines.debitMinor' },
        creditMinor: { $sum: '$lines.creditMinor' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const rows: TrialBalanceRow[] = grouped.map((r) => ({
    accountCode: r._id,
    debitMinor: r.debitMinor,
    creditMinor: r.creditMinor,
  }));
  const totalDebitMinor = rows.reduce((s, r) => s + r.debitMinor, 0);
  const totalCreditMinor = rows.reduce((s, r) => s + r.creditMinor, 0);

  return {
    rows,
    totalDebitMinor,
    totalCreditMinor,
    balanced: totalDebitMinor === totalCreditMinor,
  };
}

/** Posts a mirror entry (debits/credits swapped) that reverses an existing entry. */
export async function reverse(
  entryId: Types.ObjectId | string,
  createdBy: Types.ObjectId | string,
  session: ClientSession,
  opts?: { date?: Date; businessDate?: string; memo?: string },
) {
  const original = await LedgerEntry.findById(entryId).session(session);
  if (!original) throw new NotFoundError('Ledger entry to reverse not found');

  return post(
    {
      date: opts?.date ?? new Date(),
      businessDate: opts?.businessDate ?? original.businessDate,
      sourceType: 'Reversal',
      sourceId: original._id,
      memo: opts?.memo ?? `Reversal of entry #${original.entryNo}`,
      reversalOf: original._id,
      createdBy,
      lines: original.lines.map((l) => ({
        accountCode: l.accountCode,
        debitMinor: l.creditMinor, // swap
        creditMinor: l.debitMinor,
        partyType: l.partyType as 'Customer' | 'Vendor' | null,
        partyId: l.partyId,
      })),
    },
    session,
  );
}

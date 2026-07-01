import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { withTransaction } from '../utils/transaction';
import * as ledger from '../services/ledger.service';
import { LedgerEntry } from '../models/ledgerEntry.model';

useTestDb();

const user = new Types.ObjectId();

function saleEntry(): ledger.PostEntryInput {
  // Customer pays 15100 cash for a 15100 invoice (gas 15000 + delivery 100).
  return {
    date: new Date('2026-06-14T10:00:00Z'),
    businessDate: '2026-06-14',
    sourceType: 'Sale',
    memo: 'test sale',
    createdBy: user,
    lines: [
      { accountCode: '1010', debitMinor: 1510000 }, // Cash
      { accountCode: '4010', creditMinor: 1500000 }, // Sales - Gas
      { accountCode: '4021', creditMinor: 10000 }, // Delivery charge
    ],
  };
}

describe('ledgerService.post', () => {
  it('persists a balanced entry with a sequential number', async () => {
    const doc = await withTransaction((s) => ledger.post(saleEntry(), s));
    expect(doc.entryNo).toBe(1);
    expect(doc.totalDebitMinor).toBe(1510000);
    expect(doc.totalCreditMinor).toBe(1510000);

    const second = await withTransaction((s) => ledger.post(saleEntry(), s));
    expect(second.entryNo).toBe(2);
    expect(await LedgerEntry.countDocuments()).toBe(2);
  });

  it('rejects an unbalanced entry', async () => {
    const bad = saleEntry();
    bad.lines[1]!.creditMinor = 1400000; // now debit != credit
    await expect(withTransaction((s) => ledger.post(bad, s))).rejects.toThrow(/Unbalanced/);
    expect(await LedgerEntry.countDocuments()).toBe(0);
  });

  it('rejects a line carrying both a debit and a credit', async () => {
    const bad = saleEntry();
    bad.lines[0] = { accountCode: '1010', debitMinor: 100, creditMinor: 100 };
    await expect(withTransaction((s) => ledger.post(bad, s))).rejects.toThrow(/both/);
  });

  it('rejects entries with fewer than two lines', async () => {
    const bad = saleEntry();
    bad.lines = [{ accountCode: '1010', debitMinor: 100 }];
    await expect(withTransaction((s) => ledger.post(bad, s))).rejects.toThrow(/at least 2/);
  });

  it('is immutable — updates are blocked', async () => {
    const doc = await withTransaction((s) => ledger.post(saleEntry(), s));
    await expect(LedgerEntry.updateOne({ _id: doc._id }, { $set: { memo: 'x' } })).rejects.toThrow(
      /immutable/,
    );
    const reloaded = await LedgerEntry.findById(doc._id);
    reloaded!.memo = 'tampered';
    await expect(reloaded!.save()).rejects.toThrow(/immutable/);
  });

  it('produces a balanced trial balance across all entries', async () => {
    await withTransaction((s) => ledger.post(saleEntry(), s));
    await withTransaction((s) => ledger.post(saleEntry(), s));

    const tb = await ledger.trialBalance();
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebitMinor).toBe(tb.totalCreditMinor);
    expect(tb.totalDebitMinor).toBe(2 * 1510000);
    // Cash (1010) accumulated debits from both sales.
    const cash = tb.rows.find((r) => r.accountCode === '1010')!;
    expect(cash.debitMinor).toBe(2 * 1510000);
  });

  it('reverses an entry by swapping debits and credits', async () => {
    const original = await withTransaction((s) => ledger.post(saleEntry(), s));
    const reversal = await withTransaction((s) =>
      ledger.reverse(original._id, user, s),
    );
    expect(reversal.sourceType).toBe('Reversal');
    expect(String(reversal.reversalOf)).toBe(String(original._id));
    // Cash line was a debit on the original, must be a credit on the reversal.
    const cash = reversal.lines.find((l) => l.accountCode === '1010')!;
    expect(cash.creditMinor).toBe(1510000);
    expect(cash.debitMinor).toBe(0);
    expect(reversal.totalDebitMinor).toBe(reversal.totalCreditMinor);
  });
});

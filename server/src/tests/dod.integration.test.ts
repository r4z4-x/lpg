import { Schema, Types, model } from 'mongoose';
import { describe, expect, it, beforeEach } from 'vitest';
import { useTestDb } from './dbHelper';
import { withTransaction } from '../utils/transaction';
import * as ledger from '../services/ledger.service';
import * as audit from '../services/audit.service';
import { LedgerEntry } from '../models/ledgerEntry.model';
import { AuditTrail } from '../models/auditTrail.model';

// Minimal stand-in for the gas inventory (real model arrives in M3) so M0 can prove
// the cross-cutting transaction guarantee end to end.
const TestGas = model(
  'TestGas',
  new Schema({ _id: String, kgSub: Number }), // kgSub = milli-kg
);

useTestDb();

const user = new Types.ObjectId();
const GAS_ID = 'singleton';

beforeEach(async () => {
  await TestGas.create({ _id: GAS_ID, kgSub: 100_000 }); // 100.000 kg
});

/** Performs the three coupled writes inside one transaction. Throws if `fail` is set. */
async function sellGas(fail: boolean): Promise<void> {
  await withTransaction(async (session) => {
    const updated = await TestGas.findByIdAndUpdate(
      GAS_ID,
      { $inc: { kgSub: -10_000 } }, // -10.000 kg
      { new: true, session },
    );
    if (!updated) throw new Error('gas missing');

    await ledger.post(
      {
        date: new Date('2026-06-14T10:00:00Z'),
        businessDate: '2026-06-14',
        sourceType: 'Sale',
        memo: 'DoD sale',
        createdBy: user,
        lines: [
          { accountCode: '1010', debitMinor: 300000 },
          { accountCode: '4010', creditMinor: 300000 },
        ],
      },
      session,
    );

    await audit.record(
      { userId: user, action: 'create', entity: 'Sale', newValue: { kg: 10 } },
      session,
    );

    if (fail) throw new Error('forced failure after all writes');
  });
}

describe('M0 Definition of Done — atomic gas + ledger + audit', () => {
  it('commits all three writes together on success', async () => {
    await sellGas(false);
    expect((await TestGas.findById(GAS_ID))!.kgSub).toBe(90_000);
    expect(await LedgerEntry.countDocuments()).toBe(1);
    expect(await AuditTrail.countDocuments()).toBe(1);
  });

  it('rolls all three back together on failure', async () => {
    await expect(sellGas(true)).rejects.toThrow(/forced failure/);
    // Nothing persisted: gas unchanged, no ledger entry, no audit record.
    expect((await TestGas.findById(GAS_ID))!.kgSub).toBe(100_000);
    expect(await LedgerEntry.countDocuments()).toBe(0);
    expect(await AuditTrail.countDocuments()).toBe(0);
  });
});

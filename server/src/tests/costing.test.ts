import { describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { withTransaction } from '../utils/transaction';
import * as costing from '../services/costing.service';
import { Money } from '../utils/money';
import { Quantity } from '../utils/quantity';

useTestDb();

describe('costing engine (WAC)', () => {
  it('recomputes weighted average cost across purchases', async () => {
    // Purchase 1: 1000 kg, landed 255,000 -> WAC 255.00
    await withTransaction((s) =>
      costing.applyPurchase(Quantity.fromKg('1000'), Money.fromMajor('255000'), s),
    );
    let gas = await costing.getGasInventory();
    expect(gas.wacMinor).toBe(Money.fromMajor('255').toMinorNumber());

    // Purchase 2: 1000 kg @ 230 -> value 485,000 over 2000 kg -> WAC 242.50
    await withTransaction((s) =>
      costing.applyPurchase(Quantity.fromKg('1000'), Money.fromMajor('230000'), s),
    );
    gas = await costing.getGasInventory();
    expect(gas.availableKgSub).toBe(2_000_000);
    expect(gas.inventoryValueMinor).toBe(Money.fromMajor('485000').toMinorNumber());
    expect(gas.wacMinor).toBe(Money.fromMajor('242.50').toMinorNumber());
  });

  it('deducts for a sale at WAC, snapshotting COGS without changing WAC', async () => {
    await withTransaction((s) =>
      costing.applyPurchase(Quantity.fromKg('2000'), Money.fromMajor('485000'), s),
    ); // WAC 242.50

    const result = await withTransaction((s) => costing.deductForSale(Quantity.fromKg('50'), s));
    expect(result.wacMinor).toBe(Money.fromMajor('242.50').toMinorNumber());
    expect(result.cogsMinor).toBe(Money.fromMajor('12125').toMinorNumber()); // 50 × 242.50

    const gas = await costing.getGasInventory();
    expect(gas.availableKgSub).toBe(1_950_000);
    expect(gas.wacMinor).toBe(Money.fromMajor('242.50').toMinorNumber()); // unchanged
    expect(gas.inventoryValueMinor).toBe(Money.fromMajor('472875').toMinorNumber());
  });

  it('blocks selling more gas than is in stock', async () => {
    await withTransaction((s) =>
      costing.applyPurchase(Quantity.fromKg('10'), Money.fromMajor('2500'), s),
    );
    await expect(
      withTransaction((s) => costing.deductForSale(Quantity.fromKg('11'), s)),
    ).rejects.toThrow(/Insufficient gas stock/);
    // Stock unchanged after the failed sale.
    const gas = await costing.getGasInventory();
    expect(gas.availableKgSub).toBe(10_000);
  });

  it('sets opening stock and derives opening WAC', async () => {
    await withTransaction((s) =>
      costing.setOpening(Quantity.fromKg('1000'), Money.fromMajor('250000'), s),
    );
    const gas = await costing.getGasInventory();
    expect(gas.wacMinor).toBe(Money.fromMajor('250').toMinorNumber());
  });
});

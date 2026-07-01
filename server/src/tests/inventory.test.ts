import { describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { withTransaction } from '../utils/transaction';
import * as inventory from '../services/inventory.service';
import { createCylinderType } from '../services/cylinderType.service';

useTestDb();

async function aType(): Promise<string> {
  const t = await createCylinderType({ name: 'Standard', capacityKg: '11.8' });
  return String(t._id);
}

describe('cylinder shell register', () => {
  it('applies signed deltas to counts', async () => {
    const id = await aType();
    await withTransaction((s) => inventory.adjust(id, { filled: 10, empty: 5 }, s));
    const inv = await withTransaction((s) =>
      inventory.adjust(id, { filled: -1, empty: 1, customerHeld: 1 }, s),
    );
    expect(inv.filled).toBe(9);
    expect(inv.empty).toBe(6);
    expect(inv.customerHeld).toBe(1);
  });

  it('refuses to drive any count negative', async () => {
    const id = await aType();
    await withTransaction((s) => inventory.adjust(id, { filled: 2 }, s));
    await expect(
      withTransaction((s) => inventory.adjust(id, { filled: -3 }, s)),
    ).rejects.toThrow(/cannot go negative/);
    const inv = await inventory.getOrCreate(id);
    expect(inv.filled).toBe(2);
  });

  it('sets opening cylinder counts and shell value', async () => {
    const id = await aType();
    const inv = await withTransaction((s) =>
      inventory.setOpening(id, { filled: 50, empty: 30, shellAssetValueMinor: 5_000_000 }, s),
    );
    expect(inv.filled).toBe(50);
    expect(inv.empty).toBe(30);
    expect(inv.shellAssetValueMinor).toBe(5_000_000);
  });
});

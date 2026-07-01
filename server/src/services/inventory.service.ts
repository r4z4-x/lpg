import type { ClientSession, Types } from 'mongoose';
import { CylinderInventory } from '../models/cylinderInventory.model';
import { ValidationError } from '../utils/errors';

export type CountField = 'filled' | 'empty' | 'customerHeld' | 'lost' | 'damaged';
const COUNT_FIELDS: CountField[] = ['filled', 'empty', 'customerHeld', 'lost', 'damaged'];

/** Loads (or creates) the shell register row for a cylinder type. */
export async function getOrCreate(typeId: string | Types.ObjectId, session?: ClientSession) {
  const existing = await CylinderInventory.findOne({ cylinderTypeId: typeId }).session(
    session ?? null,
  );
  if (existing) return existing;
  const [created] = await CylinderInventory.create(
    [{ cylinderTypeId: typeId }],
    session ? { session } : {},
  );
  return created!;
}

/**
 * Applies signed deltas to the shell counts of a cylinder type. Any field that would go
 * negative is rejected (guards conservation of physical shells).
 */
export async function adjust(
  typeId: string | Types.ObjectId,
  deltas: Partial<Record<CountField, number>>,
  session: ClientSession,
) {
  const inv = await getOrCreate(typeId, session);
  for (const field of COUNT_FIELDS) {
    const delta = deltas[field] ?? 0;
    if (delta === 0) continue;
    const next = inv[field] + delta;
    if (next < 0) {
      throw new ValidationError(`Cylinder ${field} cannot go negative for this type`);
    }
    inv[field] = next;
  }
  await inv.save({ session });
  return inv;
}

export interface OpeningCylinders {
  filled: number;
  empty: number;
  shellAssetValueMinor?: number;
}

export async function setOpening(
  typeId: string | Types.ObjectId,
  input: OpeningCylinders,
  session: ClientSession,
) {
  const inv = await getOrCreate(typeId, session);
  inv.filled = input.filled;
  inv.empty = input.empty;
  inv.shellAssetValueMinor = input.shellAssetValueMinor ?? 0;
  await inv.save({ session });
  return inv;
}

export function listCylinderInventory() {
  return CylinderInventory.find().populate('cylinderTypeId');
}

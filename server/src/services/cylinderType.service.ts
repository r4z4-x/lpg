import { Types } from 'mongoose';
import { CylinderType } from '../models/cylinderType.model';
import { Quantity } from '../utils/quantity';
import { Money } from '../utils/money';
import { ConflictError, NotFoundError } from '../utils/errors';
import { logger } from '../config/logger';

export interface CreateCylinderTypeInput {
  name: string;
  capacityKg: string; // human KG
  tareKg?: string;
  depositAmount?: string | null; // human money, optional (Q2)
}

export async function createCylinderType(input: CreateCylinderTypeInput) {
  const exists = await CylinderType.findOne({ name: input.name.trim() });
  if (exists) throw new ConflictError('Cylinder type name already exists', 'NAME_TAKEN');
  return CylinderType.create({
    name: input.name.trim(),
    capacityKgSub: Number(Quantity.fromKg(input.capacityKg).toSub()),
    tareKgSub: input.tareKg ? Number(Quantity.fromKg(input.tareKg).toSub()) : 0,
    depositAmountMinor:
      input.depositAmount != null ? Money.fromMajor(input.depositAmount).toMinorNumber() : null,
  });
}

export function listCylinderTypes() {
  return CylinderType.find().sort({ name: 1 });
}

export async function updateCylinderType(
  id: string | Types.ObjectId,
  input: Partial<CreateCylinderTypeInput> & { isActive?: boolean },
) {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.capacityKg !== undefined)
    patch.capacityKgSub = Number(Quantity.fromKg(input.capacityKg).toSub());
  if (input.tareKg !== undefined) patch.tareKgSub = Number(Quantity.fromKg(input.tareKg).toSub());
  if (input.depositAmount !== undefined)
    patch.depositAmountMinor =
      input.depositAmount === null ? null : Money.fromMajor(input.depositAmount).toMinorNumber();
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  const updated = await CylinderType.findByIdAndUpdate(id, { $set: patch }, { new: true });
  if (!updated) throw new NotFoundError('Cylinder type not found');
  return updated;
}

/** Sample seed types (ARCHITECTURE §1.6) — editable later. Idempotent by name. */
const SEED_TYPES: CreateCylinderTypeInput[] = [
  { name: 'Domestic Small', capacityKg: '6', tareKg: '8' },
  { name: 'Domestic Standard', capacityKg: '11.8', tareKg: '15.5' },
  { name: 'Commercial', capacityKg: '45.4', tareKg: '36' },
];

export async function seedCylinderTypes(): Promise<void> {
  for (const t of SEED_TYPES) {
    await CylinderType.updateOne(
      { name: t.name },
      {
        $setOnInsert: {
          name: t.name,
          capacityKgSub: Number(Quantity.fromKg(t.capacityKg).toSub()),
          tareKgSub: Number(Quantity.fromKg(t.tareKg!).toSub()),
          depositAmountMinor: null,
          isActive: true,
        },
      },
      { upsert: true },
    );
  }
  logger.info('Cylinder types seeded', { count: SEED_TYPES.length });
}

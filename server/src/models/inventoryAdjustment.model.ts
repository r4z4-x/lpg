import { Schema, model, type Types } from 'mongoose';

export interface IInventoryAdjustment {
  type: 'leakage' | 'damage' | 'correction';
  gasKgDeltaSub: number; // signed milli-kg (negative = removed)
  valuationImpactMinor: number; // signed (negative = loss)
  cylinderTypeId: Types.ObjectId | null;
  cylinderDeltas: Record<string, number>;
  reason: string;
  ledgerEntryId: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const inventoryAdjustmentSchema = new Schema<IInventoryAdjustment>(
  {
    type: { type: String, required: true, enum: ['leakage', 'damage', 'correction'] },
    gasKgDeltaSub: { type: Number, default: 0 },
    valuationImpactMinor: { type: Number, default: 0 },
    cylinderTypeId: { type: Schema.Types.ObjectId, ref: 'CylinderType', default: null },
    cylinderDeltas: { type: Schema.Types.Mixed, default: {} },
    reason: { type: String, required: true },
    ledgerEntryId: { type: Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

inventoryAdjustmentSchema.index({ type: 1 });
inventoryAdjustmentSchema.index({ createdAt: 1 });

export const InventoryAdjustment = model<IInventoryAdjustment>(
  'InventoryAdjustment',
  inventoryAdjustmentSchema,
);

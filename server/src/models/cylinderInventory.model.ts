import { Schema, model, type Types } from 'mongoose';

/**
 * Physical shell register per cylinder type (F1: counts only, never a gas valuation).
 * `filled` reconciles with gas via Σ(availableKg / capacityKg). `shellAssetValueMinor`
 * values the steel only.
 */
export interface ICylinderInventory {
  cylinderTypeId: Types.ObjectId;
  filled: number;
  empty: number;
  customerHeld: number;
  lost: number;
  damaged: number;
  shellAssetValueMinor: number;
  updatedAt: Date;
}

const cylinderInventorySchema = new Schema<ICylinderInventory>(
  {
    cylinderTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'CylinderType',
      required: true,
      unique: true,
    },
    filled: { type: Number, default: 0 },
    empty: { type: Number, default: 0 },
    customerHeld: { type: Number, default: 0 },
    lost: { type: Number, default: 0 },
    damaged: { type: Number, default: 0 },
    shellAssetValueMinor: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const CylinderInventory = model<ICylinderInventory>(
  'CylinderInventory',
  cylinderInventorySchema,
);

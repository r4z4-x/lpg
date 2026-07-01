import { Schema, model } from 'mongoose';

export const GAS_INVENTORY_ID = 'singleton';

/**
 * The single valued gas inventory (F1). Gas is valued ONLY here; cylinder counts carry
 * no gas value. Quantities are stored in milli-kg; money in minor units (paisa).
 */
export interface IGasInventory {
  _id: string;
  availableKgSub: number; // milli-kg
  wacMinor: number; // weighted average cost, paisa per kg
  inventoryValueMinor: number; // = availableKg × WAC
  updatedAt: Date;
}

const gasInventorySchema = new Schema<IGasInventory>(
  {
    _id: { type: String, default: GAS_INVENTORY_ID },
    availableKgSub: { type: Number, default: 0 },
    wacMinor: { type: Number, default: 0 },
    inventoryValueMinor: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const GasInventory = model<IGasInventory>('GasInventory', gasInventorySchema);

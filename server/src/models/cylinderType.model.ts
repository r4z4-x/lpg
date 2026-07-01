import { Schema, model } from 'mongoose';

export interface ICylinderType {
  name: string;
  capacityKgSub: number; // gas charge per cylinder, in milli-kg (drives F1 reconciliation)
  tareKgSub: number; // empty shell weight, milli-kg
  depositAmountMinor: number | null; // optional refundable deposit (Q2); null = none
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const cylinderTypeSchema = new Schema<ICylinderType>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    capacityKgSub: { type: Number, required: true },
    tareKgSub: { type: Number, default: 0 },
    depositAmountMinor: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const CylinderType = model<ICylinderType>('CylinderType', cylinderTypeSchema);

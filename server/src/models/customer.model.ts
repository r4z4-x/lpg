import { Schema, model } from 'mongoose';

export interface ICustomer {
  name: string;
  contact: string | null;
  openingReceivableMinor: number;
  currentReceivableMinor: number;
  creditLimitMinor: number; // 0 = no limit
  cylinderLimit: number; // 0 = no limit
  heldCylinders: number; // company cylinders currently with this customer
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true },
    contact: { type: String, default: null },
    openingReceivableMinor: { type: Number, default: 0 },
    currentReceivableMinor: { type: Number, default: 0 },
    creditLimitMinor: { type: Number, default: 0 },
    cylinderLimit: { type: Number, default: 0 },
    heldCylinders: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

customerSchema.index({ name: 1 });

export const Customer = model<ICustomer>('Customer', customerSchema);

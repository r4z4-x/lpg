import { Schema, model } from 'mongoose';

export interface IVendor {
  name: string;
  contact: string | null;
  openingBalanceMinor: number;
  currentPayableMinor: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<IVendor>(
  {
    name: { type: String, required: true, trim: true },
    contact: { type: String, default: null },
    openingBalanceMinor: { type: Number, default: 0 },
    currentPayableMinor: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

vendorSchema.index({ name: 1 });

export const Vendor = model<IVendor>('Vendor', vendorSchema);

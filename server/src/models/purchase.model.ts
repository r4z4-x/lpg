import { Schema, model, type Types } from 'mongoose';

export interface IPurchase {
  purchaseNo: number;
  vendorId: Types.ObjectId;
  date: Date;
  businessDate: string;
  qtyKgSub: number;
  ratePerKgMinor: number;
  gasCostMinor: number;
  transportMinor: number;
  miscMinor: number;
  landedCostMinor: number;
  paymentType: 'full' | 'partial' | 'credit';
  amountPaidMinor: number;
  paymentAccountId: Types.ObjectId | null;
  ledgerEntryId: Types.ObjectId | null;
  status: 'active' | 'reversed';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseSchema = new Schema<IPurchase>(
  {
    purchaseNo: { type: Number, required: true, unique: true },
    vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
    date: { type: Date, required: true },
    businessDate: { type: String, required: true },
    qtyKgSub: { type: Number, required: true },
    ratePerKgMinor: { type: Number, required: true },
    gasCostMinor: { type: Number, required: true },
    transportMinor: { type: Number, default: 0 },
    miscMinor: { type: Number, default: 0 },
    landedCostMinor: { type: Number, required: true },
    paymentType: { type: String, required: true, enum: ['full', 'partial', 'credit'] },
    amountPaidMinor: { type: Number, default: 0 },
    paymentAccountId: { type: Schema.Types.ObjectId, ref: 'PaymentAccount', default: null },
    ledgerEntryId: { type: Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
    status: { type: String, enum: ['active', 'reversed'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

purchaseSchema.index({ vendorId: 1 });
purchaseSchema.index({ date: 1 });

export const Purchase = model<IPurchase>('Purchase', purchaseSchema);

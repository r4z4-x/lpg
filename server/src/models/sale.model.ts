import { Schema, model, type Types } from 'mongoose';

const chargeSchema = new Schema(
  { name: { type: String, required: true }, amountMinor: { type: Number, required: true } },
  { _id: false },
);

export interface ISaleCharge {
  name: string;
  amountMinor: number;
}

export interface ISale {
  invoiceNo: number;
  customerId: Types.ObjectId;
  customerType: 'exchange' | 'no_cylinder';
  date: Date;
  businessDate: string;
  qtyKgSub: number;
  saleRateMinor: number;
  gasAmountMinor: number;
  charges: ISaleCharge[];
  discountMinor: number;
  taxMinor: number;
  invoiceAmountMinor: number;
  unitCostAtSaleMinor: number; // WAC snapshot (profit-sensitive)
  cogsMinor: number; // profit-sensitive
  amountPaidMinor: number; // toward this invoice
  previousBalanceRecoveryMinor: number; // applied to prior AR (not revenue)
  totalReceivedMinor: number;
  paymentType: 'full' | 'partial' | 'credit';
  paymentAccountId: Types.ObjectId | null;
  cylinderTypeId: Types.ObjectId | null;
  cylinderCount: number;
  depositMinor: number;
  ledgerEntryId: Types.ObjectId | null;
  status: 'active' | 'reversed';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const saleSchema = new Schema<ISale>(
  {
    invoiceNo: { type: Number, required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    customerType: { type: String, required: true, enum: ['exchange', 'no_cylinder'] },
    date: { type: Date, required: true },
    businessDate: { type: String, required: true },
    qtyKgSub: { type: Number, required: true },
    saleRateMinor: { type: Number, required: true },
    gasAmountMinor: { type: Number, required: true },
    charges: { type: [chargeSchema], default: [] },
    discountMinor: { type: Number, default: 0 },
    taxMinor: { type: Number, default: 0 },
    invoiceAmountMinor: { type: Number, required: true },
    unitCostAtSaleMinor: { type: Number, required: true },
    cogsMinor: { type: Number, required: true },
    amountPaidMinor: { type: Number, default: 0 },
    previousBalanceRecoveryMinor: { type: Number, default: 0 },
    totalReceivedMinor: { type: Number, default: 0 },
    paymentType: { type: String, required: true, enum: ['full', 'partial', 'credit'] },
    paymentAccountId: { type: Schema.Types.ObjectId, ref: 'PaymentAccount', default: null },
    cylinderTypeId: { type: Schema.Types.ObjectId, ref: 'CylinderType', default: null },
    cylinderCount: { type: Number, default: 0 },
    depositMinor: { type: Number, default: 0 },
    ledgerEntryId: { type: Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
    status: { type: String, enum: ['active', 'reversed'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

saleSchema.index({ customerId: 1 });
saleSchema.index({ date: 1 });

export const Sale = model<ISale>('Sale', saleSchema);

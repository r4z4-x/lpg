import { Schema, model, type Types } from 'mongoose';

export interface ICashClosing {
  businessDate: string;
  paymentAccountId: Types.ObjectId;
  expectedCashMinor: number;
  actualCashMinor: number;
  varianceMinor: number; // actual - expected
  ledgerEntryId: Types.ObjectId | null;
  closedBy: Types.ObjectId;
  createdAt: Date;
}

const cashClosingSchema = new Schema<ICashClosing>(
  {
    businessDate: { type: String, required: true },
    paymentAccountId: { type: Schema.Types.ObjectId, ref: 'PaymentAccount', required: true },
    expectedCashMinor: { type: Number, required: true },
    actualCashMinor: { type: Number, required: true },
    varianceMinor: { type: Number, required: true },
    ledgerEntryId: { type: Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
    closedBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

cashClosingSchema.index({ businessDate: 1, paymentAccountId: 1 }, { unique: true });

export const CashClosing = model<ICashClosing>('CashClosing', cashClosingSchema);

import { Schema, model, type Types } from 'mongoose';

/** Standalone money movement against a party (vendor payment, customer receipt). */
export interface IPayment {
  partyType: 'Customer' | 'Vendor';
  partyId: Types.ObjectId;
  direction: 'in' | 'out'; // in = money received, out = money paid
  amountMinor: number;
  paymentAccountId: Types.ObjectId;
  ledgerEntryId: Types.ObjectId | null;
  date: Date;
  businessDate: string;
  note: string | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    partyType: { type: String, required: true, enum: ['Customer', 'Vendor'] },
    partyId: { type: Schema.Types.ObjectId, required: true },
    direction: { type: String, required: true, enum: ['in', 'out'] },
    amountMinor: { type: Number, required: true },
    paymentAccountId: { type: Schema.Types.ObjectId, ref: 'PaymentAccount', required: true },
    ledgerEntryId: { type: Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
    date: { type: Date, required: true },
    businessDate: { type: String, required: true },
    note: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

paymentSchema.index({ partyType: 1, partyId: 1 });
paymentSchema.index({ date: 1 });

export const Payment = model<IPayment>('Payment', paymentSchema);

import { Schema, model, type Types } from 'mongoose';

export interface IExpense {
  category: string;
  amountMinor: number;
  date: Date;
  businessDate: string;
  paid: boolean;
  paymentAccountId: Types.ObjectId | null; // null when accrued (unpaid)
  ledgerEntryId: Types.ObjectId | null;
  note: string | null;
  status: 'active' | 'reversed';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    category: { type: String, required: true },
    amountMinor: { type: Number, required: true },
    date: { type: Date, required: true },
    businessDate: { type: String, required: true },
    paid: { type: Boolean, default: true },
    paymentAccountId: { type: Schema.Types.ObjectId, ref: 'PaymentAccount', default: null },
    ledgerEntryId: { type: Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
    note: { type: String, default: null },
    status: { type: String, enum: ['active', 'reversed'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

expenseSchema.index({ category: 1 });
expenseSchema.index({ date: 1 });
expenseSchema.index({ businessDate: 1 });

export const Expense = model<IExpense>('Expense', expenseSchema);

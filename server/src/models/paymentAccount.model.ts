import { Schema, model } from 'mongoose';

export type PaymentAccountType = 'Cash' | 'Bank' | 'Wallet';

export interface IPaymentAccount {
  name: string;
  type: PaymentAccountType;
  openingBalanceMinor: number;
  currentBalanceMinor: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const paymentAccountSchema = new Schema<IPaymentAccount>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    type: { type: String, required: true, enum: ['Cash', 'Bank', 'Wallet'] },
    openingBalanceMinor: { type: Number, default: 0 },
    currentBalanceMinor: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

/** Ledger account code that mirrors this payment account. */
export function ledgerCodeForAccountType(type: PaymentAccountType): string {
  return type === 'Bank' ? '1020' : '1010';
}

export const PaymentAccount = model<IPaymentAccount>('PaymentAccount', paymentAccountSchema);

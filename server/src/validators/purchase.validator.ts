import { z } from 'zod';

const moneyString = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount');
const idString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const createVendorSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  openingBalance: moneyString.optional(),
});

export const createPurchaseSchema = z.object({
  vendorId: idString,
  qtyKg: moneyString,
  ratePerKg: moneyString,
  transport: moneyString.optional(),
  misc: moneyString.optional(),
  paymentType: z.enum(['full', 'partial', 'credit']),
  amountPaid: moneyString.optional(),
  paymentAccountId: idString.optional(),
  date: z.string().datetime().optional(),
});

export const vendorPaymentSchema = z.object({
  amount: moneyString,
  paymentAccountId: idString,
  date: z.string().datetime().optional(),
  note: z.string().optional(),
});

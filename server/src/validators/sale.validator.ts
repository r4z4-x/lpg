import { z } from 'zod';

const moneyString = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount');
const idString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const createCustomerSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional(),
  openingReceivable: moneyString.optional(),
  creditLimit: moneyString.optional(),
  cylinderLimit: z.number().int().min(0).optional(),
});

export const createSaleSchema = z.object({
  customerId: idString,
  customerType: z.enum(['exchange', 'no_cylinder']),
  qtyKg: moneyString,
  saleRate: moneyString,
  cylinderTypeId: idString,
  cylinderCount: z.number().int().positive().optional(),
  charges: z.array(z.object({ name: z.string().min(1), amount: moneyString })).optional(),
  discount: moneyString.optional(),
  paymentType: z.enum(['full', 'partial', 'credit']),
  amountPaid: moneyString.optional(),
  previousBalanceRecovery: moneyString.optional(),
  paymentAccountId: idString.optional(),
  collectDeposit: z.boolean().optional(),
  date: z.string().datetime().optional(),
});

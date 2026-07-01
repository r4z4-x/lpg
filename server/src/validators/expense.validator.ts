import { z } from 'zod';

const moneyString = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount');
const idString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const createExpenseSchema = z.object({
  category: z.string().min(1),
  amount: moneyString,
  paymentAccountId: idString.optional(),
  date: z.string().datetime().optional(),
  note: z.string().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1),
  accountCode: z.string().regex(/^6\d{3}$/).optional(),
});

export const cashMovementSchema = z.object({
  paymentAccountId: idString,
  direction: z.enum(['in', 'out']),
  amount: moneyString,
  note: z.string().optional(),
  date: z.string().datetime().optional(),
});

export const closeDaySchema = z.object({
  paymentAccountId: idString,
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD'),
  actualCash: moneyString,
});

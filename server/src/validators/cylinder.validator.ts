import { z } from 'zod';

const idString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const returnCylinderSchema = z.object({
  customerId: idString,
  cylinderTypeId: idString,
  qty: z.number().int().positive(),
  condition: z.enum(['good', 'damaged', 'lost']),
  refundDeposit: z.boolean().optional(),
  paymentAccountId: idString.optional(),
  date: z.string().datetime().optional(),
});

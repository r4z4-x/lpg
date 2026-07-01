import { z } from 'zod';

const moneyString = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid quantity');
const idString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const createAdjustmentSchema = z
  .object({
    type: z.enum(['leakage', 'damage', 'correction']),
    reason: z.string().min(1),
    gas: z.object({ kg: moneyString, direction: z.enum(['decrease', 'increase']) }).optional(),
    cylinder: z
      .object({
        cylinderTypeId: idString,
        deltas: z.record(
          z.enum(['filled', 'empty', 'customerHeld', 'lost', 'damaged']),
          z.number().int(),
        ),
      })
      .optional(),
  })
  .refine((v) => v.gas !== undefined || v.cylinder !== undefined, {
    message: 'Provide a gas and/or cylinder change',
  });

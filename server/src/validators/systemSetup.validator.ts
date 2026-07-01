import { z } from 'zod';

const moneyString = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount');
const kgString = z.string().regex(/^\d+(\.\d+)?$/, 'Invalid quantity');
const idString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const updateSettingsSchema = z
  .object({
    companyName: z.string().min(1).optional(),
    currency: z.string().min(1).optional(),
    businessTimezone: z.string().min(1).optional(),
    defaultSaleRate: moneyString.optional(),
    tax: z.object({ enabled: z.boolean(), ratePercent: z.number().min(0) }).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const createCylinderTypeSchema = z.object({
  name: z.string().min(1),
  capacityKg: kgString,
  tareKg: kgString.optional(),
  depositAmount: moneyString.nullable().optional(),
});

export const updateCylinderTypeSchema = z
  .object({
    name: z.string().min(1).optional(),
    capacityKg: kgString.optional(),
    tareKg: kgString.optional(),
    depositAmount: moneyString.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const createPaymentAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['Cash', 'Bank', 'Wallet']),
  openingBalance: moneyString.optional(),
});

export const openingBalanceSchema = z.object({
  paymentAccounts: z.array(z.object({ accountId: idString, amount: moneyString })).optional(),
  gas: z.object({ kg: kgString, value: moneyString }).optional(),
  cylinders: z
    .array(
      z.object({
        cylinderTypeId: idString,
        filled: z.number().int().min(0),
        empty: z.number().int().min(0),
        shellAssetValue: moneyString.optional(),
      }),
    )
    .optional(),
});

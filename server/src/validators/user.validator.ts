import { z } from 'zod';
import { ALL_ROLES } from '../constants/roles';

const roleSchema = z.enum(ALL_ROLES as [string, ...string[]]);

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: roleSchema,
});

export const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'),
});

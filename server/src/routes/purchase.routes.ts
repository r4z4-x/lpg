import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { idempotency } from '../middlewares/idempotency.middleware';
import { idParamSchema } from '../validators/user.validator';
import { createPurchaseSchema } from '../validators/purchase.validator';
import * as purchase from '../controllers/purchase.controller';

export const purchaseRouter = Router();

purchaseRouter.use(requireAuth); // Owner + Operator (operators may create purchases)

purchaseRouter.post('/', idempotency, validate(createPurchaseSchema), asyncHandler(purchase.create));
purchaseRouter.get('/', asyncHandler(purchase.list));
purchaseRouter.get('/:id', validate(idParamSchema, 'params'), asyncHandler(purchase.getById));

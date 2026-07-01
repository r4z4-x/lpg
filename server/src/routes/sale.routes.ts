import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { idempotency } from '../middlewares/idempotency.middleware';
import { idParamSchema } from '../validators/user.validator';
import { createSaleSchema } from '../validators/sale.validator';
import * as sale from '../controllers/sale.controller';

export const saleRouter = Router();

saleRouter.use(requireAuth); // Owner + Operator (operators may create sales; profit fields stripped)

saleRouter.post('/', idempotency, validate(createSaleSchema), asyncHandler(sale.create));
saleRouter.get('/', asyncHandler(sale.list));
saleRouter.get('/:id', validate(idParamSchema, 'params'), asyncHandler(sale.getById));

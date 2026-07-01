import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { idempotency } from '../middlewares/idempotency.middleware';
import { idParamSchema } from '../validators/user.validator';
import { createVendorSchema, vendorPaymentSchema } from '../validators/purchase.validator';
import * as vendor from '../controllers/vendor.controller';

export const vendorRouter = Router();

vendorRouter.use(requireAuth); // Owner + Operator

vendorRouter.post('/', validate(createVendorSchema), asyncHandler(vendor.create));
vendorRouter.get('/', asyncHandler(vendor.list));
vendorRouter.get('/:id', validate(idParamSchema, 'params'), asyncHandler(vendor.getById));
vendorRouter.get('/:id/ledger', validate(idParamSchema, 'params'), asyncHandler(vendor.ledger));
vendorRouter.get('/:id/aging', validate(idParamSchema, 'params'), asyncHandler(vendor.aging));
vendorRouter.post(
  '/:id/payments',
  idempotency,
  validate(idParamSchema, 'params'),
  validate(vendorPaymentSchema),
  asyncHandler(vendor.pay),
);

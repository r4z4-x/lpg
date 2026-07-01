import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { ROLES } from '../constants/roles';
import { idParamSchema } from '../validators/user.validator';
import {
  createCylinderTypeSchema,
  createPaymentAccountSchema,
  openingBalanceSchema,
  updateCylinderTypeSchema,
  updateSettingsSchema,
} from '../validators/systemSetup.validator';
import * as setup from '../controllers/systemSetup.controller';

export const setupRouter = Router();

// All system setup is Owner-only.
setupRouter.use(requireAuth, requireRole(ROLES.OWNER));

setupRouter.get('/settings', asyncHandler(setup.getSettings));
setupRouter.patch('/settings', validate(updateSettingsSchema), asyncHandler(setup.updateSettings));

setupRouter.post(
  '/cylinder-types',
  validate(createCylinderTypeSchema),
  asyncHandler(setup.createCylinderType),
);
setupRouter.get('/cylinder-types', asyncHandler(setup.listCylinderTypes));
setupRouter.patch(
  '/cylinder-types/:id',
  validate(idParamSchema, 'params'),
  validate(updateCylinderTypeSchema),
  asyncHandler(setup.updateCylinderType),
);

setupRouter.post(
  '/payment-accounts',
  validate(createPaymentAccountSchema),
  asyncHandler(setup.createPaymentAccount),
);
setupRouter.get('/payment-accounts', asyncHandler(setup.listPaymentAccounts));

setupRouter.post(
  '/opening-balances',
  validate(openingBalanceSchema),
  asyncHandler(setup.postOpeningBalances),
);

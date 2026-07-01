import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { ROLES } from '../constants/roles';
import { createAdjustmentSchema } from '../validators/adjustment.validator';
import * as adjustment from '../controllers/adjustment.controller';

export const adjustmentRouter = Router();

// Inventory adjustments are sensitive — Owner-only.
adjustmentRouter.use(requireAuth, requireRole(ROLES.OWNER));

adjustmentRouter.post('/', validate(createAdjustmentSchema), asyncHandler(adjustment.create));
adjustmentRouter.get('/', asyncHandler(adjustment.list));

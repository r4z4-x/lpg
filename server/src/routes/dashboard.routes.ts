import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { ROLES } from '../constants/roles';
import * as report from '../controllers/report.controller';

export const dashboardRouter = Router();

// Owner dashboard includes profit — Owner-only.
dashboardRouter.use(requireAuth, requireRole(ROLES.OWNER));

dashboardRouter.get('/', asyncHandler(report.dashboard));

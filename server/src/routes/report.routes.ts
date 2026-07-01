import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { ROLES } from '../constants/roles';
import * as report from '../controllers/report.controller';

export const reportRouter = Router();

// Reports & dashboard are profit-sensitive — Owner-only.
reportRouter.use(requireAuth, requireRole(ROLES.OWNER));

reportRouter.get('/pnl', asyncHandler(report.pnl));
reportRouter.get('/sales', asyncHandler(report.sales));
reportRouter.get('/purchases', asyncHandler(report.purchases));
reportRouter.get('/expenses', asyncHandler(report.expenses));
reportRouter.get('/receivables', asyncHandler(report.receivables));
reportRouter.get('/payables', asyncHandler(report.payables));
reportRouter.get('/business-worth', asyncHandler(report.worth));

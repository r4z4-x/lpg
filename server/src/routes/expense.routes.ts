import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { idempotency } from '../middlewares/idempotency.middleware';
import { ROLES } from '../constants/roles';
import { createCategorySchema, createExpenseSchema } from '../validators/expense.validator';
import * as expense from '../controllers/expense.controller';

export const expenseRouter = Router();

expenseRouter.use(requireAuth); // Owner + Operator (operators may record expenses)

expenseRouter.post('/', idempotency, validate(createExpenseSchema), asyncHandler(expense.create));
expenseRouter.get('/', asyncHandler(expense.list));
expenseRouter.get('/categories', asyncHandler(expense.listCategories));
expenseRouter.post(
  '/categories',
  requireRole(ROLES.OWNER),
  validate(createCategorySchema),
  asyncHandler(expense.createCategory),
);

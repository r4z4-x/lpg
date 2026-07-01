import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { cashMovementSchema, closeDaySchema } from '../validators/expense.validator';
import * as cash from '../controllers/cash.controller';

export const cashRouter = Router();

cashRouter.use(requireAuth); // Owner + Operator

cashRouter.post('/movements', validate(cashMovementSchema), asyncHandler(cash.movement));
cashRouter.post('/closings', validate(closeDaySchema), asyncHandler(cash.close));

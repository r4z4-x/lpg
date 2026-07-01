import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { idempotency } from '../middlewares/idempotency.middleware';
import { returnCylinderSchema } from '../validators/cylinder.validator';
import * as cylinder from '../controllers/cylinder.controller';

export const cylinderRouter = Router();

cylinderRouter.use(requireAuth); // Owner + Operator

cylinderRouter.post('/returns', idempotency, validate(returnCylinderSchema), asyncHandler(cylinder.returnCylinders));
cylinderRouter.get('/pending', asyncHandler(cylinder.pending));

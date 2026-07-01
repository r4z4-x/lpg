import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/rbac.middleware';
import { ROLES } from '../constants/roles';
import {
  createUserSchema,
  idParamSchema,
  resetPasswordSchema,
  updateUserSchema,
} from '../validators/user.validator';
import * as userController from '../controllers/user.controller';

export const userRouter = Router();

// User management is Owner-only.
userRouter.use(requireAuth, requireRole(ROLES.OWNER));

userRouter.post('/', validate(createUserSchema), asyncHandler(userController.create));
userRouter.get('/', asyncHandler(userController.list));
userRouter.get('/:id', validate(idParamSchema, 'params'), asyncHandler(userController.getById));
userRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateUserSchema),
  asyncHandler(userController.update),
);
userRouter.post(
  '/:id/reset-password',
  validate(idParamSchema, 'params'),
  validate(resetPasswordSchema),
  asyncHandler(userController.resetPassword),
);

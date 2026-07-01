import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { loginSchema, refreshSchema } from '../validators/auth.validator';
import * as authController from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema), asyncHandler(authController.login));
authRouter.post('/refresh', validate(refreshSchema), asyncHandler(authController.refresh));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.post('/logout-all', requireAuth, asyncHandler(authController.logoutAll));
authRouter.get('/me', requireAuth, asyncHandler(authController.me));

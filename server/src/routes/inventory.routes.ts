import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middlewares/auth.middleware';
import * as inventoryController from '../controllers/inventory.controller';

export const inventoryRouter = Router();

// Stock is viewable by any authenticated user (valuation specifics are fine for ops).
inventoryRouter.use(requireAuth);

inventoryRouter.get('/gas', asyncHandler(inventoryController.getGas));
inventoryRouter.get('/cylinders', asyncHandler(inventoryController.listCylinders));

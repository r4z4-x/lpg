import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middlewares/validate.middleware';
import { requireAuth } from '../middlewares/auth.middleware';
import { idParamSchema } from '../validators/user.validator';
import { createCustomerSchema } from '../validators/sale.validator';
import * as customer from '../controllers/customer.controller';
import * as cylinder from '../controllers/cylinder.controller';

export const customerRouter = Router();

customerRouter.use(requireAuth); // Owner + Operator (operators may create customers)

customerRouter.post('/', validate(createCustomerSchema), asyncHandler(customer.create));
customerRouter.get('/', asyncHandler(customer.list));
customerRouter.get('/:id', validate(idParamSchema, 'params'), asyncHandler(customer.getById));
customerRouter.get('/:id/ledger', validate(idParamSchema, 'params'), asyncHandler(customer.ledger));
customerRouter.get('/:id/cylinders', validate(idParamSchema, 'params'), asyncHandler(cylinder.forCustomer));

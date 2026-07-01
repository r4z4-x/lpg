import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import * as customerService from '../services/customer.service';

export async function create(req: Request, res: Response): Promise<void> {
  ok(res, { customer: await customerService.createCustomer(req.body, req.user!.id) }, 201);
}

export async function list(_req: Request, res: Response): Promise<void> {
  ok(res, { customers: await customerService.listCustomers() });
}

export async function getById(req: Request, res: Response): Promise<void> {
  ok(res, { customer: await customerService.getCustomer(req.params.id!) });
}

export async function ledger(req: Request, res: Response): Promise<void> {
  ok(res, { entries: await customerService.customerLedger(req.params.id!) });
}

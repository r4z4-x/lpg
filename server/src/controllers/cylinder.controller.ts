import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import * as holdingService from '../services/holding.service';

export async function returnCylinders(req: Request, res: Response): Promise<void> {
  const result = await holdingService.returnCylinders(req.body, req.user!.id);
  ok(res, result, 201);
}

export async function pending(_req: Request, res: Response): Promise<void> {
  ok(res, { pending: await holdingService.listPending() });
}

export async function forCustomer(req: Request, res: Response): Promise<void> {
  ok(res, { holdings: await holdingService.listForCustomer(req.params.id!) });
}

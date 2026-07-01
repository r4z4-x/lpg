import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import * as purchaseService from '../services/purchase.service';

export async function create(req: Request, res: Response): Promise<void> {
  ok(res, { purchase: await purchaseService.createPurchase(req.body, req.user!.id) }, 201);
}

export async function list(_req: Request, res: Response): Promise<void> {
  ok(res, { purchases: await purchaseService.listPurchases() });
}

export async function getById(req: Request, res: Response): Promise<void> {
  ok(res, { purchase: await purchaseService.getPurchase(req.params.id!) });
}

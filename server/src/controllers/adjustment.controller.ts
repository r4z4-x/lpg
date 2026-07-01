import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import * as adjustmentService from '../services/adjustment.service';

export async function create(req: Request, res: Response): Promise<void> {
  ok(res, { adjustment: await adjustmentService.createAdjustment(req.body, req.user!.id) }, 201);
}

export async function list(_req: Request, res: Response): Promise<void> {
  ok(res, { adjustments: await adjustmentService.listAdjustments() });
}

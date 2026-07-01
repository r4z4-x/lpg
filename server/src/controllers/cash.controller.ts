import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import * as cashService from '../services/cash.service';

export async function movement(req: Request, res: Response): Promise<void> {
  ok(res, { result: await cashService.cashMovement(req.body, req.user!.id) }, 201);
}

export async function close(req: Request, res: Response): Promise<void> {
  ok(res, { closing: await cashService.closeDay(req.body, req.user!.id) }, 201);
}

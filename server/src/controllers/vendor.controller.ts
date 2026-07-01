import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import * as vendorService from '../services/vendor.service';
import * as paymentService from '../services/payment.service';

export async function create(req: Request, res: Response): Promise<void> {
  ok(res, { vendor: await vendorService.createVendor(req.body, req.user!.id) }, 201);
}

export async function list(_req: Request, res: Response): Promise<void> {
  ok(res, { vendors: await vendorService.listVendors() });
}

export async function getById(req: Request, res: Response): Promise<void> {
  ok(res, { vendor: await vendorService.getVendor(req.params.id!) });
}

export async function ledger(req: Request, res: Response): Promise<void> {
  ok(res, { entries: await vendorService.vendorLedger(req.params.id!) });
}

export async function aging(req: Request, res: Response): Promise<void> {
  ok(res, { aging: await paymentService.vendorAging(req.params.id!) });
}

export async function pay(req: Request, res: Response): Promise<void> {
  const payment = await paymentService.payVendor(
    { ...req.body, vendorId: req.params.id! },
    req.user!.id,
  );
  ok(res, { payment }, 201);
}

import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import { ROLES } from '../constants/roles';
import * as saleService from '../services/sale.service';

function isOwner(req: Request): boolean {
  return req.user!.role === ROLES.OWNER;
}

export async function create(req: Request, res: Response): Promise<void> {
  const sale = await saleService.createSale(req.body, req.user!.id);
  ok(res, { sale: saleService.serializeSale(sale, isOwner(req)) }, 201);
}

export async function list(req: Request, res: Response): Promise<void> {
  const sales = await saleService.listSales();
  ok(res, { sales: sales.map((s) => saleService.serializeSale(s, isOwner(req))) });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const sale = await saleService.getSale(req.params.id!);
  ok(res, { sale: saleService.serializeSale(sale, isOwner(req)) });
}

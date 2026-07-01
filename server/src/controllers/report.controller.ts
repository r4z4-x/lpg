import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import * as reportService from '../services/report.service';
import { businessWorth } from '../services/businessWorth.service';

function range(req: Request): { from: string; to: string } {
  const from = String(req.query.from ?? '0000-01-01');
  const to = String(req.query.to ?? '9999-12-31');
  return { from, to };
}

export async function pnl(req: Request, res: Response): Promise<void> {
  const { from, to } = range(req);
  ok(res, { pnl: await reportService.profitAndLoss(from, to) });
}

export async function sales(req: Request, res: Response): Promise<void> {
  const { from, to } = range(req);
  ok(res, { report: await reportService.salesReport(from, to) });
}

export async function purchases(req: Request, res: Response): Promise<void> {
  const { from, to } = range(req);
  ok(res, { report: await reportService.purchaseReport(from, to) });
}

export async function expenses(req: Request, res: Response): Promise<void> {
  const { from, to } = range(req);
  ok(res, { report: await reportService.expenseReport(from, to) });
}

export async function receivables(_req: Request, res: Response): Promise<void> {
  ok(res, { customers: await reportService.receivables() });
}

export async function payables(_req: Request, res: Response): Promise<void> {
  ok(res, { vendors: await reportService.payables() });
}

export async function dashboard(_req: Request, res: Response): Promise<void> {
  ok(res, { dashboard: await reportService.dashboard() });
}

export async function worth(_req: Request, res: Response): Promise<void> {
  ok(res, { businessWorth: await businessWorth() });
}

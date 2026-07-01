import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import * as expenseService from '../services/expense.service';

export async function create(req: Request, res: Response): Promise<void> {
  ok(res, { expense: await expenseService.createExpense(req.body, req.user!.id) }, 201);
}

export async function list(_req: Request, res: Response): Promise<void> {
  ok(res, { expenses: await expenseService.listExpenses() });
}

export async function listCategories(_req: Request, res: Response): Promise<void> {
  ok(res, { categories: await expenseService.listCategories() });
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  ok(res, { category: await expenseService.createCategory(req.body.name, req.body.accountCode) }, 201);
}

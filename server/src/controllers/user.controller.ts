import type { Request, Response } from 'express';
import { ok } from '../utils/response';
import * as userService from '../services/user.service';
import type { Role } from '../constants/roles';

export async function create(req: Request, res: Response): Promise<void> {
  const user = await userService.createUser(req.body);
  ok(res, { user }, 201);
}

export async function list(_req: Request, res: Response): Promise<void> {
  const users = await userService.listUsers();
  ok(res, { users });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const user = await userService.getUser(req.params.id!);
  ok(res, { user });
}

export async function update(req: Request, res: Response): Promise<void> {
  const user = await userService.updateUser(req.params.id!, req.body as { role?: Role });
  ok(res, { user });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await userService.resetPassword(req.params.id!, req.body.password);
  ok(res, { reset: true });
}

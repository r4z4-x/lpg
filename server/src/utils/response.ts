import type { Response } from 'express';

/** Standard success envelope. */
export interface SuccessBody<T> {
  ok: true;
  data: T;
}

/** Standard error envelope. */
export interface ErrorBody {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}

export function ok<T>(res: Response, data: T, status = 200): Response {
  const body: SuccessBody<T> = { ok: true, data };
  return res.status(status).json(body);
}

export function fail(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const body: ErrorBody = { ok: false, error: { code, message, ...(details ? { details } : {}) } };
  return res.status(status).json(body);
}

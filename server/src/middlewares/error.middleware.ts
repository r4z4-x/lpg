import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { fail } from '../utils/response';
import { logger } from '../config/logger';
import { env } from '../config/env';

/** Central error handler. Maps AppError → its status/code; everything else → 500. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, { code: err.code, requestId: req.requestId });
    }
    fail(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  logger.error('Unhandled error', { message, requestId: req.requestId });
  fail(
    res,
    500,
    'INTERNAL_ERROR',
    env.NODE_ENV === 'production' ? 'Internal server error' : message,
  );
}

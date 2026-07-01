import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { verifyAccessToken } from '../services/token.service';
import type { AuthUser } from '../types/express';

/** Verifies the Bearer access token and attaches the principal to req.user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing bearer token'));
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length));
    req.user = { id: payload.sub, role: payload.role, name: payload.name };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

/**
 * Test/dev helper: attach a fixed user without a token. Useful for unit-testing
 * middleware/handlers in isolation.
 */
export function attachUser(user: AuthUser): RequestHandler {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

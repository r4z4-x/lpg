import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { IdempotencyKey } from '../models/idempotencyKey.model';
import { fail } from '../utils/response';

const HEADER = 'idempotency-key';

function hashRequest(req: Request): string {
  return crypto
    .createHash('sha256')
    .update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body ?? {})}`)
    .digest('hex');
}

/**
 * Idempotency middleware. When an `Idempotency-Key` header is present:
 *  - a completed key with a matching request replays the stored response;
 *  - the same key with a different request payload is rejected (409 reuse);
 *  - an in-progress key is rejected (409 in-progress);
 *  - otherwise a reservation is created and the handler's JSON response is captured.
 * Without the header the request passes through unchanged.
 */
export const idempotency: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const key = req.header(HEADER);
  if (!key) {
    next();
    return;
  }

  const requestHash = hashRequest(req);

  void (async () => {
    const existing = await IdempotencyKey.findOne({ key });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        fail(res, 409, 'IDEMPOTENCY_KEY_REUSE', 'Idempotency-Key reused with a different request');
        return;
      }
      if (existing.status === 'completed' && existing.statusCode) {
        res.status(existing.statusCode).json(existing.responseSnapshot);
        return;
      }
      fail(res, 409, 'REQUEST_IN_PROGRESS', 'A request with this Idempotency-Key is in progress');
      return;
    }

    try {
      await IdempotencyKey.create([
        { key, requestHash, endpoint: `${req.method} ${req.originalUrl}`, status: 'in_progress' },
      ]);
    } catch (err) {
      // Unique-index race: another request reserved the key first.
      if ((err as { code?: number }).code === 11000) {
        fail(res, 409, 'REQUEST_IN_PROGRESS', 'Duplicate request in progress');
        return;
      }
      next(err as Error);
      return;
    }

    // Capture the response body so a future retry can replay it. The snapshot is
    // persisted BEFORE the body is sent, so an immediate retry reliably replays it.
    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      IdempotencyKey.updateOne(
        { key },
        { $set: { status: 'completed', statusCode: res.statusCode, responseSnapshot: body } },
      )
        .catch(() => undefined)
        .finally(() => {
          originalJson(body);
        });
      return res;
    };

    next();
  })().catch(next);
};

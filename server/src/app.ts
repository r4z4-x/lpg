import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { ok } from './utils/response';
import { errorHandler } from './middlewares/error.middleware';
import { apiRouter } from './routes';

/** Builds the Express app. */
export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => ok(res, { status: 'ok' }));
  app.use('/', apiRouter);

  // Error handler must be registered last.
  app.use(errorHandler);
  return app;
}

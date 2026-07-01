import express, { type Express } from 'express';
import { Schema, model } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { idempotency } from '../middlewares/idempotency.middleware';
import { ok } from '../utils/response';

const Thing = model('Thing', new Schema({ name: String }));

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.post('/things', idempotency, async (req, res) => {
    await Thing.create({ name: req.body.name });
    const total = await Thing.countDocuments();
    ok(res, { total }, 201);
  });
  return app;
}

useTestDb();

describe('idempotency middleware', () => {
  it('creates one effect and replays the stored response on retry', async () => {
    const app = buildApp();
    const headers = { 'Idempotency-Key': 'key-123' };

    const first = await request(app).post('/things').set(headers).send({ name: 'a' });
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ ok: true, data: { total: 1 } });

    const retry = await request(app).post('/things').set(headers).send({ name: 'a' });
    expect(retry.status).toBe(201);
    expect(retry.body).toEqual({ ok: true, data: { total: 1 } });

    // Exactly one document was created despite two requests.
    expect(await Thing.countDocuments()).toBe(1);
  });

  it('rejects the same key with a different payload (409)', async () => {
    const app = buildApp();
    await request(app).post('/things').set({ 'Idempotency-Key': 'key-x' }).send({ name: 'a' });

    const conflict = await request(app)
      .post('/things')
      .set({ 'Idempotency-Key': 'key-x' })
      .send({ name: 'DIFFERENT' });

    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_KEY_REUSE');
  });

  it('passes through when no key is supplied', async () => {
    const app = buildApp();
    await request(app).post('/things').send({ name: 'a' });
    await request(app).post('/things').send({ name: 'b' });
    expect(await Thing.countDocuments()).toBe(2);
  });
});

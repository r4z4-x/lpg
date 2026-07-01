import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { createApp } from '../app';
import { createUser } from '../services/user.service';
import { seedAccounts } from '../services/account.service';
import { ROLES } from '../constants/roles';

useTestDb();

const app = createApp();
const OWNER = { name: 'Owner', email: 'owner@test.com', password: 'password123', role: ROLES.OWNER };

async function tokenFor(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.data.accessToken;
}

beforeEach(async () => {
  await seedAccounts();
  await createUser(OWNER);
});

describe('system setup (Owner only)', () => {
  it('reads and updates company settings', async () => {
    const owner = await tokenFor(OWNER.email, OWNER.password);

    const get = await request(app).get('/setup/settings').set('Authorization', `Bearer ${owner}`);
    expect(get.status).toBe(200);
    expect(get.body.data.settings.tax.enabled).toBe(false); // no tax in V1

    const patch = await request(app)
      .patch('/setup/settings')
      .set('Authorization', `Bearer ${owner}`)
      .send({ companyName: 'Acme LPG', defaultSaleRate: '200' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.settings.companyName).toBe('Acme LPG');
    expect(patch.body.data.settings.defaultSaleRateMinor).toBe(20000); // 200.00
  });

  it('creates and lists cylinder types', async () => {
    const owner = await tokenFor(OWNER.email, OWNER.password);

    const created = await request(app)
      .post('/setup/cylinder-types')
      .set('Authorization', `Bearer ${owner}`)
      .send({ name: 'Domestic Standard', capacityKg: '11.8', tareKg: '15.5' });
    expect(created.status).toBe(201);
    expect(created.body.data.cylinderType.capacityKgSub).toBe(11800);

    const list = await request(app)
      .get('/setup/cylinder-types')
      .set('Authorization', `Bearer ${owner}`);
    expect(list.body.data.cylinderTypes).toHaveLength(1);
  });

  it('forbids an Operator from system setup', async () => {
    const owner = await tokenFor(OWNER.email, OWNER.password);
    await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${owner}`)
      .send({ name: 'Op', email: 'op@test.com', password: 'operator123', role: ROLES.OPERATOR });

    const op = await tokenFor('op@test.com', 'operator123');
    const res = await request(app).get('/setup/settings').set('Authorization', `Bearer ${op}`);
    expect(res.status).toBe(403);
  });
});

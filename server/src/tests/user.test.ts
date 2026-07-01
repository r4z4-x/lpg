import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { createApp } from '../app';
import { createUser } from '../services/user.service';
import { ROLES } from '../constants/roles';

useTestDb();

const app = createApp();
const OWNER = { name: 'Owner', email: 'owner@test.com', password: 'password123', role: ROLES.OWNER };

async function tokenFor(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.data.accessToken;
}

beforeEach(async () => {
  await createUser(OWNER);
});

describe('user management (Owner only)', () => {
  it('lets an Owner create, list, update and reset users', async () => {
    const owner = await tokenFor(OWNER.email, OWNER.password);

    const created = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${owner}`)
      .send({ name: 'Op', email: 'op@test.com', password: 'operator123', role: ROLES.OPERATOR });
    expect(created.status).toBe(201);
    const opId = created.body.data.user._id;

    const list = await request(app).get('/users').set('Authorization', `Bearer ${owner}`);
    expect(list.status).toBe(200);
    expect(list.body.data.users).toHaveLength(2);

    // Reset the operator's password, then verify the new password logs in.
    const reset = await request(app)
      .post(`/users/${opId}/reset-password`)
      .set('Authorization', `Bearer ${owner}`)
      .send({ password: 'newpassword1' });
    expect(reset.status).toBe(200);
    const opToken = await tokenFor('op@test.com', 'newpassword1');
    expect(opToken).toBeTruthy();
  });

  it('forbids an Operator from managing users', async () => {
    const owner = await tokenFor(OWNER.email, OWNER.password);
    await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${owner}`)
      .send({ name: 'Op', email: 'op@test.com', password: 'operator123', role: ROLES.OPERATOR });

    const op = await tokenFor('op@test.com', 'operator123');
    const forbidden = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${op}`)
      .send({ name: 'X', email: 'x@test.com', password: 'whatever1', role: ROLES.OPERATOR });
    expect(forbidden.status).toBe(403);
  });

  it('soft-disables a user, blocking their login', async () => {
    const owner = await tokenFor(OWNER.email, OWNER.password);
    const created = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${owner}`)
      .send({ name: 'Op', email: 'op@test.com', password: 'operator123', role: ROLES.OPERATOR });
    const opId = created.body.data.user._id;

    await request(app)
      .patch(`/users/${opId}`)
      .set('Authorization', `Bearer ${owner}`)
      .send({ isActive: false });

    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'op@test.com', password: 'operator123' });
    expect(login.status).toBe(401);
  });

  it('rejects creation with a weak password and duplicate email', async () => {
    const owner = await tokenFor(OWNER.email, OWNER.password);

    const weak = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${owner}`)
      .send({ name: 'Op', email: 'op@test.com', password: 'short', role: ROLES.OPERATOR });
    expect(weak.status).toBe(400);

    const dup = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${owner}`)
      .send({ name: 'Dup', email: OWNER.email, password: 'password123', role: ROLES.OPERATOR });
    expect(dup.status).toBe(409);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/users');
    expect(res.status).toBe(401);
  });
});

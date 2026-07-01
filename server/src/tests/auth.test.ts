import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { createApp } from '../app';
import { createUser } from '../services/user.service';
import { ROLES } from '../constants/roles';

useTestDb();

const app = createApp();
const OWNER = { name: 'Owner', email: 'owner@test.com', password: 'password123', role: ROLES.OWNER };

beforeEach(async () => {
  await createUser(OWNER);
});

/** Pulls the raw refresh token out of a Set-Cookie header. */
function refreshFromCookie(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[];
  const cookie = cookies.find((c) => c.startsWith('refreshToken='))!;
  return decodeURIComponent(cookie.split(';')[0]!.split('=')[1]!);
}

async function loginOwner() {
  return request(app).post('/auth/login').send({ email: OWNER.email, password: OWNER.password });
}

describe('auth', () => {
  it('logs in with valid credentials and issues tokens', async () => {
    const res = await loginOwner();
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(OWNER.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(refreshFromCookie(res)).toBeTruthy();
  });

  it('rejects invalid credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: OWNER.email, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('protects /me and accepts a valid bearer token', async () => {
    const login = await loginOwner();
    const token = login.body.data.accessToken;

    const unauth = await request(app).get('/auth/me');
    expect(unauth.status).toBe(401);

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(OWNER.email);
  });

  it('rotates the refresh token and detects reuse', async () => {
    const login = await loginOwner();
    const oldToken = refreshFromCookie(login);

    // Rotate: old token issues a new one.
    const rotated = await request(app).post('/auth/refresh').send({ refreshToken: oldToken });
    expect(rotated.status).toBe(200);
    const newToken = refreshFromCookie(rotated);
    expect(newToken).not.toBe(oldToken);

    // Reusing the now-revoked old token is rejected...
    const reuse = await request(app).post('/auth/refresh').send({ refreshToken: oldToken });
    expect(reuse.status).toBe(401);

    // ...and the whole family is revoked, so the new token no longer works either.
    const afterBreach = await request(app).post('/auth/refresh').send({ refreshToken: newToken });
    expect(afterBreach.status).toBe(401);
  });

  it('logs out by revoking the refresh token', async () => {
    const login = await loginOwner();
    const token = refreshFromCookie(login);

    await request(app).post('/auth/logout').send({ refreshToken: token });

    const afterLogout = await request(app).post('/auth/refresh').send({ refreshToken: token });
    expect(afterLogout.status).toBe(401);
  });
});

import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';
import { ok } from '../utils/response';
import { UnauthorizedError } from '../utils/errors';
import * as authService from '../services/auth.service';
import { getUser } from '../services/user.service';

const REFRESH_COOKIE = 'refreshToken';

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

function readRefreshToken(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const issued = await authService.login(email, password, req.ip);
  setRefreshCookie(res, issued.refreshToken);
  ok(res, { accessToken: issued.accessToken, user: issued.user });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = readRefreshToken(req);
  if (!token) throw new UnauthorizedError('Missing refresh token');
  const issued = await authService.refresh(token, req.ip);
  setRefreshCookie(res, issued.refreshToken);
  ok(res, { accessToken: issued.accessToken, user: issued.user });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = readRefreshToken(req);
  if (token) await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  ok(res, { loggedOut: true });
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  await authService.logoutAll(req.user!.id);
  res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  ok(res, { loggedOut: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await getUser(req.user!.id);
  ok(res, { user });
}

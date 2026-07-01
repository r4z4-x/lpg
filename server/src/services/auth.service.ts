import { Types } from 'mongoose';
import { User } from '../models/user.model';
import { RefreshToken } from '../models/refreshToken.model';
import type { Role } from '../constants/roles';
import { UnauthorizedError } from '../utils/errors';
import { verifyPassword } from './user.service';
import {
  type AccessPayload,
  generateRefreshToken,
  hashToken,
  refreshExpiryDate,
  signAccessToken,
} from './token.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string; role: AccessPayload['role'] };
}

async function issueForUser(
  userId: Types.ObjectId,
  role: AccessPayload['role'],
  name: string,
  email: string,
  family: string,
  ip?: string | null,
): Promise<IssuedTokens> {
  const accessToken = signAccessToken({ sub: String(userId), role, name });
  const refreshToken = generateRefreshToken();
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(refreshToken),
    family,
    expiresAt: refreshExpiryDate(),
    ip: ip ?? null,
  });
  return { accessToken, refreshToken, user: { id: String(userId), name, email, role } };
}

/** Authenticates by email + password and starts a new refresh-token family. */
export async function login(
  email: string,
  password: string,
  ip?: string | null,
): Promise<IssuedTokens> {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  if (!user || !user.isActive) throw new UnauthorizedError('Invalid credentials');

  const okPassword = await verifyPassword(password, user.passwordHash);
  if (!okPassword) throw new UnauthorizedError('Invalid credentials');

  const family = new Types.ObjectId().toString();
  return issueForUser(user._id, user.role as Role, user.name, user.email, family, ip);
}

/**
 * Rotates a refresh token: revokes the presented token and issues a new one in the same
 * family. If a *already-revoked* token is presented, the family is assumed compromised and
 * every token in it is revoked.
 */
export async function refresh(rawToken: string, ip?: string | null): Promise<IssuedTokens> {
  const tokenHash = hashToken(rawToken);
  const record = await RefreshToken.findOne({ tokenHash });
  if (!record) throw new UnauthorizedError('Invalid refresh token');

  if (record.revokedAt) {
    // Reuse of a rotated token → revoke the whole family.
    await RefreshToken.updateMany(
      { family: record.family, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw new UnauthorizedError('Refresh token reuse detected; session revoked');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError('Refresh token expired');
  }

  const user = await User.findById(record.userId);
  if (!user || !user.isActive) throw new UnauthorizedError('Account is inactive');

  const issued = await issueForUser(
    user._id,
    user.role as Role,
    user.name,
    user.email,
    record.family,
    ip,
  );

  record.revokedAt = new Date();
  record.replacedByHash = hashToken(issued.refreshToken);
  await record.save();

  return issued;
}

/** Revokes a single refresh token (logout on one device). */
export async function logout(rawToken: string): Promise<void> {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

/** Revokes every active refresh token for a user (logout everywhere). */
export async function logoutAll(userId: string | Types.ObjectId): Promise<void> {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

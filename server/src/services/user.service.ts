import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { User } from '../models/user.model';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ROLES, type Role } from '../constants/roles';
import { ConflictError, NotFoundError } from '../utils/errors';

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export async function createUser(input: CreateUserInput) {
  const email = input.email.toLowerCase().trim();
  const exists = await User.findOne({ email });
  if (exists) throw new ConflictError('A user with this email already exists', 'EMAIL_TAKEN');

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    name: input.name,
    email,
    passwordHash,
    role: input.role,
  });
  return user;
}

export function listUsers() {
  return User.find().sort({ createdAt: -1 });
}

export async function getUser(id: string | Types.ObjectId) {
  const user = await User.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export interface UpdateUserInput {
  name?: string;
  role?: Role;
  isActive?: boolean;
}

export async function updateUser(id: string | Types.ObjectId, input: UpdateUserInput) {
  const user = await User.findByIdAndUpdate(id, { $set: input }, { new: true });
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function resetPassword(id: string | Types.ObjectId, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  const user = await User.findByIdAndUpdate(id, { $set: { passwordHash } }, { new: true });
  if (!user) throw new NotFoundError('User not found');
  return user;
}

/** Idempotently creates the bootstrap Owner if no owner exists yet. */
export async function seedOwner(): Promise<void> {
  const existing = await User.findOne({ role: ROLES.OWNER });
  if (existing) {
    logger.info('Owner already present, skipping bootstrap', { email: existing.email });
    return;
  }
  await createUser({
    name: env.OWNER_NAME,
    email: env.OWNER_EMAIL,
    password: env.OWNER_PASSWORD,
    role: ROLES.OWNER,
  });
  logger.warn('Bootstrap owner created — change the password immediately', {
    email: env.OWNER_EMAIL,
  });
}

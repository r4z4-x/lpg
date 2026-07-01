import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Refresh-token records (rotation + reuse detection). The raw token is never stored —
 * only its SHA-256 hash. Tokens belong to a `family`: rotating issues a new token in the
 * same family and revokes the old one. Presenting an already-revoked token signals theft,
 * so the whole family is revoked.
 */
const refreshTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true },
  family: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  replacedByHash: { type: String, default: null },
  ip: { type: String, default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

refreshTokenSchema.index({ userId: 1 });
refreshTokenSchema.index({ family: 1 });
// Auto-remove documents shortly after expiry.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = InferSchemaType<typeof refreshTokenSchema>;
export const RefreshToken = model('RefreshToken', refreshTokenSchema);

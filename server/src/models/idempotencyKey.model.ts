import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Stores idempotency reservations and their captured responses.
 * TTL index expires keys automatically (default 24h) so the collection stays bounded.
 */
const idempotencyKeySchema = new Schema({
  key: { type: String, required: true, unique: true },
  requestHash: { type: String, required: true },
  endpoint: { type: String, default: '' },
  status: { type: String, required: true, enum: ['in_progress', 'completed'], default: 'in_progress' },
  statusCode: { type: Number, default: null },
  responseSnapshot: { type: Schema.Types.Mixed, default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

// Expire 24h after creation.
idempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export type IdempotencyKeyDoc = InferSchemaType<typeof idempotencyKeySchema>;
export const IdempotencyKey = model('IdempotencyKey', idempotencyKeySchema);

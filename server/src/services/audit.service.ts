import { type ClientSession, Types } from 'mongoose';
import { AuditTrail } from '../models/auditTrail.model';

export interface AuditInput {
  userId: Types.ObjectId | string;
  action: string; // 'create' | 'update' | 'reverse' | ...
  entity: string; // 'Sale' | 'Purchase' | ...
  entityId?: Types.ObjectId | string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
  timestamp?: Date;
}

/**
 * Records an audit entry. When a `session` is supplied the write participates in the
 * caller's transaction — so the change and its audit record commit or roll back together
 * (no change without an audit, no audit without the change).
 */
export async function record(input: AuditInput, session?: ClientSession) {
  const payload = {
    userId: input.userId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    ip: input.ip ?? null,
    timestamp: input.timestamp ?? new Date(),
  };
  const [doc] = await AuditTrail.create([payload], session ? { session } : {});
  return doc;
}

import { Schema, model, type InferSchemaType } from 'mongoose';

/** Immutable record of who changed what, when, with before/after snapshots. */
const auditTrailSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true },
  action: { type: String, required: true }, // e.g. 'create', 'update', 'reverse'
  entity: { type: String, required: true }, // e.g. 'Sale', 'Purchase', 'InventoryAdjustment'
  entityId: { type: Schema.Types.ObjectId, default: null },
  oldValue: { type: Schema.Types.Mixed, default: null },
  newValue: { type: Schema.Types.Mixed, default: null },
  ip: { type: String, default: null },
  timestamp: { type: Date, required: true, default: () => new Date() },
});

auditTrailSchema.index({ entity: 1, entityId: 1 });
auditTrailSchema.index({ userId: 1 });
auditTrailSchema.index({ timestamp: 1 });

export type AuditTrailDoc = InferSchemaType<typeof auditTrailSchema>;
export const AuditTrail = model('AuditTrail', auditTrailSchema);

import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Append-only double-entry journal. Amounts are stored as integer minor units (paisa).
 * Entries are IMMUTABLE: update operations are blocked at the schema level. Corrections
 * are made via reversing entries (see ledger.service.reverse).
 */
const ledgerLineSchema = new Schema(
  {
    accountCode: { type: String, required: true },
    debitMinor: { type: Number, required: true, default: 0, min: 0 },
    creditMinor: { type: Number, required: true, default: 0, min: 0 },
    partyType: { type: String, enum: ['Customer', 'Vendor', null], default: null },
    partyId: { type: Schema.Types.ObjectId, default: null },
  },
  { _id: false },
);

const ledgerEntrySchema = new Schema(
  {
    entryNo: { type: Number, required: true, unique: true },
    date: { type: Date, required: true },
    businessDate: { type: String, required: true }, // YYYY-MM-DD in business TZ
    sourceType: {
      type: String,
      required: true,
      enum: [
        'Sale',
        'Purchase',
        'Payment',
        'Expense',
        'Adjustment',
        'Return',
        'Opening',
        'Closing',
        'Reversal',
      ],
    },
    sourceId: { type: Schema.Types.ObjectId, default: null },
    memo: { type: String, default: '' },
    lines: {
      type: [ledgerLineSchema],
      required: true,
      validate: { validator: (v: unknown[]) => v.length >= 2, message: 'At least 2 lines required' },
    },
    totalDebitMinor: { type: Number, required: true },
    totalCreditMinor: { type: Number, required: true },
    reversalOf: { type: Schema.Types.ObjectId, ref: 'LedgerEntry', default: null },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ledgerEntrySchema.index({ date: 1 });
ledgerEntrySchema.index({ businessDate: 1 });
ledgerEntrySchema.index({ sourceType: 1, sourceId: 1 });
ledgerEntrySchema.index({ 'lines.accountCode': 1 });
ledgerEntrySchema.index({ 'lines.partyId': 1 });

// --- Immutability guards ---------------------------------------------------
ledgerEntrySchema.pre('save', function (next) {
  if (!this.isNew) {
    next(new Error('LedgerEntry is immutable; post a reversing entry instead'));
    return;
  }
  next();
});

const blockedOps = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
] as const;
for (const op of blockedOps) {
  ledgerEntrySchema.pre(op, function (next) {
    next(new Error(`LedgerEntry is immutable; "${op}" is not allowed`));
  });
}

export type LedgerEntryDoc = InferSchemaType<typeof ledgerEntrySchema>;
export const LedgerEntry = model('LedgerEntry', ledgerEntrySchema);

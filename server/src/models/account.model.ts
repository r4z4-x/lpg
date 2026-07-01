import { Schema, model, type InferSchemaType } from 'mongoose';

const accountSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['Asset', 'Liability', 'Equity', 'Income', 'Expense'],
    },
    normalSide: { type: String, required: true, enum: ['Debit', 'Credit'] },
    isContra: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

accountSchema.index({ type: 1 });

export type AccountDoc = InferSchemaType<typeof accountSchema>;
export const Account = model('Account', accountSchema);

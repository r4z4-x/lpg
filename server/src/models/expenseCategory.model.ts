import { Schema, model } from 'mongoose';

export interface IExpenseCategory {
  name: string;
  accountCode: string; // ledger expense account (6xxx)
  isSystem: boolean;
  isActive: boolean;
}

const expenseCategorySchema = new Schema<IExpenseCategory>({
  name: { type: String, required: true, unique: true },
  accountCode: { type: String, required: true, default: '6070' },
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
});

export const ExpenseCategory = model<IExpenseCategory>('ExpenseCategory', expenseCategorySchema);

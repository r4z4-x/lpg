/**
 * Chart of accounts seed data — mirrors ../../CHART_OF_ACCOUNTS.md.
 * `normalSide` is the side that increases the account. Contra accounts carry the
 * opposite normal side to their class (e.g. Sales Discount is a contra-income debit).
 */

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
export type NormalSide = 'Debit' | 'Credit';

export interface AccountSeed {
  code: string;
  name: string;
  type: AccountType;
  normalSide: NormalSide;
  isContra?: boolean;
}

export const CHART_OF_ACCOUNTS: readonly AccountSeed[] = [
  // Assets (1xxx)
  { code: '1010', name: 'Cash', type: 'Asset', normalSide: 'Debit' },
  { code: '1020', name: 'Bank', type: 'Asset', normalSide: 'Debit' },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', normalSide: 'Debit' },
  { code: '1110', name: 'Advances to Vendors', type: 'Asset', normalSide: 'Debit' },
  { code: '1200', name: 'Gas Inventory', type: 'Asset', normalSide: 'Debit' },
  { code: '1300', name: 'Cylinder Assets', type: 'Asset', normalSide: 'Debit' },

  // Liabilities (2xxx)
  { code: '2010', name: 'Accounts Payable', type: 'Liability', normalSide: 'Credit' },
  { code: '2100', name: 'Cylinder Deposit Liability', type: 'Liability', normalSide: 'Credit' },
  { code: '2200', name: 'Customer Advances', type: 'Liability', normalSide: 'Credit' },
  { code: '2300', name: 'Tax Payable', type: 'Liability', normalSide: 'Credit' },
  { code: '2400', name: 'Accrued Expenses', type: 'Liability', normalSide: 'Credit' },

  // Equity (3xxx)
  { code: '3010', name: 'Owner Capital', type: 'Equity', normalSide: 'Credit' },
  { code: '3020', name: 'Opening Balance Equity', type: 'Equity', normalSide: 'Credit' },
  { code: '3030', name: 'Retained Earnings', type: 'Equity', normalSide: 'Credit' },
  { code: '3040', name: 'Owner Drawings', type: 'Equity', normalSide: 'Debit', isContra: true },

  // Income (4xxx)
  { code: '4010', name: 'Sales Revenue - Gas', type: 'Income', normalSide: 'Credit' },
  { code: '4021', name: 'Charges - Delivery', type: 'Income', normalSide: 'Credit' },
  { code: '4022', name: 'Charges - Cylinder Rent', type: 'Income', normalSide: 'Credit' },
  { code: '4023', name: 'Charges - Loading', type: 'Income', normalSide: 'Credit' },
  { code: '4025', name: 'Charges - Other', type: 'Income', normalSide: 'Credit' },
  { code: '4030', name: 'Damage Recovery Income', type: 'Income', normalSide: 'Credit' },
  { code: '4040', name: 'Cash Over', type: 'Income', normalSide: 'Credit' },
  { code: '4090', name: 'Sales Discount Allowed', type: 'Income', normalSide: 'Debit', isContra: true },

  // Cost of Goods Sold (5xxx)
  { code: '5010', name: 'Cost of Gas Sold', type: 'Expense', normalSide: 'Debit' },
  { code: '5020', name: 'Inventory Loss', type: 'Expense', normalSide: 'Debit' },

  // Operating Expenses (6xxx)
  { code: '6010', name: 'Salary', type: 'Expense', normalSide: 'Debit' },
  { code: '6020', name: 'Labour', type: 'Expense', normalSide: 'Debit' },
  { code: '6030', name: 'Fuel', type: 'Expense', normalSide: 'Debit' },
  { code: '6040', name: 'Maintenance', type: 'Expense', normalSide: 'Debit' },
  { code: '6050', name: 'Office', type: 'Expense', normalSide: 'Debit' },
  { code: '6060', name: 'Utilities', type: 'Expense', normalSide: 'Debit' },
  { code: '6070', name: 'Misc', type: 'Expense', normalSide: 'Debit' },
  { code: '6080', name: 'Cash Short', type: 'Expense', normalSide: 'Debit' },
] as const;

export type Role = 'Owner' | 'Operator';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface SuccessEnvelope<T> {
  ok: true;
  data: T;
}
export interface ErrorEnvelope {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}
export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

// --- Setup ---
export interface Settings {
  companyName: string;
  currency: string;
  businessTimezone: string;
  defaultSaleRateMinor: number;
  tax: { enabled: boolean; ratePercent: number };
  openingLocked: boolean;
}
export interface CylinderType {
  _id: string;
  name: string;
  capacityKgSub: number;
  tareKgSub: number;
  depositAmountMinor: number | null;
  isActive: boolean;
}
export interface PaymentAccount {
  _id: string;
  name: string;
  type: 'Cash' | 'Bank' | 'Wallet';
  openingBalanceMinor: number;
  currentBalanceMinor: number;
  isActive: boolean;
}

// --- Inventory ---
export interface GasInventoryView {
  availableKg: string;
  weightedAvgCost: string;
  inventoryValue: string;
}
export interface CylinderInventoryRow {
  _id: string;
  cylinderTypeId: { _id: string; name: string } | string;
  filled: number;
  empty: number;
  customerHeld: number;
  lost: number;
  damaged: number;
  shellAssetValueMinor: number;
}

// --- Parties ---
export interface Vendor {
  _id: string;
  name: string;
  contact: string | null;
  openingBalanceMinor: number;
  currentPayableMinor: number;
  isActive: boolean;
}
export interface Customer {
  _id: string;
  name: string;
  contact: string | null;
  currentReceivableMinor: number;
  creditLimitMinor: number;
  cylinderLimit: number;
  heldCylinders: number;
  isActive: boolean;
}

// --- Transactions ---
export interface Purchase {
  _id: string;
  purchaseNo: number;
  vendorId: string;
  date: string;
  qtyKgSub: number;
  ratePerKgMinor: number;
  landedCostMinor: number;
  paymentType: 'full' | 'partial' | 'credit';
  amountPaidMinor: number;
}
export interface Sale {
  _id: string;
  invoiceNo: number;
  customerId: string;
  customerType: 'exchange' | 'no_cylinder';
  date: string;
  qtyKgSub: number;
  gasAmountMinor: number;
  invoiceAmountMinor: number;
  cogsMinor?: number; // stripped for Operators
  unitCostAtSaleMinor?: number; // stripped for Operators
  previousBalanceRecoveryMinor: number;
  paymentType: 'full' | 'partial' | 'credit';
}
export interface Expense {
  _id: string;
  category: string;
  amountMinor: number;
  date: string;
  paid: boolean;
  note: string | null;
}
export interface ExpenseCategory {
  _id: string;
  name: string;
  accountCode: string;
  isSystem: boolean;
}
export interface Holding {
  _id: string;
  customerId: { _id: string; name: string } | string;
  cylinderTypeId: { _id: string; name: string } | string;
  qty: number;
  issuedQty: number;
  issueDate: string;
  status: 'held' | 'returned';
}
export interface Adjustment {
  _id: string;
  type: 'leakage' | 'damage' | 'correction';
  gasKgDeltaSub: number;
  valuationImpactMinor: number;
  reason: string;
  createdAt: string;
}

// --- Reports / dashboard ---
export interface Dashboard {
  gas: GasInventoryView;
  cylinders: { filled: number; empty: number; customerHeld: number; lost: number; damaged: number };
  cashInHand: string;
  receivables: string;
  payables: string;
  todaySales: string;
  monthSales: string;
  todayExpenses: string;
  monthExpenses: string;
  grossProfitMTD: string;
  netProfitMTD: string;
}
export interface Pnl {
  from: string;
  to: string;
  revenueMinor: number;
  cogsMinor: number;
  grossProfitMinor: number;
  operatingExpensesMinor: number;
  netProfitMinor: number;
}
export interface BusinessWorth {
  assetsMinor: number;
  liabilitiesMinor: number;
  businessWorthMinor: number;
  equityMinor: number;
  retainedEarningsMinor: number;
  balanced: boolean;
  breakdown: {
    assets: { cash: number; receivables: number; gasInventory: number; cylinderAssets: number };
    liabilities: { payables: number; cylinderDeposits: number; accruedExpenses: number };
  };
}

export interface LedgerEntry {
  _id: string;
  entryNo: number;
  date: string;
  businessDate: string;
  sourceType: string;
  memo: string;
  lines: { accountCode: string; debitMinor: number; creditMinor: number }[];
}

import { request, type RequestOptions } from './client';
import type {
  Adjustment,
  BusinessWorth,
  Customer,
  CylinderInventoryRow,
  CylinderType,
  Dashboard,
  Expense,
  ExpenseCategory,
  GasInventoryView,
  Holding,
  LedgerEntry,
  PaymentAccount,
  Pnl,
  Purchase,
  Sale,
  Settings,
  User,
  Vendor,
} from './types';

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body: unknown, opts?: RequestOptions) =>
  request<T>(path, { method: 'POST', body, ...opts });
const patch = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body });
const qs = (params: Record<string, string | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries as [string, string][]).toString()}` : '';
};

export const api = {
  health: () => get<{ status: string }>('/health'),

  auth: {
    login: (email: string, password: string) =>
      post<{ accessToken: string; user: User }>('/auth/login', { email, password }),
    refresh: () => post<{ accessToken: string; user: User }>('/auth/refresh', {}),
    me: () => get<{ user: User }>('/auth/me'),
    logout: () => post<{ loggedOut: boolean }>('/auth/logout', {}),
    logoutAll: () => post<{ loggedOut: boolean }>('/auth/logout-all', {}),
  },

  users: {
    list: () => get<{ users: User[] }>('/users'),
    create: (body: unknown) => post<{ user: User }>('/users', body),
    update: (id: string, body: unknown) => patch<{ user: User }>(`/users/${id}`, body),
    resetPassword: (id: string, password: string) =>
      post<{ reset: boolean }>(`/users/${id}/reset-password`, { password }),
  },

  setup: {
    getSettings: () => get<{ settings: Settings }>('/setup/settings'),
    updateSettings: (body: unknown) => patch<{ settings: Settings }>('/setup/settings', body),
    listCylinderTypes: () => get<{ cylinderTypes: CylinderType[] }>('/setup/cylinder-types'),
    createCylinderType: (body: unknown) =>
      post<{ cylinderType: CylinderType }>('/setup/cylinder-types', body),
    updateCylinderType: (id: string, body: unknown) =>
      patch<{ cylinderType: CylinderType }>(`/setup/cylinder-types/${id}`, body),
    listPaymentAccounts: () => get<{ paymentAccounts: PaymentAccount[] }>('/setup/payment-accounts'),
    createPaymentAccount: (body: unknown) =>
      post<{ paymentAccount: PaymentAccount }>('/setup/payment-accounts', body),
    postOpeningBalances: (body: unknown) =>
      post<{ locked: boolean; totalDebitMinor: number }>('/setup/opening-balances', body),
  },

  inventory: {
    gas: () => get<{ gas: GasInventoryView }>('/inventory/gas'),
    cylinders: () => get<{ cylinders: CylinderInventoryRow[] }>('/inventory/cylinders'),
  },

  vendors: {
    list: () => get<{ vendors: Vendor[] }>('/vendors'),
    create: (body: unknown) => post<{ vendor: Vendor }>('/vendors', body),
    get: (id: string) => get<{ vendor: Vendor }>(`/vendors/${id}`),
    ledger: (id: string) => get<{ entries: LedgerEntry[] }>(`/vendors/${id}/ledger`),
    aging: (id: string) =>
      get<{ aging: Record<string, number> }>(`/vendors/${id}/aging`),
    pay: (id: string, body: unknown, idempotencyKey?: string) =>
      post(`/vendors/${id}/payments`, body, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined),
  },

  purchases: {
    list: () => get<{ purchases: Purchase[] }>('/purchases'),
    create: (body: unknown, idempotencyKey?: string) =>
      post<{ purchase: Purchase }>('/purchases', body, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined),
  },

  customers: {
    list: () => get<{ customers: Customer[] }>('/customers'),
    create: (body: unknown) => post<{ customer: Customer }>('/customers', body),
    get: (id: string) => get<{ customer: Customer }>(`/customers/${id}`),
    ledger: (id: string) => get<{ entries: LedgerEntry[] }>(`/customers/${id}/ledger`),
    cylinders: (id: string) => get<{ holdings: Holding[] }>(`/customers/${id}/cylinders`),
  },

  sales: {
    list: () => get<{ sales: Sale[] }>('/sales'),
    create: (body: unknown, idempotencyKey?: string) =>
      post<{ sale: Sale }>('/sales', body, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined),
    get: (id: string) => get<{ sale: Sale }>(`/sales/${id}`),
  },

  cylinders: {
    pending: () => get<{ pending: Holding[] }>('/cylinders/pending'),
    returnCylinders: (body: unknown, idempotencyKey?: string) =>
      post<{ returned: number; refundMinor: number; heldRemaining: number }>(
        '/cylinders/returns',
        body,
        idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
      ),
  },

  expenses: {
    list: () => get<{ expenses: Expense[] }>('/expenses'),
    create: (body: unknown, idempotencyKey?: string) =>
      post<{ expense: Expense }>('/expenses', body, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined),
    listCategories: () => get<{ categories: ExpenseCategory[] }>('/expenses/categories'),
    createCategory: (body: unknown) => post<{ category: ExpenseCategory }>('/expenses/categories', body),
  },

  cash: {
    movement: (body: unknown) =>
      post<{ result: { ledgerEntryId: string; balanceMinor: number } }>('/cash/movements', body),
    closeDay: (body: unknown) => post<{ closing: Record<string, unknown> }>('/cash/closings', body),
  },

  adjustments: {
    list: () => get<{ adjustments: Adjustment[] }>('/adjustments'),
    create: (body: unknown) => post<{ adjustment: Adjustment }>('/adjustments', body),
  },

  reports: {
    pnl: (from?: string, to?: string) => get<{ pnl: Pnl }>(`/reports/pnl${qs({ from, to })}`),
    sales: (from?: string, to?: string) =>
      get<{ report: Record<string, unknown> }>(`/reports/sales${qs({ from, to })}`),
    purchases: (from?: string, to?: string) =>
      get<{ report: Record<string, unknown> }>(`/reports/purchases${qs({ from, to })}`),
    expenses: (from?: string, to?: string) =>
      get<{ report: Record<string, unknown> }>(`/reports/expenses${qs({ from, to })}`),
    receivables: () => get<{ customers: Customer[] }>('/reports/receivables'),
    payables: () => get<{ vendors: Vendor[] }>('/reports/payables'),
    businessWorth: () => get<{ businessWorth: BusinessWorth }>('/reports/business-worth'),
  },

  dashboard: () => get<{ dashboard: Dashboard }>('/dashboard'),
};

import { LedgerEntry } from '../models/ledgerEntry.model';
import { Sale } from '../models/sale.model';
import { Purchase } from '../models/purchase.model';
import { Expense } from '../models/expense.model';
import { Customer } from '../models/customer.model';
import { Vendor } from '../models/vendor.model';
import { PaymentAccount } from '../models/paymentAccount.model';
import { CylinderInventory } from '../models/cylinderInventory.model';
import { Money } from '../utils/money';
import { Quantity } from '../utils/quantity';
import { toBusinessDate, toBusinessMonth } from '../utils/businessDay';
import { getSettings } from './companySettings.service';
import * as costing from './costing.service';

interface CodeRow {
  _id: string;
  debit: number;
  credit: number;
}

async function ledgerByCode(from: string, to: string): Promise<CodeRow[]> {
  return LedgerEntry.aggregate<CodeRow>([
    { $match: { businessDate: { $gte: from, $lte: to } } },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debitMinor' },
        credit: { $sum: '$lines.creditMinor' },
      },
    },
  ]);
}

export interface ProfitAndLoss {
  from: string;
  to: string;
  revenueMinor: number;
  cogsMinor: number;
  grossProfitMinor: number;
  operatingExpensesMinor: number;
  netProfitMinor: number;
}

/**
 * Period P&L derived from the ledger by account-code class:
 * 4xxx = income (net credit), 5xxx = COGS (net debit), 6xxx = operating expense (net debit).
 */
export async function profitAndLoss(from: string, to: string): Promise<ProfitAndLoss> {
  const rows = await ledgerByCode(from, to);
  let revenue = 0;
  let cogs = 0;
  let opex = 0;
  for (const r of rows) {
    if (r._id.startsWith('4')) revenue += r.credit - r.debit;
    else if (r._id.startsWith('5')) cogs += r.debit - r.credit;
    else if (r._id.startsWith('6')) opex += r.debit - r.credit;
  }
  const grossProfitMinor = revenue - cogs;
  return {
    from,
    to,
    revenueMinor: revenue,
    cogsMinor: cogs,
    grossProfitMinor,
    operatingExpensesMinor: opex,
    netProfitMinor: grossProfitMinor - opex,
  };
}

async function sumField(
  model: typeof Sale | typeof Expense,
  field: string,
  from: string,
  to: string,
): Promise<number> {
  const res = await model.aggregate<{ total: number }>([
    { $match: { businessDate: { $gte: from, $lte: to }, status: { $ne: 'reversed' } } },
    { $group: { _id: null, total: { $sum: `$${field}` } } },
  ]);
  return res[0]?.total ?? 0;
}

export async function salesReport(from: string, to: string) {
  const items = await Sale.find({ businessDate: { $gte: from, $lte: to } }).sort({ invoiceNo: 1 });
  const totalSalesMinor = await sumField(Sale, 'invoiceAmountMinor', from, to);
  const totalCogsMinor = await sumField(Sale, 'cogsMinor', from, to);
  return { from, to, count: items.length, totalSalesMinor, totalCogsMinor, items };
}

export async function purchaseReport(from: string, to: string) {
  const items = await Purchase.find({ businessDate: { $gte: from, $lte: to } }).sort({ purchaseNo: 1 });
  const res = await Purchase.aggregate<{ total: number }>([
    { $match: { businessDate: { $gte: from, $lte: to } } },
    { $group: { _id: null, total: { $sum: '$landedCostMinor' } } },
  ]);
  return { from, to, count: items.length, totalPurchasesMinor: res[0]?.total ?? 0, items };
}

export async function expenseReport(from: string, to: string) {
  const items = await Expense.find({ businessDate: { $gte: from, $lte: to } }).sort({ date: 1 });
  const totalMinor = await sumField(Expense, 'amountMinor', from, to);
  return { from, to, count: items.length, totalExpensesMinor: totalMinor, items };
}

export function receivables() {
  return Customer.find({ currentReceivableMinor: { $gt: 0 } }).sort({ currentReceivableMinor: -1 });
}

export function payables() {
  return Vendor.find({ currentPayableMinor: { $gt: 0 } }).sort({ currentPayableMinor: -1 });
}

export async function dashboard() {
  const settings = await getSettings();
  const now = new Date();
  const today = toBusinessDate(now, settings.businessTimezone);
  const month = toBusinessMonth(now, settings.businessTimezone);
  const monthStart = `${month}-01`;

  const gas = await costing.getGasInventory();
  const [cyl] = await CylinderInventory.aggregate([
    {
      $group: {
        _id: null,
        filled: { $sum: '$filled' },
        empty: { $sum: '$empty' },
        customerHeld: { $sum: '$customerHeld' },
        lost: { $sum: '$lost' },
        damaged: { $sum: '$damaged' },
      },
    },
  ]);
  const [cash] = await PaymentAccount.aggregate([
    { $group: { _id: null, total: { $sum: '$currentBalanceMinor' } } },
  ]);
  const [ar] = await Customer.aggregate([
    { $group: { _id: null, total: { $sum: '$currentReceivableMinor' } } },
  ]);
  const [ap] = await Vendor.aggregate([
    { $group: { _id: null, total: { $sum: '$currentPayableMinor' } } },
  ]);

  const fmt = (m: number) => Money.fromMinor(BigInt(m)).toMajorString();

  const pnlMonth = await profitAndLoss(monthStart, today);

  return {
    gas: {
      availableKg: Quantity.fromSub(BigInt(gas.availableKgSub)).toKgString(),
      weightedAvgCost: fmt(gas.wacMinor),
      inventoryValue: fmt(gas.inventoryValueMinor),
    },
    cylinders: {
      filled: cyl?.filled ?? 0,
      empty: cyl?.empty ?? 0,
      customerHeld: cyl?.customerHeld ?? 0,
      lost: cyl?.lost ?? 0,
      damaged: cyl?.damaged ?? 0,
    },
    cashInHand: fmt(cash?.total ?? 0),
    receivables: fmt(ar?.total ?? 0),
    payables: fmt(ap?.total ?? 0),
    todaySales: fmt(await sumField(Sale, 'invoiceAmountMinor', today, today)),
    monthSales: fmt(await sumField(Sale, 'invoiceAmountMinor', monthStart, today)),
    todayExpenses: fmt(await sumField(Expense, 'amountMinor', today, today)),
    monthExpenses: fmt(await sumField(Expense, 'amountMinor', monthStart, today)),
    grossProfitMTD: fmt(pnlMonth.grossProfitMinor),
    netProfitMTD: fmt(pnlMonth.netProfitMinor),
  };
}

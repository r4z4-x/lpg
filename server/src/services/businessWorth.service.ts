import { Account } from '../models/account.model';
import { LedgerEntry } from '../models/ledgerEntry.model';

interface CodeRow {
  _id: string;
  debit: number;
  credit: number;
}

/**
 * Business worth = Assets − Liabilities, derived entirely from the ledger and reconciled
 * against equity + retained earnings (income − expense). `balanced` is the accounting
 * identity check (Assets − Liabilities === Equity + Retained Earnings).
 */
export async function businessWorth() {
  const accounts = await Account.find();
  const typeByCode = new Map(accounts.map((a) => [a.code, a.type]));

  const rows = await LedgerEntry.aggregate<CodeRow>([
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debitMinor' },
        credit: { $sum: '$lines.creditMinor' },
      },
    },
  ]);

  let assets = 0;
  let liabilities = 0;
  let equity = 0;
  let income = 0;
  let expense = 0;
  const netDebit: Record<string, number> = {};

  for (const r of rows) {
    netDebit[r._id] = r.debit - r.credit;
    switch (typeByCode.get(r._id)) {
      case 'Asset':
        assets += r.debit - r.credit;
        break;
      case 'Liability':
        liabilities += r.credit - r.debit;
        break;
      case 'Equity':
        equity += r.credit - r.debit;
        break;
      case 'Income':
        income += r.credit - r.debit;
        break;
      case 'Expense':
        expense += r.debit - r.credit;
        break;
    }
  }

  const retainedEarnings = income - expense;
  const businessWorthMinor = assets - liabilities;
  const equityMinor = equity + retainedEarnings;

  return {
    assetsMinor: assets,
    liabilitiesMinor: liabilities,
    businessWorthMinor,
    equityMinor,
    retainedEarningsMinor: retainedEarnings,
    balanced: businessWorthMinor === equityMinor,
    breakdown: {
      assets: {
        cash: (netDebit['1010'] ?? 0) + (netDebit['1020'] ?? 0),
        receivables: netDebit['1100'] ?? 0,
        gasInventory: netDebit['1200'] ?? 0,
        cylinderAssets: netDebit['1300'] ?? 0,
      },
      liabilities: {
        payables: -(netDebit['2010'] ?? 0),
        cylinderDeposits: -(netDebit['2100'] ?? 0),
        accruedExpenses: -(netDebit['2400'] ?? 0),
      },
    },
  };
}

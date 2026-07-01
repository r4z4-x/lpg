import { Types } from 'mongoose';
import { Expense } from '../models/expense.model';
import { ExpenseCategory } from '../models/expenseCategory.model';
import { PaymentAccount, ledgerCodeForAccountType } from '../models/paymentAccount.model';
import { Money } from '../utils/money';
import { withTransaction } from '../utils/transaction';
import { toBusinessDate } from '../utils/businessDay';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { getSettings } from './companySettings.service';
import * as ledger from './ledger.service';
import * as audit from './audit.service';
import { logger } from '../config/logger';

const DEFAULT_CATEGORIES: { name: string; accountCode: string }[] = [
  { name: 'Salary', accountCode: '6010' },
  { name: 'Labour', accountCode: '6020' },
  { name: 'Fuel', accountCode: '6030' },
  { name: 'Maintenance', accountCode: '6040' },
  { name: 'Office', accountCode: '6050' },
  { name: 'Utilities', accountCode: '6060' },
  { name: 'Misc', accountCode: '6070' },
];

export async function seedExpenseCategories(): Promise<void> {
  for (const c of DEFAULT_CATEGORIES) {
    await ExpenseCategory.updateOne(
      { name: c.name },
      { $setOnInsert: { name: c.name, accountCode: c.accountCode, isSystem: true, isActive: true } },
      { upsert: true },
    );
  }
  logger.info('Expense categories seeded', { count: DEFAULT_CATEGORIES.length });
}

export function listCategories() {
  return ExpenseCategory.find().sort({ name: 1 });
}

export async function createCategory(name: string, accountCode = '6070') {
  const exists = await ExpenseCategory.findOne({ name: name.trim() });
  if (exists) throw new ConflictError('Category already exists', 'NAME_TAKEN');
  return ExpenseCategory.create({ name: name.trim(), accountCode, isSystem: false });
}

async function resolveAccountCode(category: string): Promise<string> {
  const cat = await ExpenseCategory.findOne({ name: category });
  return cat?.accountCode ?? '6070';
}

export interface CreateExpenseInput {
  category: string;
  amount: string;
  paymentAccountId?: string; // omit → accrued (unpaid)
  date?: string;
  note?: string;
}

export async function createExpense(input: CreateExpenseInput, userId: string) {
  return withTransaction(async (session) => {
    const amount = Money.fromMajor(input.amount);
    if (!amount.isPositive()) throw new ValidationError('Amount must be positive');

    const expenseCode = await resolveAccountCode(input.category);
    const settings = await getSettings(session);
    const date = input.date ? new Date(input.date) : new Date();
    const businessDate = toBusinessDate(date, settings.businessTimezone);

    const paid = Boolean(input.paymentAccountId);
    let paymentAccountId: Types.ObjectId | null = null;
    let creditCode = '2400'; // Accrued Expenses by default

    if (paid) {
      const account = await PaymentAccount.findById(input.paymentAccountId).session(session);
      if (!account) throw new NotFoundError('Payment account not found');
      account.currentBalanceMinor -= amount.toMinorNumber();
      await account.save({ session });
      paymentAccountId = account._id;
      creditCode = ledgerCodeForAccountType(account.type);
    }

    const entry = await ledger.post(
      {
        date,
        businessDate,
        sourceType: 'Expense',
        memo: `Expense: ${input.category}`,
        createdBy: userId,
        lines: [
          { accountCode: expenseCode, debitMinor: amount.toMinorNumber() },
          { accountCode: creditCode, creditMinor: amount.toMinorNumber() },
        ],
      },
      session,
    );

    const [expense] = await Expense.create(
      [
        {
          category: input.category,
          amountMinor: amount.toMinorNumber(),
          date,
          businessDate,
          paid,
          paymentAccountId,
          ledgerEntryId: entry._id,
          note: input.note ?? null,
          createdBy: userId,
        },
      ],
      { session },
    );

    await audit.record(
      { userId, action: 'create', entity: 'Expense', entityId: expense!._id, newValue: input },
      session,
    );
    return expense!;
  });
}

export function listExpenses() {
  return Expense.find().sort({ date: -1 });
}

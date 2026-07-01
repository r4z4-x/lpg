import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { createApp } from '../app';
import { createUser } from '../services/user.service';
import { seedAccounts } from '../services/account.service';
import { seedPaymentAccounts } from '../services/paymentAccount.service';
import { seedExpenseCategories } from '../services/expense.service';
import { getSettings } from '../services/companySettings.service';
import { trialBalance } from '../services/ledger.service';
import { ROLES } from '../constants/roles';

useTestDb();

const app = createApp();
const OWNER = { name: 'Owner', email: 'owner@test.com', password: 'password123', role: ROLES.OWNER };

let auth: { Authorization: string };
let cashId: string;

beforeEach(async () => {
  await seedAccounts();
  await getSettings();
  await seedPaymentAccounts();
  await seedExpenseCategories();
  await createUser(OWNER);
  const login = await request(app)
    .post('/auth/login')
    .send({ email: OWNER.email, password: OWNER.password });
  auth = { Authorization: `Bearer ${login.body.data.accessToken}` };
  const accounts = await request(app).get('/setup/payment-accounts').set(auth);
  cashId = accounts.body.data.paymentAccounts.find((a: { type: string }) => a.type === 'Cash')._id;
});

describe('expenses & cash', () => {
  it('records a paid expense (Dr expense / Cr cash)', async () => {
    const res = await request(app)
      .post('/expenses')
      .set(auth)
      .send({ category: 'Fuel', amount: '5000', paymentAccountId: cashId });
    expect(res.status).toBe(201);

    const tb = await trialBalance();
    expect(tb.rows.find((r) => r.accountCode === '6030')!.debitMinor).toBe(500_000);
    expect(tb.rows.find((r) => r.accountCode === '1010')!.creditMinor).toBe(500_000);
    expect(tb.balanced).toBe(true);
  });

  it('records an accrued (unpaid) expense against Accrued Expenses', async () => {
    await request(app).post('/expenses').set(auth).send({ category: 'Salary', amount: '30000' });
    const tb = await trialBalance();
    expect(tb.rows.find((r) => r.accountCode === '6010')!.debitMinor).toBe(3_000_000);
    expect(tb.rows.find((r) => r.accountCode === '2400')!.creditMinor).toBe(3_000_000);
    expect(tb.balanced).toBe(true);
  });

  it('records a cash-in movement (owner capital)', async () => {
    const res = await request(app)
      .post('/cash/movements')
      .set(auth)
      .send({ paymentAccountId: cashId, direction: 'in', amount: '20000' });
    expect(res.status).toBe(201);
    expect(res.body.data.result.balanceMinor).toBe(2_000_000);
    expect((await trialBalance()).balanced).toBe(true);
  });

  it('daily closing posts a shortage variance and reconciles the account', async () => {
    // Put 10,000 into the cash account.
    await request(app)
      .post('/cash/movements')
      .set(auth)
      .send({ paymentAccountId: cashId, direction: 'in', amount: '10000' });

    // Count only 9,000 → 1,000 short.
    const close = await request(app)
      .post('/cash/closings')
      .set(auth)
      .send({ paymentAccountId: cashId, businessDate: '2026-06-14', actualCash: '9000' });
    expect(close.status).toBe(201);
    expect(close.body.data.closing.varianceMinor).toBe(-100_000); // -1,000.00

    const tb = await trialBalance();
    expect(tb.rows.find((r) => r.accountCode === '6080')!.debitMinor).toBe(100_000); // Cash Short
    expect(tb.balanced).toBe(true);

    // Closing the same day/account again is rejected.
    const again = await request(app)
      .post('/cash/closings')
      .set(auth)
      .send({ paymentAccountId: cashId, businessDate: '2026-06-14', actualCash: '9000' });
    expect(again.status).toBe(409);
  });
});

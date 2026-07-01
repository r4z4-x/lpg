import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { createApp } from '../app';
import { createUser } from '../services/user.service';
import { seedAccounts } from '../services/account.service';
import { seedPaymentAccounts } from '../services/paymentAccount.service';
import { seedCylinderTypes } from '../services/cylinderType.service';
import { seedExpenseCategories } from '../services/expense.service';
import { getSettings } from '../services/companySettings.service';
import * as inventory from '../services/inventory.service';
import { withTransaction } from '../utils/transaction';
import { ROLES } from '../constants/roles';

useTestDb();

const app = createApp();
const OWNER = { name: 'Owner', email: 'owner@test.com', password: 'password123', role: ROLES.OWNER };

let auth: { Authorization: string };
let cashId: string;
let typeId: string;

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.data.accessToken;
}

beforeEach(async () => {
  await seedAccounts();
  await getSettings();
  await seedPaymentAccounts();
  await seedCylinderTypes();
  await seedExpenseCategories();
  await createUser(OWNER);
  auth = { Authorization: `Bearer ${await login(OWNER.email, OWNER.password)}` };

  const accounts = await request(app).get('/setup/payment-accounts').set(auth);
  cashId = accounts.body.data.paymentAccounts.find((a: { type: string }) => a.type === 'Cash')._id;
  const types = await request(app).get('/setup/cylinder-types').set(auth);
  typeId = types.body.data.cylinderTypes[0]._id;

  // Buy gas (WAC 240), seed filled stock, sell, and record an expense.
  const vendor = await request(app).post('/vendors').set(auth).send({ name: 'Gas Co' });
  await request(app).post('/purchases').set(auth).send({
    vendorId: vendor.body.data.vendor._id,
    qtyKg: '1000',
    ratePerKg: '240',
    paymentType: 'full',
    paymentAccountId: cashId,
  });
  await withTransaction((s) => inventory.setOpening(typeId, { filled: 100, empty: 0 }, s));

  const customer = await request(app).post('/customers').set(auth).send({ name: 'Cust' });
  await request(app).post('/sales').set(auth).send({
    customerId: customer.body.data.customer._id,
    customerType: 'exchange',
    qtyKg: '50',
    saleRate: '300',
    cylinderTypeId: typeId,
    paymentType: 'full',
    paymentAccountId: cashId,
  });
  await request(app)
    .post('/expenses')
    .set(auth)
    .send({ category: 'Fuel', amount: '5000', paymentAccountId: cashId });
});

describe('reports & dashboard', () => {
  it('computes P&L from the ledger', async () => {
    const res = await request(app).get('/reports/pnl?from=0000-01-01&to=9999-12-31').set(auth);
    expect(res.status).toBe(200);
    const pnl = res.body.data.pnl;
    expect(pnl.revenueMinor).toBe(1_500_000); // 15,000 gas sales
    expect(pnl.cogsMinor).toBe(1_200_000); // 50 × 240
    expect(pnl.grossProfitMinor).toBe(300_000); // 3,000
    expect(pnl.operatingExpensesMinor).toBe(500_000); // 5,000 fuel
    expect(pnl.netProfitMinor).toBe(-200_000); // 3,000 - 5,000
  });

  it('summarises KPIs on the dashboard', async () => {
    const res = await request(app).get('/dashboard').set(auth);
    expect(res.status).toBe(200);
    const d = res.body.data.dashboard;
    expect(d.gas.availableKg).toBe('950.000');
    expect(d.gas.inventoryValue).toBe('228000.00'); // 240,000 - 12,000 COGS
    expect(d.receivables).toBe('0.00');
    expect(d.grossProfitMTD).toBe('3000.00');
    expect(d.netProfitMTD).toBe('-2000.00');
  });

  it('blocks Operators from reports and dashboard', async () => {
    await request(app)
      .post('/users')
      .set(auth)
      .send({ name: 'Op', email: 'op@test.com', password: 'operator123', role: ROLES.OPERATOR });
    const opAuth = { Authorization: `Bearer ${await login('op@test.com', 'operator123')}` };

    expect((await request(app).get('/reports/pnl').set(opAuth)).status).toBe(403);
    expect((await request(app).get('/dashboard').set(opAuth)).status).toBe(403);
  });
});

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { createApp } from '../app';
import { createUser } from '../services/user.service';
import { seedAccounts } from '../services/account.service';
import { seedPaymentAccounts } from '../services/paymentAccount.service';
import { seedCylinderTypes } from '../services/cylinderType.service';
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

beforeEach(async () => {
  await seedAccounts();
  await getSettings();
  await seedPaymentAccounts();
  await seedCylinderTypes();
  await createUser(OWNER);
  const login = await request(app)
    .post('/auth/login')
    .send({ email: OWNER.email, password: OWNER.password });
  auth = { Authorization: `Bearer ${login.body.data.accessToken}` };
  const accounts = await request(app).get('/setup/payment-accounts').set(auth);
  cashId = accounts.body.data.paymentAccounts.find((a: { type: string }) => a.type === 'Cash')._id;
  const types = await request(app).get('/setup/cylinder-types').set(auth);
  typeId = types.body.data.cylinderTypes[0]._id;
});

describe('M10 business worth', () => {
  it('computes worth = assets − liabilities, reconciled to equity', async () => {
    // Owner injects 50,000 cash.
    await request(app)
      .post('/cash/movements')
      .set(auth)
      .send({ paymentAccountId: cashId, direction: 'in', amount: '50000' });
    // Buy 100 kg @ 100 (cash) → gas value 10,000.
    const vendor = await request(app).post('/vendors').set(auth).send({ name: 'Gas Co' });
    await request(app).post('/purchases').set(auth).send({
      vendorId: vendor.body.data.vendor._id,
      qtyKg: '100',
      ratePerKg: '100',
      paymentType: 'full',
      paymentAccountId: cashId,
    });
    await withTransaction((s) => inventory.setOpening(typeId, { filled: 100, empty: 0 }, s));
    // Sell 50 kg @ 200 (cash) → revenue 10,000, COGS 5,000.
    const customer = await request(app).post('/customers').set(auth).send({ name: 'Cust' });
    await request(app).post('/sales').set(auth).send({
      customerId: customer.body.data.customer._id,
      customerType: 'exchange',
      qtyKg: '50',
      saleRate: '200',
      cylinderTypeId: typeId,
      paymentType: 'full',
      paymentAccountId: cashId,
    });

    const res = await request(app).get('/reports/business-worth').set(auth);
    expect(res.status).toBe(200);
    const w = res.body.data.businessWorth;
    // cash 50,000 - 10,000 + 10,000 = 50,000 ; gas 10,000 - 5,000 = 5,000 → assets 55,000
    expect(w.breakdown.assets.cash).toBe(5_000_000);
    expect(w.breakdown.assets.gasInventory).toBe(500_000);
    expect(w.assetsMinor).toBe(5_500_000);
    expect(w.liabilitiesMinor).toBe(0);
    expect(w.businessWorthMinor).toBe(5_500_000);
    // Reconciles to equity (owner capital 50,000 + retained earnings 5,000).
    expect(w.equityMinor).toBe(5_500_000);
    expect(w.balanced).toBe(true);
  });
});

describe('M10 idempotency hardening', () => {
  it('creates a sale only once when retried with the same Idempotency-Key', async () => {
    const vendor = await request(app).post('/vendors').set(auth).send({ name: 'Gas Co' });
    await request(app).post('/purchases').set(auth).send({
      vendorId: vendor.body.data.vendor._id,
      qtyKg: '100',
      ratePerKg: '100',
      paymentType: 'full',
      paymentAccountId: cashId,
    });
    await withTransaction((s) => inventory.setOpening(typeId, { filled: 100, empty: 0 }, s));
    const customer = await request(app).post('/customers').set(auth).send({ name: 'Cust' });

    const payload = {
      customerId: customer.body.data.customer._id,
      customerType: 'exchange',
      qtyKg: '10',
      saleRate: '200',
      cylinderTypeId: typeId,
      paymentType: 'credit',
    };
    const headers = { ...auth, 'Idempotency-Key': 'sale-key-1' };

    const first = await request(app).post('/sales').set(headers).send(payload);
    const retry = await request(app).post('/sales').set(headers).send(payload);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body.data.sale.invoiceNo).toBe(first.body.data.sale.invoiceNo);

    const sales = await request(app).get('/sales').set(auth);
    expect(sales.body.data.sales).toHaveLength(1); // exactly one effect
  });
});

import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { createApp } from '../app';
import { createUser } from '../services/user.service';
import { seedAccounts } from '../services/account.service';
import { seedPaymentAccounts } from '../services/paymentAccount.service';
import { seedCylinderTypes } from '../services/cylinderType.service';
import { getSettings } from '../services/companySettings.service';
import { trialBalance } from '../services/ledger.service';
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
  await createUser(OWNER);

  const token = await login(OWNER.email, OWNER.password);
  auth = { Authorization: `Bearer ${token}` };

  const accounts = await request(app).get('/setup/payment-accounts').set(auth);
  cashId = accounts.body.data.paymentAccounts.find((a: { type: string }) => a.type === 'Cash')._id;
  const types = await request(app).get('/setup/cylinder-types').set(auth);
  typeId = types.body.data.cylinderTypes[0]._id;

  // Load gas at WAC 240 via a purchase.
  const vendor = await request(app).post('/vendors').set(auth).send({ name: 'Gas Co' });
  await request(app).post('/purchases').set(auth).send({
    vendorId: vendor.body.data.vendor._id,
    qtyKg: '1000',
    ratePerKg: '240',
    paymentType: 'full',
    paymentAccountId: cashId,
  });
  // Establish filled-cylinder stock (opening operational stock).
  await withTransaction((s) => inventory.setOpening(typeId, { filled: 100, empty: 50 }, s));
});

async function makeCustomer(body: object = { name: 'Walk-in' }): Promise<string> {
  const res = await request(app).post('/customers').set(auth).send(body);
  return res.body.data.customer._id;
}

describe('sales', () => {
  it('exchange full sale: invoice math, COGS snapshot, cylinder swap', async () => {
    const customerId = await makeCustomer();
    const res = await request(app)
      .post('/sales')
      .set(auth)
      .send({
        customerId,
        customerType: 'exchange',
        qtyKg: '50',
        saleRate: '300',
        cylinderTypeId: typeId,
        charges: [{ name: 'Delivery', amount: '200' }],
        discount: '100',
        paymentType: 'full',
        paymentAccountId: cashId,
      });
    expect(res.status).toBe(201);
    // 50*300 + 200 - 100 = 15,100.00
    expect(res.body.data.sale.invoiceAmountMinor).toBe(1_510_000);
    // 50 × WAC 240 = 12,000.00
    expect(res.body.data.sale.cogsMinor).toBe(1_200_000);
    expect(res.body.data.sale.unitCostAtSaleMinor).toBe(24_000);

    const customer = await request(app).get(`/customers/${customerId}`).set(auth);
    expect(customer.body.data.customer.currentReceivableMinor).toBe(0);

    const cyls = await request(app).get('/inventory/cylinders').set(auth);
    const row = cyls.body.data.cylinders[0];
    expect(row.filled).toBe(99); // -1
    expect(row.empty).toBe(51); // +1
    expect((await trialBalance()).balanced).toBe(true);
  });

  it('previous-balance recovery reduces AR without inflating revenue', async () => {
    const customerId = await makeCustomer({ name: 'Owes Money', openingReceivable: '10000' });
    // Sale gas 25×200 = 5,000; customer pays the 5,000 invoice + 10,000 old balance.
    const res = await request(app)
      .post('/sales')
      .set(auth)
      .send({
        customerId,
        customerType: 'exchange',
        qtyKg: '25',
        saleRate: '200',
        cylinderTypeId: typeId,
        paymentType: 'full',
        previousBalanceRecovery: '10000',
        paymentAccountId: cashId,
      });
    expect(res.status).toBe(201);

    // Receivable cleared (10,000 opening - 10,000 recovered).
    const customer = await request(app).get(`/customers/${customerId}`).set(auth);
    expect(customer.body.data.customer.currentReceivableMinor).toBe(0);

    // Revenue recognised is ONLY the gas sale (5,000.00), not 15,000.
    const tb = await trialBalance();
    const salesGas = tb.rows.find((r) => r.accountCode === '4010')!;
    expect(salesGas.creditMinor).toBe(500_000);
    expect(tb.balanced).toBe(true);
  });

  it('credit sale increases receivable; respects the credit limit', async () => {
    const customerId = await makeCustomer({ name: 'Credit Cust', creditLimit: '20000' });
    const credit = await request(app)
      .post('/sales')
      .set(auth)
      .send({
        customerId,
        customerType: 'exchange',
        qtyKg: '50',
        saleRate: '300',
        cylinderTypeId: typeId,
        paymentType: 'credit',
      });
    expect(credit.status).toBe(201);
    const customer = await request(app).get(`/customers/${customerId}`).set(auth);
    expect(customer.body.data.customer.currentReceivableMinor).toBe(1_500_000); // 15,000

    // Next credit sale would push receivable over the 20,000 limit.
    const overLimit = await request(app)
      .post('/sales')
      .set(auth)
      .send({
        customerId,
        customerType: 'exchange',
        qtyKg: '50',
        saleRate: '300',
        cylinderTypeId: typeId,
        paymentType: 'credit',
      });
    expect(overLimit.status).toBe(400);
  });

  it('blocks a sale exceeding gas stock', async () => {
    const customerId = await makeCustomer();
    const res = await request(app)
      .post('/sales')
      .set(auth)
      .send({
        customerId,
        customerType: 'exchange',
        qtyKg: '2000',
        saleRate: '300',
        cylinderTypeId: typeId,
        paymentType: 'credit',
      });
    expect(res.status).toBe(400);
  });

  it('no-cylinder sale creates a holding and increments held count', async () => {
    const customerId = await makeCustomer({ name: 'New Cust' });
    const res = await request(app)
      .post('/sales')
      .set(auth)
      .send({
        customerId,
        customerType: 'no_cylinder',
        qtyKg: '11.8',
        saleRate: '300',
        cylinderTypeId: typeId,
        paymentType: 'full',
        paymentAccountId: cashId,
      });
    expect(res.status).toBe(201);
    const customer = await request(app).get(`/customers/${customerId}`).set(auth);
    expect(customer.body.data.customer.heldCylinders).toBe(1);

    const cyls = await request(app).get('/inventory/cylinders').set(auth);
    const row = cyls.body.data.cylinders[0];
    expect(row.filled).toBe(99);
    expect(row.customerHeld).toBe(1);
  });

  it('hides profit fields from Operators', async () => {
    await request(app)
      .post('/users')
      .set(auth)
      .send({ name: 'Op', email: 'op@test.com', password: 'operator123', role: ROLES.OPERATOR });
    const opToken = await login('op@test.com', 'operator123');
    const opAuth = { Authorization: `Bearer ${opToken}` };

    const customerId = await makeCustomer({ name: 'Cust' });
    const res = await request(app)
      .post('/sales')
      .set(opAuth)
      .send({
        customerId,
        customerType: 'exchange',
        qtyKg: '10',
        saleRate: '300',
        cylinderTypeId: typeId,
        paymentType: 'credit',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.sale.cogsMinor).toBeUndefined();
    expect(res.body.data.sale.unitCostAtSaleMinor).toBeUndefined();
    expect(res.body.data.sale.invoiceAmountMinor).toBeDefined();
  });
});

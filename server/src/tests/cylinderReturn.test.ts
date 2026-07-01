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
let customerId: string;

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

  // Deposit of 2,000 per cylinder of this type.
  await request(app)
    .patch(`/setup/cylinder-types/${typeId}`)
    .set(auth)
    .send({ depositAmount: '2000' });

  // Gas + filled stock.
  const vendor = await request(app).post('/vendors').set(auth).send({ name: 'Gas Co' });
  await request(app).post('/purchases').set(auth).send({
    vendorId: vendor.body.data.vendor._id,
    qtyKg: '1000',
    ratePerKg: '240',
    paymentType: 'full',
    paymentAccountId: cashId,
  });
  await withTransaction((s) => inventory.setOpening(typeId, { filled: 100, empty: 50 }, s));

  const customer = await request(app).post('/customers').set(auth).send({ name: 'Holder' });
  customerId = customer.body.data.customer._id;

  // No-cylinder sale issuing 2 company cylinders with deposit.
  await request(app).post('/sales').set(auth).send({
    customerId,
    customerType: 'no_cylinder',
    qtyKg: '23.6',
    saleRate: '300',
    cylinderTypeId: typeId,
    cylinderCount: 2,
    paymentType: 'full',
    collectDeposit: true,
    paymentAccountId: cashId,
  });
});

describe('cylinder returns & deposits', () => {
  it('issues with a deposit liability and held count', async () => {
    const customer = await request(app).get(`/customers/${customerId}`).set(auth);
    expect(customer.body.data.customer.heldCylinders).toBe(2);

    const tb = await trialBalance();
    const deposit = tb.rows.find((r) => r.accountCode === '2100')!;
    expect(deposit.creditMinor).toBe(400_000); // 2 × 2,000.00
    expect(tb.balanced).toBe(true);
  });

  it('refunds the deposit on a good return and moves shells to empty', async () => {
    const ret = await request(app)
      .post('/cylinders/returns')
      .set(auth)
      .send({ customerId, cylinderTypeId: typeId, qty: 1, condition: 'good', refundDeposit: true, paymentAccountId: cashId });
    expect(ret.status).toBe(201);
    expect(ret.body.data.refundMinor).toBe(200_000); // 2,000.00
    expect(ret.body.data.heldRemaining).toBe(1);

    const cyls = await request(app).get('/inventory/cylinders').set(auth);
    const row = cyls.body.data.cylinders[0];
    expect(row.customerHeld).toBe(1);
    expect(row.empty).toBe(51); // 50 + 1
    expect((await trialBalance()).balanced).toBe(true);
  });

  it('forfeits the deposit to income on a lost return', async () => {
    const ret = await request(app)
      .post('/cylinders/returns')
      .set(auth)
      .send({ customerId, cylinderTypeId: typeId, qty: 1, condition: 'lost' });
    expect(ret.status).toBe(201);
    expect(ret.body.data.refundMinor).toBe(0);

    const tb = await trialBalance();
    const damageRecovery = tb.rows.find((r) => r.accountCode === '4030')!;
    expect(damageRecovery.creditMinor).toBe(200_000); // forfeited deposit recognised as income
    const cyls = await request(app).get('/inventory/cylinders').set(auth);
    expect(cyls.body.data.cylinders[0].lost).toBe(1);
    expect(tb.balanced).toBe(true);
  });

  it('rejects returning more than held', async () => {
    const ret = await request(app)
      .post('/cylinders/returns')
      .set(auth)
      .send({ customerId, cylinderTypeId: typeId, qty: 5, condition: 'good' });
    expect(ret.status).toBe(400);
  });

  it('clears pending once all cylinders are returned', async () => {
    await request(app)
      .post('/cylinders/returns')
      .set(auth)
      .send({ customerId, cylinderTypeId: typeId, qty: 2, condition: 'good', refundDeposit: true, paymentAccountId: cashId });

    const pending = await request(app).get('/cylinders/pending').set(auth);
    expect(pending.body.data.pending).toHaveLength(0);

    const customer = await request(app).get(`/customers/${customerId}`).set(auth);
    expect(customer.body.data.customer.heldCylinders).toBe(0);
  });
});

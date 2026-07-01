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
  auth = { Authorization: `Bearer ${await login(OWNER.email, OWNER.password)}` };

  const accounts = await request(app).get('/setup/payment-accounts').set(auth);
  cashId = accounts.body.data.paymentAccounts.find((a: { type: string }) => a.type === 'Cash')._id;
  const types = await request(app).get('/setup/cylinder-types').set(auth);
  typeId = types.body.data.cylinderTypes[0]._id;

  // Stock gas at WAC 240 and seed some filled cylinders.
  const vendor = await request(app).post('/vendors').set(auth).send({ name: 'Gas Co' });
  await request(app).post('/purchases').set(auth).send({
    vendorId: vendor.body.data.vendor._id,
    qtyKg: '1000',
    ratePerKg: '240',
    paymentType: 'full',
    paymentAccountId: cashId,
  });
  await withTransaction((s) => inventory.setOpening(typeId, { filled: 10, empty: 0 }, s));
});

describe('inventory adjustments', () => {
  it('leakage reduces stock and posts an Inventory Loss', async () => {
    const res = await request(app)
      .post('/adjustments')
      .set(auth)
      .send({ type: 'leakage', reason: 'tank leak', gas: { kg: '10', direction: 'decrease' } });
    expect(res.status).toBe(201);
    expect(res.body.data.adjustment.valuationImpactMinor).toBe(-240_000); // 10 × 240 = 2,400.00

    const gas = await request(app).get('/inventory/gas').set(auth);
    expect(gas.body.data.gas.availableKg).toBe('990.000');
    expect(gas.body.data.gas.inventoryValue).toBe('237600.00');

    const tb = await trialBalance();
    expect(tb.rows.find((r) => r.accountCode === '5020')!.debitMinor).toBe(240_000);
    expect(tb.balanced).toBe(true);
  });

  it('upward correction increases stock and value', async () => {
    await request(app)
      .post('/adjustments')
      .set(auth)
      .send({ type: 'correction', reason: 'recount', gas: { kg: '5', direction: 'increase' } });
    const gas = await request(app).get('/inventory/gas').set(auth);
    expect(gas.body.data.gas.availableKg).toBe('1005.000');
    expect((await trialBalance()).balanced).toBe(true);
  });

  it('adjusts cylinder counts (e.g. write off damaged shells)', async () => {
    await request(app)
      .post('/adjustments')
      .set(auth)
      .send({
        type: 'damage',
        reason: 'damaged in transit',
        cylinder: { cylinderTypeId: typeId, deltas: { filled: -2, damaged: 2 } },
      });
    const cyls = await request(app).get('/inventory/cylinders').set(auth);
    const row = cyls.body.data.cylinders[0];
    expect(row.filled).toBe(8);
    expect(row.damaged).toBe(2);
  });

  it('forbids Operators from making adjustments', async () => {
    await request(app)
      .post('/users')
      .set(auth)
      .send({ name: 'Op', email: 'op@test.com', password: 'operator123', role: ROLES.OPERATOR });
    const opAuth = { Authorization: `Bearer ${await login('op@test.com', 'operator123')}` };
    const res = await request(app)
      .post('/adjustments')
      .set(opAuth)
      .send({ type: 'leakage', reason: 'x', gas: { kg: '1', direction: 'decrease' } });
    expect(res.status).toBe(403);
  });
});

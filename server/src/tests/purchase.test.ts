import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDb } from './dbHelper';
import { createApp } from '../app';
import { createUser } from '../services/user.service';
import { seedAccounts } from '../services/account.service';
import { seedPaymentAccounts } from '../services/paymentAccount.service';
import { getSettings } from '../services/companySettings.service';
import { trialBalance } from '../services/ledger.service';
import { ROLES } from '../constants/roles';

useTestDb();

const app = createApp();
const OWNER = { name: 'Owner', email: 'owner@test.com', password: 'password123', role: ROLES.OWNER };

let token: string;
let cashId: string;
let auth: { Authorization: string };

beforeEach(async () => {
  await seedAccounts();
  await getSettings();
  await seedPaymentAccounts();
  await createUser(OWNER);
  const login = await request(app)
    .post('/auth/login')
    .send({ email: OWNER.email, password: OWNER.password });
  token = login.body.data.accessToken;
  auth = { Authorization: `Bearer ${token}` };
  const accounts = await request(app).get('/setup/payment-accounts').set(auth);
  cashId = accounts.body.data.paymentAccounts.find((a: { type: string }) => a.type === 'Cash')._id;
});

async function makeVendor(body: object = { name: 'Acme Gas' }): Promise<string> {
  const res = await request(app).post('/vendors').set(auth).send(body);
  return res.body.data.vendor._id;
}

describe('purchases', () => {
  it('records a full-payment purchase: gas up, WAC set, ledger balanced', async () => {
    const vendorId = await makeVendor();
    const res = await request(app)
      .post('/purchases')
      .set(auth)
      .send({
        vendorId,
        qtyKg: '1000',
        ratePerKg: '250',
        transport: '5000',
        paymentType: 'full',
        paymentAccountId: cashId,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.purchase.landedCostMinor).toBe(25_500_000); // 255,000.00

    const gas = await request(app).get('/inventory/gas').set(auth);
    expect(gas.body.data.gas.availableKg).toBe('1000.000');
    expect(gas.body.data.gas.weightedAvgCost).toBe('255.00');

    const vendor = await request(app).get(`/vendors/${vendorId}`).set(auth);
    expect(vendor.body.data.vendor.currentPayableMinor).toBe(0);

    const tb = await trialBalance();
    expect(tb.balanced).toBe(true);
  });

  it('credit purchase creates a vendor payable', async () => {
    const vendorId = await makeVendor({ name: 'Credit Vendor' });
    await request(app)
      .post('/purchases')
      .set(auth)
      .send({ vendorId, qtyKg: '100', ratePerKg: '230', paymentType: 'credit' });

    const vendor = await request(app).get(`/vendors/${vendorId}`).set(auth);
    expect(vendor.body.data.vendor.currentPayableMinor).toBe(2_300_000); // 23,000.00

    const aging = await request(app).get(`/vendors/${vendorId}/aging`).set(auth);
    expect(aging.body.data.aging.current).toBe(2_300_000);
    expect((await trialBalance()).balanced).toBe(true);
  });

  it('partial payment splits between cash and payable', async () => {
    const vendorId = await makeVendor({ name: 'Partial Vendor' });
    await request(app)
      .post('/purchases')
      .set(auth)
      .send({
        vendorId,
        qtyKg: '100',
        ratePerKg: '230',
        paymentType: 'partial',
        amountPaid: '10000',
        paymentAccountId: cashId,
      });
    const vendor = await request(app).get(`/vendors/${vendorId}`).set(auth);
    expect(vendor.body.data.vendor.currentPayableMinor).toBe(1_300_000); // 23,000 - 10,000
    expect((await trialBalance()).balanced).toBe(true);
  });

  it('vendor payment reduces the payable', async () => {
    const vendorId = await makeVendor({ name: 'Payable Vendor' });
    await request(app)
      .post('/purchases')
      .set(auth)
      .send({ vendorId, qtyKg: '100', ratePerKg: '230', paymentType: 'credit' });

    await request(app)
      .post(`/vendors/${vendorId}/payments`)
      .set(auth)
      .send({ amount: '8000', paymentAccountId: cashId });

    const vendor = await request(app).get(`/vendors/${vendorId}`).set(auth);
    expect(vendor.body.data.vendor.currentPayableMinor).toBe(1_500_000); // 23,000 - 8,000
    expect((await trialBalance()).balanced).toBe(true);
  });

  it('vendor opening balance posts a balanced opening entry', async () => {
    const vendorId = await makeVendor({ name: 'Opening Vendor', openingBalance: '10000' });
    const vendor = await request(app).get(`/vendors/${vendorId}`).set(auth);
    expect(vendor.body.data.vendor.currentPayableMinor).toBe(1_000_000);
    expect((await trialBalance()).balanced).toBe(true);
  });
});

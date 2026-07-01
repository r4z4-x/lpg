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
import { ROLES } from '../constants/roles';

useTestDb();

const app = createApp();
const OWNER = { name: 'Owner', email: 'owner@test.com', password: 'password123', role: ROLES.OWNER };

async function ownerToken(): Promise<string> {
  const res = await request(app)
    .post('/auth/login')
    .send({ email: OWNER.email, password: OWNER.password });
  return res.body.data.accessToken;
}

beforeEach(async () => {
  await seedAccounts();
  await getSettings();
  await seedPaymentAccounts();
  await seedCylinderTypes();
  await createUser(OWNER);
});

describe('opening balances (M2+M3 capstone)', () => {
  it('posts cash + gas + cylinders against Opening Balance Equity and locks', async () => {
    const token = await ownerToken();
    const auth = { Authorization: `Bearer ${token}` };

    const accounts = await request(app).get('/setup/payment-accounts').set(auth);
    const cash = accounts.body.data.paymentAccounts.find(
      (a: { type: string }) => a.type === 'Cash',
    );
    const types = await request(app).get('/setup/cylinder-types').set(auth);
    const typeId = types.body.data.cylinderTypes[0]._id;

    const post = await request(app)
      .post('/setup/opening-balances')
      .set(auth)
      .send({
        paymentAccounts: [{ accountId: cash._id, amount: '100000' }],
        gas: { kg: '1000', value: '250000' },
        cylinders: [{ cylinderTypeId: typeId, filled: 50, empty: 30, shellAssetValue: '50000' }],
      });
    expect(post.status).toBe(201);
    expect(post.body.data.locked).toBe(true);

    // Gas inventory reflects opening WAC = 250000 / 1000 = 250.00
    const gas = await request(app).get('/inventory/gas').set(auth);
    expect(gas.body.data.gas.availableKg).toBe('1000.000');
    expect(gas.body.data.gas.weightedAvgCost).toBe('250.00');
    expect(gas.body.data.gas.inventoryValue).toBe('250000.00');

    // Ledger balances: total debits = 100000 + 250000 + 50000 = 400000.00
    const tb = await trialBalance();
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebitMinor).toBe(40_000_000);

    // Re-posting is blocked.
    const again = await request(app)
      .post('/setup/opening-balances')
      .set(auth)
      .send({ gas: { kg: '10', value: '2500' } });
    expect(again.status).toBe(409);
  });
});

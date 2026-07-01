import { Types } from 'mongoose';
import { Customer } from '../models/customer.model';
import { Money } from '../utils/money';
import { withTransaction } from '../utils/transaction';
import { toBusinessDate } from '../utils/businessDay';
import { NotFoundError } from '../utils/errors';
import { getSettings } from './companySettings.service';
import * as ledger from './ledger.service';
import * as audit from './audit.service';

export interface CreateCustomerInput {
  name: string;
  contact?: string;
  openingReceivable?: string; // human money
  creditLimit?: string;
  cylinderLimit?: number;
}

/**
 * Creates a customer. A non-zero opening receivable posts its own opening entry
 * (Dr Accounts Receivable, Cr Opening Balance Equity).
 */
export async function createCustomer(input: CreateCustomerInput, userId: string) {
  return withTransaction(async (session) => {
    const openingMinor = input.openingReceivable
      ? Money.fromMajor(input.openingReceivable).toMinorNumber()
      : 0;

    const [customer] = await Customer.create(
      [
        {
          name: input.name.trim(),
          contact: input.contact ?? null,
          openingReceivableMinor: openingMinor,
          currentReceivableMinor: openingMinor,
          creditLimitMinor: input.creditLimit ? Money.fromMajor(input.creditLimit).toMinorNumber() : 0,
          cylinderLimit: input.cylinderLimit ?? 0,
        },
      ],
      { session },
    );

    if (openingMinor > 0) {
      const settings = await getSettings(session);
      await ledger.post(
        {
          date: new Date(),
          businessDate: toBusinessDate(new Date(), settings.businessTimezone),
          sourceType: 'Opening',
          memo: `Opening receivable for customer ${customer!.name}`,
          createdBy: userId,
          lines: [
            { accountCode: '1100', debitMinor: openingMinor, partyType: 'Customer', partyId: customer!._id },
            { accountCode: '3020', creditMinor: openingMinor },
          ],
        },
        session,
      );
    }

    await audit.record(
      { userId, action: 'create', entity: 'Customer', entityId: customer!._id, newValue: input },
      session,
    );
    return customer!;
  });
}

export function listCustomers() {
  return Customer.find().sort({ name: 1 });
}

export async function getCustomer(id: string | Types.ObjectId) {
  const customer = await Customer.findById(id);
  if (!customer) throw new NotFoundError('Customer not found');
  return customer;
}

export function customerLedger(id: string | Types.ObjectId) {
  return ledger.entriesForParty(id);
}

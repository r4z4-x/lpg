import { Types } from 'mongoose';
import { Vendor } from '../models/vendor.model';
import { Money } from '../utils/money';
import { withTransaction } from '../utils/transaction';
import { toBusinessDate } from '../utils/businessDay';
import { NotFoundError } from '../utils/errors';
import { getSettings } from './companySettings.service';
import * as ledger from './ledger.service';
import * as audit from './audit.service';

export interface CreateVendorInput {
  name: string;
  contact?: string;
  openingBalance?: string; // human money — opening payable
}

/**
 * Creates a vendor. A non-zero opening payable posts its own opening entry
 * (Dr Opening Balance Equity, Cr Accounts Payable) so the ledger stays balanced.
 */
export async function createVendor(input: CreateVendorInput, userId: string) {
  return withTransaction(async (session) => {
    const openingMinor = input.openingBalance
      ? Money.fromMajor(input.openingBalance).toMinorNumber()
      : 0;

    const [vendor] = await Vendor.create(
      [
        {
          name: input.name.trim(),
          contact: input.contact ?? null,
          openingBalanceMinor: openingMinor,
          currentPayableMinor: openingMinor,
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
          memo: `Opening payable for vendor ${vendor!.name}`,
          createdBy: userId,
          lines: [
            { accountCode: '3020', debitMinor: openingMinor },
            { accountCode: '2010', creditMinor: openingMinor, partyType: 'Vendor', partyId: vendor!._id },
          ],
        },
        session,
      );
    }

    await audit.record(
      { userId, action: 'create', entity: 'Vendor', entityId: vendor!._id, newValue: input },
      session,
    );
    return vendor!;
  });
}

export function listVendors() {
  return Vendor.find().sort({ name: 1 });
}

export async function getVendor(id: string | Types.ObjectId) {
  const vendor = await Vendor.findById(id);
  if (!vendor) throw new NotFoundError('Vendor not found');
  return vendor;
}

/** Ledger entries that touch this vendor (party-scoped). */
export function vendorLedger(id: string | Types.ObjectId) {
  return ledger.entriesForParty(id);
}

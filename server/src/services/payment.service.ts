import { Types } from 'mongoose';
import { Payment } from '../models/payment.model';
import { Vendor } from '../models/vendor.model';
import { Purchase } from '../models/purchase.model';
import { PaymentAccount, ledgerCodeForAccountType } from '../models/paymentAccount.model';
import { Money } from '../utils/money';
import { withTransaction } from '../utils/transaction';
import { toBusinessDate } from '../utils/businessDay';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getSettings } from './companySettings.service';
import * as ledger from './ledger.service';
import * as audit from './audit.service';

export interface VendorPaymentInput {
  vendorId: string;
  amount: string;
  paymentAccountId: string;
  date?: string;
  note?: string;
}

/** Pays a vendor: Dr Accounts Payable, Cr Cash/Bank; reduces the vendor's payable. */
export async function payVendor(input: VendorPaymentInput, userId: string) {
  return withTransaction(async (session) => {
    const vendor = await Vendor.findById(input.vendorId).session(session);
    if (!vendor) throw new NotFoundError('Vendor not found');
    const account = await PaymentAccount.findById(input.paymentAccountId).session(session);
    if (!account) throw new NotFoundError('Payment account not found');

    const amount = Money.fromMajor(input.amount);
    if (!amount.isPositive()) throw new ValidationError('Amount must be positive');

    const settings = await getSettings(session);
    const date = input.date ? new Date(input.date) : new Date();
    const businessDate = toBusinessDate(date, settings.businessTimezone);

    const entry = await ledger.post(
      {
        date,
        businessDate,
        sourceType: 'Payment',
        memo: `Payment to vendor ${vendor.name}`,
        createdBy: userId,
        lines: [
          { accountCode: '2010', debitMinor: amount.toMinorNumber(), partyType: 'Vendor', partyId: vendor._id },
          { accountCode: ledgerCodeForAccountType(account.type), creditMinor: amount.toMinorNumber() },
        ],
      },
      session,
    );

    vendor.currentPayableMinor -= amount.toMinorNumber();
    await vendor.save({ session });
    account.currentBalanceMinor -= amount.toMinorNumber();
    await account.save({ session });

    const [payment] = await Payment.create(
      [
        {
          partyType: 'Vendor',
          partyId: vendor._id,
          direction: 'out',
          amountMinor: amount.toMinorNumber(),
          paymentAccountId: account._id,
          ledgerEntryId: entry._id,
          date,
          businessDate,
          note: input.note ?? null,
          createdBy: userId,
        },
      ],
      { session },
    );

    await audit.record(
      { userId, action: 'create', entity: 'Payment', entityId: payment!._id, newValue: input },
      session,
    );
    return payment!;
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Simple payables aging from unpaid purchases (buckets by age in days). */
export async function vendorAging(vendorId: string | Types.ObjectId, now: Date = new Date()) {
  const purchases = await Purchase.find({ vendorId, status: 'active' });
  const buckets = { current: 0, d31to60: 0, d61to90: 0, over90: 0, total: 0 };
  for (const p of purchases) {
    const outstanding = p.landedCostMinor - p.amountPaidMinor;
    if (outstanding <= 0) continue;
    const ageDays = Math.floor((now.getTime() - p.date.getTime()) / DAY_MS);
    if (ageDays <= 30) buckets.current += outstanding;
    else if (ageDays <= 60) buckets.d31to60 += outstanding;
    else if (ageDays <= 90) buckets.d61to90 += outstanding;
    else buckets.over90 += outstanding;
    buckets.total += outstanding;
  }
  return buckets;
}

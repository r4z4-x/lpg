import { Types } from 'mongoose';
import { Purchase } from '../models/purchase.model';
import { Vendor } from '../models/vendor.model';
import { PaymentAccount, ledgerCodeForAccountType } from '../models/paymentAccount.model';
import { Money } from '../utils/money';
import { Quantity } from '../utils/quantity';
import { withTransaction } from '../utils/transaction';
import { toBusinessDate } from '../utils/businessDay';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getSettings } from './companySettings.service';
import * as costing from './costing.service';
import * as ledger from './ledger.service';
import * as audit from './audit.service';
import { nextSeq } from './counter.service';
import type { LedgerLineInput } from './ledger.service';

export interface CreatePurchaseInput {
  vendorId: string;
  qtyKg: string;
  ratePerKg: string;
  transport?: string;
  misc?: string;
  paymentType: 'full' | 'partial' | 'credit';
  amountPaid?: string; // required/relevant for partial
  paymentAccountId?: string; // required when any amount is paid
  date?: string;
}

export async function createPurchase(input: CreatePurchaseInput, userId: string) {
  return withTransaction(async (session) => {
    const vendor = await Vendor.findById(input.vendorId).session(session);
    if (!vendor) throw new NotFoundError('Vendor not found');

    const qty = Quantity.fromKg(input.qtyKg);
    if (qty.isZero() || qty.isNegative()) throw new ValidationError('Quantity must be positive');
    const rate = Money.fromMajor(input.ratePerKg);
    const gasCost = Money.fromRateAndQuantity(rate, qty);
    const transport = Money.fromMajor(input.transport ?? '0');
    const misc = Money.fromMajor(input.misc ?? '0');
    const landedCost = gasCost.add(transport).add(misc);

    // Determine amount paid now vs. payable.
    let amountPaid: Money;
    if (input.paymentType === 'full') amountPaid = landedCost;
    else if (input.paymentType === 'credit') amountPaid = Money.zero();
    else {
      amountPaid = Money.fromMajor(input.amountPaid ?? '0');
      if (!amountPaid.isPositive() || amountPaid.compare(landedCost) >= 0) {
        throw new ValidationError('Partial payment must be greater than 0 and less than total cost');
      }
    }
    const remainder = landedCost.subtract(amountPaid);

    // Increase gas inventory and recompute WAC.
    await costing.applyPurchase(qty, landedCost, session);

    const settings = await getSettings(session);
    const lines: LedgerLineInput[] = [{ accountCode: '1200', debitMinor: landedCost.toMinorNumber() }];

    let paymentAccountId: Types.ObjectId | null = null;
    if (amountPaid.isPositive()) {
      if (!input.paymentAccountId) throw new ValidationError('paymentAccountId required when paying');
      const account = await PaymentAccount.findById(input.paymentAccountId).session(session);
      if (!account) throw new NotFoundError('Payment account not found');
      account.currentBalanceMinor -= amountPaid.toMinorNumber();
      await account.save({ session });
      paymentAccountId = account._id;
      lines.push({ accountCode: ledgerCodeForAccountType(account.type), creditMinor: amountPaid.toMinorNumber() });
    }
    if (remainder.isPositive()) {
      lines.push({
        accountCode: '2010',
        creditMinor: remainder.toMinorNumber(),
        partyType: 'Vendor',
        partyId: vendor._id,
      });
      vendor.currentPayableMinor += remainder.toMinorNumber();
      await vendor.save({ session });
    }

    const date = input.date ? new Date(input.date) : new Date();
    const entry = await ledger.post(
      {
        date,
        businessDate: toBusinessDate(date, settings.businessTimezone),
        sourceType: 'Purchase',
        memo: `Purchase from ${vendor.name}`,
        createdBy: userId,
        lines,
      },
      session,
    );

    const purchaseNo = await nextSeq('purchaseNo', session);
    const [purchase] = await Purchase.create(
      [
        {
          purchaseNo,
          vendorId: vendor._id,
          date,
          businessDate: entry.businessDate,
          qtyKgSub: Number(qty.toSub()),
          ratePerKgMinor: rate.toMinorNumber(),
          gasCostMinor: gasCost.toMinorNumber(),
          transportMinor: transport.toMinorNumber(),
          miscMinor: misc.toMinorNumber(),
          landedCostMinor: landedCost.toMinorNumber(),
          paymentType: input.paymentType,
          amountPaidMinor: amountPaid.toMinorNumber(),
          paymentAccountId,
          ledgerEntryId: entry._id,
          createdBy: userId,
        },
      ],
      { session },
    );

    await audit.record(
      { userId, action: 'create', entity: 'Purchase', entityId: purchase!._id, newValue: input },
      session,
    );

    return purchase!;
  });
}

export function listPurchases() {
  return Purchase.find().sort({ purchaseNo: -1 });
}

export async function getPurchase(id: string | Types.ObjectId) {
  const purchase = await Purchase.findById(id);
  if (!purchase) throw new NotFoundError('Purchase not found');
  return purchase;
}

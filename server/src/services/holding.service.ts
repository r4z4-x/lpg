import { Types } from 'mongoose';
import { CustomerCylinderHolding } from '../models/customerCylinderHolding.model';
import { Customer } from '../models/customer.model';
import { PaymentAccount, ledgerCodeForAccountType } from '../models/paymentAccount.model';
import { withTransaction } from '../utils/transaction';
import { toBusinessDate } from '../utils/businessDay';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getSettings } from './companySettings.service';
import * as inventory from './inventory.service';
import * as ledger from './ledger.service';
import * as audit from './audit.service';
import type { LedgerLineInput } from './ledger.service';

export interface ReturnCylinderInput {
  customerId: string;
  cylinderTypeId: string;
  qty: number;
  condition: 'good' | 'damaged' | 'lost';
  refundDeposit?: boolean;
  paymentAccountId?: string;
  date?: string;
}

/**
 * Processes a cylinder return (FIFO across the customer's holdings):
 *  - reduces pending holdings + the customer's held count,
 *  - moves shells customerHeld → empty (good) | damaged | lost,
 *  - good + refund: Dr Deposit Liability / Cr Cash; damaged/lost: deposit forfeited to
 *    Damage Recovery income (Dr Deposit Liability / Cr 4030).
 */
export async function returnCylinders(input: ReturnCylinderInput, userId: string) {
  if (input.qty <= 0) throw new ValidationError('qty must be positive');

  return withTransaction(async (session) => {
    const customer = await Customer.findById(input.customerId).session(session);
    if (!customer) throw new NotFoundError('Customer not found');

    const holdings = await CustomerCylinderHolding.find({
      customerId: input.customerId,
      cylinderTypeId: input.cylinderTypeId,
      status: 'held',
      qty: { $gt: 0 },
    })
      .sort({ issueDate: 1 })
      .session(session);

    const date = input.date ? new Date(input.date) : new Date();
    let remaining = input.qty;
    let depositConsumed = 0n;

    for (const h of holdings) {
      if (remaining <= 0) break;
      const take = Math.min(h.qty, remaining);
      h.qty -= take;
      if (h.qty === 0) {
        h.status = 'returned';
        h.returnDate = date;
      }
      depositConsumed += BigInt(h.depositPerUnitMinor) * BigInt(take);
      await h.save({ session });
      remaining -= take;
    }
    if (remaining > 0) {
      throw new ValidationError('Customer does not hold that many cylinders of this type');
    }

    // Shell register movement.
    const movement: Parameters<typeof inventory.adjust>[1] = { customerHeld: -input.qty };
    if (input.condition === 'good') movement.empty = input.qty;
    else if (input.condition === 'damaged') movement.damaged = input.qty;
    else movement.lost = input.qty;
    await inventory.adjust(input.cylinderTypeId, movement, session);

    customer.heldCylinders -= input.qty;
    if (customer.heldCylinders < 0) customer.heldCylinders = 0;
    await customer.save({ session });

    // Deposit handling.
    const settings = await getSettings(session);
    const businessDate = toBusinessDate(date, settings.businessTimezone);
    let refundMinor = 0;

    if (depositConsumed > 0n) {
      if (input.condition === 'good' && input.refundDeposit) {
        if (!input.paymentAccountId) {
          throw new ValidationError('paymentAccountId required to refund a deposit');
        }
        const account = await PaymentAccount.findById(input.paymentAccountId).session(session);
        if (!account) throw new NotFoundError('Payment account not found');
        refundMinor = Number(depositConsumed);
        account.currentBalanceMinor -= refundMinor;
        await account.save({ session });

        const lines: LedgerLineInput[] = [
          { accountCode: '2100', debitMinor: refundMinor },
          { accountCode: ledgerCodeForAccountType(account.type), creditMinor: refundMinor },
        ];
        await ledger.post(
          { date, businessDate, sourceType: 'Return', memo: 'Cylinder deposit refund', createdBy: userId, lines },
          session,
        );
      } else if (input.condition !== 'good') {
        // Deposit forfeited → recognised as damage recovery income.
        const lines: LedgerLineInput[] = [
          { accountCode: '2100', debitMinor: Number(depositConsumed) },
          { accountCode: '4030', creditMinor: Number(depositConsumed) },
        ];
        await ledger.post(
          { date, businessDate, sourceType: 'Return', memo: 'Cylinder deposit forfeited', createdBy: userId, lines },
          session,
        );
      }
    }

    await audit.record(
      { userId, action: 'return', entity: 'CylinderReturn', entityId: customer._id, newValue: input },
      session,
    );

    return { returned: input.qty, condition: input.condition, refundMinor, heldRemaining: customer.heldCylinders };
  });
}

/** All currently-held cylinder batches (pending returns). */
export function listPending() {
  return CustomerCylinderHolding.find({ status: 'held', qty: { $gt: 0 } })
    .populate('customerId', 'name')
    .populate('cylinderTypeId', 'name')
    .sort({ issueDate: 1 });
}

export function listForCustomer(customerId: string | Types.ObjectId) {
  return CustomerCylinderHolding.find({ customerId }).sort({ issueDate: -1 });
}

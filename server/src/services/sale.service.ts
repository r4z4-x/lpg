import { Types } from 'mongoose';
import { Sale } from '../models/sale.model';
import { Customer } from '../models/customer.model';
import { CylinderType } from '../models/cylinderType.model';
import { CustomerCylinderHolding } from '../models/customerCylinderHolding.model';
import { PaymentAccount, ledgerCodeForAccountType } from '../models/paymentAccount.model';
import { Money } from '../utils/money';
import { Quantity } from '../utils/quantity';
import { divRoundHalfUp } from '../utils/decimal';
import { withTransaction } from '../utils/transaction';
import { toBusinessDate } from '../utils/businessDay';
import { NotFoundError, ValidationError } from '../utils/errors';
import { getSettings } from './companySettings.service';
import * as costing from './costing.service';
import * as inventory from './inventory.service';
import * as ledger from './ledger.service';
import * as audit from './audit.service';
import { nextSeq } from './counter.service';
import type { LedgerLineInput } from './ledger.service';

export interface SaleChargeInput {
  name: string;
  amount: string;
}

export interface CreateSaleInput {
  customerId: string;
  customerType: 'exchange' | 'no_cylinder';
  qtyKg: string;
  saleRate: string;
  cylinderTypeId: string;
  cylinderCount?: number;
  charges?: SaleChargeInput[];
  discount?: string;
  paymentType: 'full' | 'partial' | 'credit';
  amountPaid?: string;
  previousBalanceRecovery?: string;
  paymentAccountId?: string;
  collectDeposit?: boolean;
  date?: string;
}

/** Maps a revenue charge name to its income account code (defaults to "Other"). */
function chargeAccount(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('deliver')) return '4021';
  if (n.includes('rent')) return '4022';
  if (n.includes('load')) return '4023';
  return '4025';
}

export async function createSale(input: CreateSaleInput, userId: string) {
  return withTransaction(async (session) => {
    const customer = await Customer.findById(input.customerId).session(session);
    if (!customer || !customer.isActive) throw new NotFoundError('Customer not found');
    const settings = await getSettings(session);

    const cylinderType = await CylinderType.findById(input.cylinderTypeId).session(session);
    if (!cylinderType) throw new NotFoundError('Cylinder type not found');
    const count = input.cylinderCount ?? 1;
    if (count <= 0) throw new ValidationError('cylinderCount must be positive');

    // --- Invoice maths ---
    const qty = Quantity.fromKg(input.qtyKg);
    if (qty.isZero() || qty.isNegative()) throw new ValidationError('Quantity must be positive');
    const rate = Money.fromMajor(input.saleRate);
    const gasAmount = Money.fromRateAndQuantity(rate, qty);

    const charges = (input.charges ?? []).map((c) => ({
      name: c.name,
      amount: Money.fromMajor(c.amount),
    }));
    const chargesTotal = Money.sum(charges.map((c) => c.amount));
    const discount = Money.fromMajor(input.discount ?? '0');

    let tax = Money.zero();
    if (settings.tax.enabled && settings.tax.ratePercent > 0) {
      const base = gasAmount.add(chargesTotal).subtract(discount);
      tax = Money.fromMinor(divRoundHalfUp(base.toMinor() * BigInt(Math.round(settings.tax.ratePercent)), 100n));
    }
    const invoiceAmount = gasAmount.add(chargesTotal).subtract(discount).add(tax);
    if (invoiceAmount.isNegative()) throw new ValidationError('Invoice amount cannot be negative');

    // --- COGS snapshot (also guards stock) ---
    const { wacMinor, cogsMinor } = await costing.deductForSale(qty, session);

    // --- Payment split ---
    let amountPaid: Money;
    if (input.paymentType === 'full') amountPaid = invoiceAmount;
    else if (input.paymentType === 'credit') amountPaid = Money.zero();
    else {
      amountPaid = Money.fromMajor(input.amountPaid ?? '0');
      if (!amountPaid.isPositive() || amountPaid.compare(invoiceAmount) >= 0) {
        throw new ValidationError('Partial payment must be > 0 and < invoice amount');
      }
    }
    const unpaidInvoice = invoiceAmount.subtract(amountPaid);

    const recovery = Money.fromMajor(input.previousBalanceRecovery ?? '0');
    const priorReceivable = Money.fromMinor(BigInt(customer.currentReceivableMinor));
    if (recovery.isPositive() && recovery.compare(priorReceivable) > 0) {
      throw new ValidationError('Previous-balance recovery exceeds outstanding balance');
    }

    // --- Deposit (optional, no-cylinder only) ---
    let deposit = Money.zero();
    if (input.customerType === 'no_cylinder' && input.collectDeposit && cylinderType.depositAmountMinor) {
      deposit = Money.fromMinor(BigInt(cylinderType.depositAmountMinor)).multiplyInt(count);
    }

    // --- Credit limit ---
    const newReceivable = priorReceivable.add(unpaidInvoice).subtract(recovery);
    if (customer.creditLimitMinor > 0 && newReceivable.toMinorNumber() > customer.creditLimitMinor) {
      throw new ValidationError('Credit limit exceeded');
    }

    // --- Cylinder movement (shell register) ---
    if (input.customerType === 'exchange') {
      await inventory.adjust(cylinderType._id, { empty: count, filled: -count }, session);
    } else {
      if (customer.cylinderLimit > 0 && customer.heldCylinders + count > customer.cylinderLimit) {
        throw new ValidationError('Cylinder limit exceeded');
      }
      await inventory.adjust(cylinderType._id, { filled: -count, customerHeld: count }, session);
    }

    // --- Cash movement ---
    const cashIn = amountPaid.add(recovery);
    const cashTotal = cashIn.add(deposit);
    let paymentAccountId: Types.ObjectId | null = null;
    let accountType: 'Cash' | 'Bank' | 'Wallet' = 'Cash';
    if (cashTotal.isPositive()) {
      if (!input.paymentAccountId) throw new ValidationError('paymentAccountId required when cash is received');
      const account = await PaymentAccount.findById(input.paymentAccountId).session(session);
      if (!account) throw new NotFoundError('Payment account not found');
      account.currentBalanceMinor += cashTotal.toMinorNumber();
      await account.save({ session });
      paymentAccountId = account._id;
      accountType = account.type;
    }

    // --- Ledger (single balanced entry; revenue excludes recovery) ---
    const lines: LedgerLineInput[] = [];
    if (cashTotal.isPositive())
      lines.push({ accountCode: ledgerCodeForAccountType(accountType), debitMinor: cashTotal.toMinorNumber() });
    if (gasAmount.isPositive()) lines.push({ accountCode: '4010', creditMinor: gasAmount.toMinorNumber() });

    const chargeByCode = new Map<string, bigint>();
    for (const c of charges) {
      const code = chargeAccount(c.name);
      chargeByCode.set(code, (chargeByCode.get(code) ?? 0n) + BigInt(c.amount.toMinorNumber()));
    }
    for (const [code, amt] of chargeByCode) {
      if (amt > 0n) lines.push({ accountCode: code, creditMinor: Number(amt) });
    }

    if (discount.isPositive()) lines.push({ accountCode: '4090', debitMinor: discount.toMinorNumber() });
    if (tax.isPositive()) lines.push({ accountCode: '2300', creditMinor: tax.toMinorNumber() });
    if (unpaidInvoice.isPositive())
      lines.push({ accountCode: '1100', debitMinor: unpaidInvoice.toMinorNumber(), partyType: 'Customer', partyId: customer._id });
    if (recovery.isPositive())
      lines.push({ accountCode: '1100', creditMinor: recovery.toMinorNumber(), partyType: 'Customer', partyId: customer._id });
    lines.push({ accountCode: '5010', debitMinor: cogsMinor });
    lines.push({ accountCode: '1200', creditMinor: cogsMinor });
    if (deposit.isPositive()) lines.push({ accountCode: '2100', creditMinor: deposit.toMinorNumber() });

    const date = input.date ? new Date(input.date) : new Date();
    const businessDate = toBusinessDate(date, settings.businessTimezone);
    const entry = await ledger.post(
      { date, businessDate, sourceType: 'Sale', memo: `Sale to ${customer.name}`, createdBy: userId, lines },
      session,
    );

    // --- Persist customer + sale (+ holding) ---
    customer.currentReceivableMinor = newReceivable.toMinorNumber();
    if (input.customerType === 'no_cylinder') customer.heldCylinders += count;
    await customer.save({ session });

    const invoiceNo = await nextSeq('invoiceNo', session);
    const [sale] = await Sale.create(
      [
        {
          invoiceNo,
          customerId: customer._id,
          customerType: input.customerType,
          date,
          businessDate,
          qtyKgSub: Number(qty.toSub()),
          saleRateMinor: rate.toMinorNumber(),
          gasAmountMinor: gasAmount.toMinorNumber(),
          charges: charges.map((c) => ({ name: c.name, amountMinor: c.amount.toMinorNumber() })),
          discountMinor: discount.toMinorNumber(),
          taxMinor: tax.toMinorNumber(),
          invoiceAmountMinor: invoiceAmount.toMinorNumber(),
          unitCostAtSaleMinor: wacMinor,
          cogsMinor,
          amountPaidMinor: amountPaid.toMinorNumber(),
          previousBalanceRecoveryMinor: recovery.toMinorNumber(),
          totalReceivedMinor: cashIn.toMinorNumber(),
          paymentType: input.paymentType,
          paymentAccountId,
          cylinderTypeId: cylinderType._id,
          cylinderCount: count,
          depositMinor: deposit.toMinorNumber(),
          ledgerEntryId: entry._id,
          createdBy: userId,
        },
      ],
      { session },
    );

    if (input.customerType === 'no_cylinder') {
      await CustomerCylinderHolding.create(
        [
          {
            customerId: customer._id,
            cylinderTypeId: cylinderType._id,
            qty: count,
            issuedQty: count,
            issueDate: date,
            depositPerUnitMinor: cylinderType.depositAmountMinor ?? 0,
            status: 'held',
            saleId: sale!._id,
            createdBy: userId,
          },
        ],
        { session },
      );
    }

    await audit.record(
      { userId, action: 'create', entity: 'Sale', entityId: sale!._id, newValue: input },
      session,
    );

    return sale!;
  });
}

/** Strips profit-sensitive fields for non-Owner roles (Operators must not see profit). */
export function serializeSale(sale: { toObject: () => Record<string, unknown> }, isOwner: boolean) {
  const obj = sale.toObject();
  if (!isOwner) {
    delete obj.cogsMinor;
    delete obj.unitCostAtSaleMinor;
  }
  return obj;
}

export function listSales() {
  return Sale.find().sort({ invoiceNo: -1 });
}

export async function getSale(id: string | Types.ObjectId) {
  const sale = await Sale.findById(id);
  if (!sale) throw new NotFoundError('Sale not found');
  return sale;
}

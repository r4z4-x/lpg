import type { ClientSession } from 'mongoose';
import { GasInventory, GAS_INVENTORY_ID } from '../models/gasInventory.model';
import { Money } from '../utils/money';
import { Quantity } from '../utils/quantity';
import { ValidationError } from '../utils/errors';

/** Loads the gas inventory singleton, creating it (zeroed) on first use. */
export async function getGasInventory(session?: ClientSession) {
  const existing = await GasInventory.findById(GAS_INVENTORY_ID).session(session ?? null);
  if (existing) return existing;
  const [created] = await GasInventory.create(
    [{ _id: GAS_INVENTORY_ID }],
    session ? { session } : {},
  );
  return created!;
}

/**
 * Applies a purchase: increases gas KG and recomputes the weighted average cost.
 *   WAC = (oldValue + landedCost) / (oldKg + qty)
 * Concurrency-safe inside a transaction (write conflicts trigger withTransaction retry).
 */
export async function applyPurchase(
  qty: Quantity,
  landedCost: Money,
  session: ClientSession,
) {
  const gas = await getGasInventory(session);
  const newKg = Quantity.fromSub(BigInt(gas.availableKgSub) + qty.toSub());
  const newValue = Money.fromMinor(BigInt(gas.inventoryValueMinor)).add(landedCost);
  const newWac = newKg.isZero() ? Money.zero() : Money.rateFromTotalAndQuantity(newValue, newKg);

  gas.availableKgSub = Number(newKg.toSub());
  gas.inventoryValueMinor = newValue.toMinorNumber();
  gas.wacMinor = newWac.toMinorNumber();
  await gas.save({ session });
  return gas;
}

export interface SaleCosting {
  wacMinor: number; // cost per kg used
  cogsMinor: number; // qty × WAC
}

/**
 * Deducts gas for a sale at the current WAC. Blocks negative stock. WAC is unchanged by a
 * sale; inventory value drops by COGS. Returns the snapshotted WAC and COGS for the caller
 * to post to the ledger (F3).
 */
export async function deductForSale(qty: Quantity, session: ClientSession): Promise<SaleCosting> {
  const gas = await getGasInventory(session);
  const available = Quantity.fromSub(BigInt(gas.availableKgSub));
  if (!available.gte(qty)) {
    throw new ValidationError(
      `Insufficient gas stock: have ${available.toKgString()} kg, need ${qty.toKgString()} kg`,
    );
  }

  const wac = Money.fromMinor(BigInt(gas.wacMinor));
  const cogs = Money.fromRateAndQuantity(wac, qty);

  gas.availableKgSub = Number(available.toSub() - qty.toSub());
  gas.inventoryValueMinor = Money.fromMinor(BigInt(gas.inventoryValueMinor))
    .subtract(cogs)
    .toMinorNumber();
  await gas.save({ session });

  return { wacMinor: wac.toMinorNumber(), cogsMinor: cogs.toMinorNumber() };
}

/**
 * Adjusts gas stock by a signed quantity (leakage/damage/correction), valued at the
 * current WAC (WAC itself is unchanged). Returns the signed valuation impact in minor units
 * (negative when stock is removed). Blocks the stock from going negative.
 */
export async function adjustGas(qtyDeltaSub: bigint, session: ClientSession): Promise<number> {
  const gas = await getGasInventory(session);
  const newKgSub = BigInt(gas.availableKgSub) + qtyDeltaSub;
  if (newKgSub < 0n) throw new ValidationError('Adjustment would drive gas stock negative');

  const wac = Money.fromMinor(BigInt(gas.wacMinor));
  const magnitude = qtyDeltaSub < 0n ? -qtyDeltaSub : qtyDeltaSub;
  const valueMagnitude = Money.fromRateAndQuantity(wac, Quantity.fromSub(magnitude));
  const signedValue = qtyDeltaSub < 0n ? valueMagnitude.negate() : valueMagnitude;

  gas.availableKgSub = Number(newKgSub);
  gas.inventoryValueMinor = Money.fromMinor(BigInt(gas.inventoryValueMinor))
    .add(signedValue)
    .toMinorNumber();
  await gas.save({ session });
  return signedValue.toMinorNumber();
}

/** Sets opening gas stock and derives the opening WAC from the opening value. */
export async function setOpening(qty: Quantity, value: Money, session: ClientSession) {
  const gas = await getGasInventory(session);
  gas.availableKgSub = Number(qty.toSub());
  gas.inventoryValueMinor = value.toMinorNumber();
  gas.wacMinor = qty.isZero() ? 0 : Money.rateFromTotalAndQuantity(value, qty).toMinorNumber();
  await gas.save({ session });
  return gas;
}

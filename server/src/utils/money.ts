import { divRoundHalfUp, formatScaled, parseScaled } from './decimal';
import type { Quantity } from './quantity';
import { QUANTITY_SCALE } from './quantity';

/** Number of minor-unit decimals (e.g. 2 → paisa/cents). */
export const MONEY_SCALE = 2;
const QTY_FACTOR = 10n ** BigInt(QUANTITY_SCALE);

/**
 * Immutable money value stored as an integer number of minor units (BigInt).
 * All arithmetic is exact; conversions to/from human decimals use HALF-UP rounding.
 */
export class Money {
  private constructor(public readonly minor: bigint) {}

  // --- Constructors ---------------------------------------------------------

  static zero(): Money {
    return new Money(0n);
  }

  /** From a human decimal amount, e.g. Money.fromMajor('242.5') or Money.fromMajor(10). */
  static fromMajor(value: string | number): Money {
    return new Money(parseScaled(value, MONEY_SCALE));
  }

  /** From a raw minor-unit integer (paisa). */
  static fromMinor(minor: bigint | number): Money {
    if (typeof minor === 'number') {
      if (!Number.isInteger(minor)) throw new TypeError(`Minor units must be an integer: ${minor}`);
      return new Money(BigInt(minor));
    }
    return new Money(minor);
  }

  /**
   * Money = rate-per-unit × quantity, HALF-UP rounded to minor units.
   * e.g. gas amount = ratePerKg × kg.
   */
  static fromRateAndQuantity(ratePerUnit: Money, qty: Quantity): Money {
    // (paisa per kg) * (milli-kg) / 1000  →  paisa
    return new Money(divRoundHalfUp(ratePerUnit.minor * qty.sub, QTY_FACTOR));
  }

  /**
   * Rate-per-unit = total ÷ quantity, HALF-UP rounded to minor units.
   * e.g. weighted average cost per kg = inventory value ÷ kg.
   */
  static rateFromTotalAndQuantity(total: Money, qty: Quantity): Money {
    if (qty.isZero()) throw new RangeError('Cannot derive a rate from zero quantity');
    // (paisa) * 1000 / (milli-kg)  →  paisa per kg
    return new Money(divRoundHalfUp(total.minor * QTY_FACTOR, qty.sub));
  }

  static sum(values: Money[]): Money {
    return values.reduce((acc, m) => acc.add(m), Money.zero());
  }

  // --- Arithmetic -----------------------------------------------------------

  add(other: Money): Money {
    return new Money(this.minor + other.minor);
  }

  subtract(other: Money): Money {
    return new Money(this.minor - other.minor);
  }

  /** Multiply by an integer count (e.g. 3 cylinders). */
  multiplyInt(factor: number | bigint): Money {
    const f = typeof factor === 'number' ? BigInt(factor) : factor;
    if (typeof factor === 'number' && !Number.isInteger(factor)) {
      throw new TypeError(`multiplyInt expects an integer, got ${factor}`);
    }
    return new Money(this.minor * f);
  }

  negate(): Money {
    return new Money(-this.minor);
  }

  abs(): Money {
    return new Money(this.minor < 0n ? -this.minor : this.minor);
  }

  // --- Comparisons ----------------------------------------------------------

  compare(other: Money): -1 | 0 | 1 {
    return this.minor < other.minor ? -1 : this.minor > other.minor ? 1 : 0;
  }

  equals(other: Money): boolean {
    return this.minor === other.minor;
  }

  isZero(): boolean {
    return this.minor === 0n;
  }

  isNegative(): boolean {
    return this.minor < 0n;
  }

  isPositive(): boolean {
    return this.minor > 0n;
  }

  // --- Conversions ----------------------------------------------------------

  /** Raw minor units as BigInt (for exact persistence/derivation). */
  toMinor(): bigint {
    return this.minor;
  }

  /** Minor units as a JS number; throws if outside the safe-integer range. */
  toMinorNumber(): number {
    if (this.minor > BigInt(Number.MAX_SAFE_INTEGER) || this.minor < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError('Money value exceeds the safe integer range');
    }
    return Number(this.minor);
  }

  /** Human decimal string, e.g. "242.50". */
  toMajorString(): string {
    return formatScaled(this.minor, MONEY_SCALE);
  }

  /** JSON form for API responses: human decimal string (lossless, locale-free). */
  toJSON(): string {
    return this.toMajorString();
  }

  toString(): string {
    return this.toMajorString();
  }
}

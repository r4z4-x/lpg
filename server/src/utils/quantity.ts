import { formatScaled, parseScaled } from './decimal';

/** Number of decimal places tracked for gas quantities in KG (3 → grams). */
export const QUANTITY_SCALE = 3;

/**
 * Immutable gas quantity in KG, stored as an integer number of sub-units (BigInt, scale 3).
 * Exact arithmetic; no floats.
 */
export class Quantity {
  private constructor(public readonly sub: bigint) {}

  static zero(): Quantity {
    return new Quantity(0n);
  }

  /** From a KG value, e.g. Quantity.fromKg('50.5'). */
  static fromKg(value: string | number): Quantity {
    return new Quantity(parseScaled(value, QUANTITY_SCALE));
  }

  /** From raw sub-units (grams). */
  static fromSub(sub: bigint): Quantity {
    return new Quantity(sub);
  }

  add(other: Quantity): Quantity {
    return new Quantity(this.sub + other.sub);
  }

  subtract(other: Quantity): Quantity {
    return new Quantity(this.sub - other.sub);
  }

  compare(other: Quantity): -1 | 0 | 1 {
    return this.sub < other.sub ? -1 : this.sub > other.sub ? 1 : 0;
  }

  gte(other: Quantity): boolean {
    return this.sub >= other.sub;
  }

  isZero(): boolean {
    return this.sub === 0n;
  }

  isNegative(): boolean {
    return this.sub < 0n;
  }

  toSub(): bigint {
    return this.sub;
  }

  toKgString(): string {
    return formatScaled(this.sub, QUANTITY_SCALE);
  }

  toJSON(): string {
    return this.toKgString();
  }

  toString(): string {
    return this.toKgString();
  }
}

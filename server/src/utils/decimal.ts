/**
 * Exact fixed-point decimal helpers built on BigInt — the foundation for Money and Quantity.
 * Rounding policy (system-wide): HALF-UP, rounding away from zero on a tie (F5).
 * No JavaScript floats are used in any arithmetic path.
 */

/** Integer division of num/den with HALF-UP (away-from-zero) rounding. den must be non-zero. */
export function divRoundHalfUp(num: bigint, den: bigint): bigint {
  if (den === 0n) throw new RangeError('Division by zero');
  // Normalise so the denominator is positive; track sign on the numerator.
  let n = num;
  let d = den;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const negative = n < 0n;
  const a = negative ? -n : n;
  const q = a / d;
  const r = a % d;
  const rounded = 2n * r >= d ? q + 1n : q;
  return negative ? -rounded : rounded;
}

/**
 * Parse a decimal string/number into a scaled BigInt (value * 10^scale), HALF-UP rounded.
 * Accepts e.g. "242.5", "-10", 0, "1000.005". Rejects NaN/Infinity/garbage.
 */
export function parseScaled(value: string | number, scale: number): bigint {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`Not a finite number: ${value}`);
    value = value.toString();
  }
  const str = value.trim();
  if (!/^[+-]?\d+(\.\d+)?$/.test(str)) {
    throw new TypeError(`Invalid decimal: "${value}"`);
  }
  const negative = str.startsWith('-');
  const unsigned = str.replace(/^[+-]/, '');
  const [intPart = '0', fracPart = ''] = unsigned.split('.');
  // Take `scale` fractional digits plus one guard digit for rounding.
  const padded = (fracPart + '0'.repeat(scale + 1)).slice(0, scale + 1);
  const kept = padded.slice(0, scale);
  const guard = Number(padded[scale] ?? '0');
  const factor = 10n ** BigInt(scale);
  let scaled = BigInt(intPart) * factor + BigInt(kept === '' ? '0' : kept);
  if (guard >= 5) scaled += 1n;
  return negative ? -scaled : scaled;
}

/** Format a scaled BigInt (value * 10^scale) back to a fixed-precision decimal string. */
export function formatScaled(scaled: bigint, scale: number): string {
  if (scale === 0) return scaled.toString();
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString().padStart(scale + 1, '0');
  const cut = digits.length - scale;
  const intPart = digits.slice(0, cut);
  const fracPart = digits.slice(cut);
  return `${negative ? '-' : ''}${intPart}.${fracPart}`;
}

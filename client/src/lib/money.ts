/**
 * Client money layer (D3). The API stores money as integer minor units (paisa).
 * Display formats from minor units; forms submit decimal strings the API parses.
 * All arithmetic here stays on integers to avoid float drift.
 */

/** "242.50" from 24250 — for form prefills (no grouping). */
export function toMajorString(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/** "1,500.00" or "PKR 1,500.00" from 150000 — for display. */
export function formatMoney(minor: number, currency = ''): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const grouped = whole.toLocaleString('en-US');
  const prefix = currency ? `${currency} ` : '';
  return `${negative ? '-' : ''}${prefix}${grouped}.${frac}`;
}

/** Validate a user-entered amount string (decimal). Returns it trimmed, or throws. */
export function normalizeAmountInput(value: string): string {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error('Enter a valid amount (up to 2 decimals)');
  }
  return trimmed;
}

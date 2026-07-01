/** Format milli-kg sub-units as a KG string, e.g. 11800 → "11.800". */
export function formatKgSub(sub: number): string {
  const negative = sub < 0;
  const abs = Math.abs(Math.trunc(sub));
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000).padStart(3, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/** Short date display from an ISO string. */
export function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

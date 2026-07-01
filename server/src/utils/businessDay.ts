/**
 * Business-day & timezone helpers (M0.5 / M2).
 * Timestamps are stored in UTC; reporting buckets ("today", "this month") are computed
 * in the configured business timezone so a sale at 23:30 local lands on the correct day.
 */

/** Returns the business date as an ISO date string "YYYY-MM-DD" in the given IANA timezone. */
export function toBusinessDate(instant: Date, timeZone: string): string {
  // 'en-CA' formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Returns the business month as "YYYY-MM" in the given IANA timezone. */
export function toBusinessMonth(instant: Date, timeZone: string): string {
  return toBusinessDate(instant, timeZone).slice(0, 7);
}

/** Whether two instants fall on the same business day in the given timezone. */
export function isSameBusinessDay(a: Date, b: Date, timeZone: string): boolean {
  return toBusinessDate(a, timeZone) === toBusinessDate(b, timeZone);
}

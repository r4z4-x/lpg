import { describe, expect, it } from 'vitest';
import { isSameBusinessDay, toBusinessDate, toBusinessMonth } from '../utils/businessDay';

const TZ = 'Asia/Karachi'; // UTC+5, no DST

describe('businessDay', () => {
  it('buckets a late-evening local sale into the correct day', () => {
    // 2026-06-14T18:00:00Z = 23:00 local on the 14th
    expect(toBusinessDate(new Date('2026-06-14T18:00:00Z'), TZ)).toBe('2026-06-14');
    // 2026-06-14T19:30:00Z = 00:30 local on the 15th
    expect(toBusinessDate(new Date('2026-06-14T19:30:00Z'), TZ)).toBe('2026-06-15');
  });

  it('derives the business month', () => {
    expect(toBusinessMonth(new Date('2026-06-30T20:00:00Z'), TZ)).toBe('2026-07');
    expect(toBusinessMonth(new Date('2026-06-14T10:00:00Z'), TZ)).toBe('2026-06');
  });

  it('compares two instants for same business day', () => {
    const a = new Date('2026-06-14T18:00:00Z'); // 14th local
    const b = new Date('2026-06-14T19:30:00Z'); // 15th local
    expect(isSameBusinessDay(a, b, TZ)).toBe(false);
    expect(isSameBusinessDay(a, new Date('2026-06-14T05:00:00Z'), TZ)).toBe(true);
  });
});

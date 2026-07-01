import { describe, expect, it } from 'vitest';
import { formatKgSub, formatDate } from '@/lib/format';

describe('format helpers', () => {
  it('formats milli-kg sub-units as KG', () => {
    expect(formatKgSub(11800)).toBe('11.800');
    expect(formatKgSub(1000000)).toBe('1000.000');
    expect(formatKgSub(1)).toBe('0.001');
    expect(formatKgSub(-2000)).toBe('-2.000');
  });

  it('formats ISO dates to YYYY-MM-DD', () => {
    expect(formatDate('2026-06-14T10:00:00.000Z')).toBe('2026-06-14');
    expect(formatDate('')).toBe('');
  });
});

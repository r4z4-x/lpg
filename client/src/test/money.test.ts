import { describe, expect, it } from 'vitest';
import { formatMoney, toMajorString, normalizeAmountInput } from '@/lib/money';

describe('money layer', () => {
  it('formats minor units for display with grouping', () => {
    expect(formatMoney(150000)).toBe('1,500.00');
    expect(formatMoney(150000, 'PKR')).toBe('PKR 1,500.00');
    expect(formatMoney(-200000)).toBe('-2,000.00');
    expect(formatMoney(5)).toBe('0.05');
  });

  it('produces plain major strings for form prefills', () => {
    expect(toMajorString(24250)).toBe('242.50');
    expect(toMajorString(-1)).toBe('-0.01');
    expect(toMajorString(0)).toBe('0.00');
  });

  it('validates user amount input', () => {
    expect(normalizeAmountInput(' 242.5 ')).toBe('242.5');
    expect(() => normalizeAmountInput('12.345')).toThrow();
    expect(() => normalizeAmountInput('abc')).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { Quantity } from '../utils/quantity';

describe('Quantity', () => {
  it('parses and formats KG at 3dp', () => {
    expect(Quantity.fromKg('50.5').toKgString()).toBe('50.500');
    expect(Quantity.fromKg(1000).toKgString()).toBe('1000.000');
    expect(Quantity.fromKg('0.001').toSub()).toBe(1n);
  });

  it('rounds HALF-UP beyond 3dp', () => {
    expect(Quantity.fromKg('1.2345').toKgString()).toBe('1.235');
    expect(Quantity.fromKg('1.2344').toKgString()).toBe('1.234');
  });

  it('adds and subtracts exactly', () => {
    const a = Quantity.fromKg('1000');
    const b = Quantity.fromKg('1000');
    expect(a.add(b).toKgString()).toBe('2000.000');
    expect(a.subtract(Quantity.fromKg('50.5')).toKgString()).toBe('949.500');
  });

  it('supports stock guards via gte / isNegative', () => {
    const stock = Quantity.fromKg('100');
    expect(stock.gte(Quantity.fromKg('100'))).toBe(true);
    expect(stock.gte(Quantity.fromKg('100.001'))).toBe(false);
    expect(stock.subtract(Quantity.fromKg('150')).isNegative()).toBe(true);
  });

  it('serialises to a KG string in JSON', () => {
    expect(JSON.stringify({ kg: Quantity.fromKg('12.5') })).toBe('{"kg":"12.500"}');
  });
});

import { describe, expect, it } from 'vitest';
import { Money } from '../utils/money';
import { Quantity } from '../utils/quantity';

describe('Money', () => {
  it('parses and formats human decimals losslessly', () => {
    expect(Money.fromMajor('242.5').toMajorString()).toBe('242.50');
    expect(Money.fromMajor(10).toMajorString()).toBe('10.00');
    expect(Money.fromMajor('-0.01').toMinor()).toBe(-1n);
  });

  it('rounds HALF-UP when parsing beyond minor scale', () => {
    expect(Money.fromMajor('242.555').toMajorString()).toBe('242.56');
    expect(Money.fromMajor('242.554').toMajorString()).toBe('242.55');
    expect(Money.fromMajor('0.005').toMajorString()).toBe('0.01');
  });

  it('adds without float drift (0.10 × 10 === 1.00)', () => {
    let total = Money.zero();
    for (let i = 0; i < 10; i += 1) total = total.add(Money.fromMajor('0.10'));
    expect(total.toMajorString()).toBe('1.00');
    expect(total.toMinor()).toBe(100n);
  });

  it('subtracts and compares', () => {
    const a = Money.fromMajor('100.00');
    const b = Money.fromMajor('30.50');
    expect(a.subtract(b).toMajorString()).toBe('69.50');
    expect(a.compare(b)).toBe(1);
    expect(b.compare(a)).toBe(-1);
    expect(a.compare(a)).toBe(0);
    expect(a.subtract(a).isZero()).toBe(true);
  });

  it('multiplies by integer counts exactly', () => {
    expect(Money.fromMajor('2000.00').multiplyInt(3).toMajorString()).toBe('6000.00');
    expect(() => Money.fromMajor('1.00').multiplyInt(1.5)).toThrow();
  });

  it('computes amount = rate × quantity (gas amount) with rounding', () => {
    // 242.50 /kg × 50 kg = 12125.00
    const amount = Money.fromRateAndQuantity(Money.fromMajor('242.50'), Quantity.fromKg('50'));
    expect(amount.toMajorString()).toBe('12125.00');

    // 300.00 /kg × 12.345 kg = 3703.50
    const amount2 = Money.fromRateAndQuantity(Money.fromMajor('300'), Quantity.fromKg('12.345'));
    expect(amount2.toMajorString()).toBe('3703.50');
  });

  it('derives weighted-average cost = total ÷ quantity', () => {
    // Purchase 1: 1000 kg landed 255000 -> WAC 255.00
    const wac1 = Money.rateFromTotalAndQuantity(Money.fromMajor('255000'), Quantity.fromKg('1000'));
    expect(wac1.toMajorString()).toBe('255.00');

    // After purchase 2 (1000 kg @ 230): value 485000 over 2000 kg -> WAC 242.50
    const wac2 = Money.rateFromTotalAndQuantity(Money.fromMajor('485000'), Quantity.fromKg('2000'));
    expect(wac2.toMajorString()).toBe('242.50');
  });

  it('rejects deriving a rate from zero quantity', () => {
    expect(() => Money.rateFromTotalAndQuantity(Money.fromMajor('100'), Quantity.zero())).toThrow();
  });

  it('serialises to a decimal string in JSON', () => {
    expect(JSON.stringify({ amount: Money.fromMajor('5.5') })).toBe('{"amount":"5.50"}');
  });
});

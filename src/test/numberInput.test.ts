import { describe, expect, it } from 'vitest';
import { parseDecimalInput, parseOptionalDecimalInput } from '@/lib/numberInput';
import { normalizeCreditLimit } from '@/lib/creditLimit';

describe('numberInput', () => {
  it('parses Brazilian decimal values', () => {
    expect(parseDecimalInput('10,50')).toBe(10.5);
    expect(parseDecimalInput('1.234,56')).toBe(1234.56);
    expect(parseDecimalInput('R$ 2.500,90')).toBe(2500.9);
  });

  it('parses dot decimals without changing existing behavior', () => {
    expect(parseDecimalInput('10.50')).toBe(10.5);
    expect(parseDecimalInput('1234.56')).toBe(1234.56);
  });

  it('returns null for optional empty values', () => {
    expect(parseOptionalDecimalInput('')).toBeNull();
    expect(parseOptionalDecimalInput('abc')).toBeNull();
  });

  it('normalizes credit limit typed with comma', () => {
    expect(normalizeCreditLimit('250,75')).toBe(250.75);
  });
});

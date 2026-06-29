import { describe, expect, it } from 'vitest';
import {
  formatClientDebtDueDate,
  getLocalIsoDate,
  isClientDebtOverdue,
  normalizeClientDebtDueDate,
} from '@/lib/clientDebtDueDate';

describe('client debt due date', () => {
  it('normalizes and formats valid local dates', () => {
    expect(normalizeClientDebtDueDate('2026-06-27')).toBe('2026-06-27');
    expect(formatClientDebtDueDate('2026-06-27')).toBe('27/06/2026');
  });

  it('rejects invalid calendar dates', () => {
    expect(normalizeClientDebtDueDate('2026-02-30')).toBeNull();
    expect(normalizeClientDebtDueDate('')).toBeNull();
  });

  it('marks only an open balance with a past due date as overdue', () => {
    expect(isClientDebtOverdue('2026-06-26', 10, '2026-06-27')).toBe(true);
    expect(isClientDebtOverdue('2026-06-27', 10, '2026-06-27')).toBe(false);
    expect(isClientDebtOverdue('2026-06-26', 0, '2026-06-27')).toBe(false);
  });

  it('builds the date from the local calendar', () => {
    expect(getLocalIsoDate(new Date(2026, 5, 7, 23, 59))).toBe('2026-06-07');
  });
});

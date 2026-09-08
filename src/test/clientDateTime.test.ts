import { describe, expect, it } from 'vitest';

import {
  formatClientDateTime,
  toClientDateTimeInputValue,
  toUtcIsoString,
} from '@/lib/clientDateTime';
import { localeStorageKey } from '../../shared/locale/localeTranslations';

describe('clientDateTime', () => {
  it('mantem o horario da caderneta no fuso da loja', () => {
    const value = '2026-04-22T02:51:00.000Z';
    window.localStorage.setItem(localeStorageKey, 'pt-BR');

    expect(formatClientDateTime(value)).toContain('21/04/2026');
    expect(formatClientDateTime(value)).toContain('23:51');
    expect(toClientDateTimeInputValue(value)).toBe('2026-04-21T23:51');
  });

  it('converte a edicao manual do horario da loja para UTC', () => {
    expect(toUtcIsoString('2026-04-21T23:51')).toBe('2026-04-22T02:51:00.000Z');
  });
});

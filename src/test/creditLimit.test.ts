import { describe, expect, it } from 'vitest';

import {
  getAvailableClientCredit,
  getClientCreditLimit,
  getCreditLimitExceededMessage,
  normalizeCreditLimit,
} from '@/lib/creditLimit';

describe('creditLimit', () => {
  it('mantem cliente antigo sem limite quando o campo esta vazio', () => {
    expect(getClientCreditLimit({ credit_limit: null })).toBeNull();
    expect(getAvailableClientCredit({ credit_limit: undefined }, 50)).toBeNull();
  });

  it('normaliza limite e calcula credito disponivel', () => {
    expect(normalizeCreditLimit('120.555')).toBe(120.56);
    expect(getAvailableClientCredit({ credit_limit: 120 }, 45.5)).toBe(74.5);
  });

  it('gera mensagem com valor excedido', () => {
    expect(getCreditLimitExceededMessage('Italo', 100, 80, 30)).toContain('R$ 10.00');
  });
});

import { afterEach, describe, expect, it } from 'vitest';

import {
  getScopedCashSessionStorageKey,
  readScopedCashSession,
  writeScopedCashSession,
} from '@/lib/cashSessionStorage';

describe('cashSessionStorage', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('gera chave isolada por loja e operador', () => {
    expect(getScopedCashSessionStorageKey('owner-1', 'operator-1'))
      .toBe('happycash-pdv-cash-session:owner-1:operator-1');
  });

  it('persiste e recupera sessao apenas para o mesmo escopo', () => {
    writeScopedCashSession('owner-1', 'operator-1', {
      id: 'cash-1',
      openedAt: '2026-04-23T12:00:00.000Z',
      openingAmount: 25,
      openedBy: 'Celio',
      locationId: 'location-1',
      terminalId: 'terminal-1',
    });

    expect(readScopedCashSession('owner-1', 'operator-1')).toEqual({
      id: 'cash-1',
      openedAt: '2026-04-23T12:00:00.000Z',
      openingAmount: 25,
      openedBy: 'Celio',
      ownerUserId: 'owner-1',
      operatorUserId: 'operator-1',
      locationId: 'location-1',
      terminalId: 'terminal-1',
    });
    expect(readScopedCashSession('owner-1', 'operator-2')).toBeNull();
    expect(readScopedCashSession('owner-2', 'operator-1')).toBeNull();
  });

  it('remove a sessao quando recebe null', () => {
    writeScopedCashSession('owner-1', 'operator-1', {
      id: 'cash-1',
      openedAt: '2026-04-23T12:00:00.000Z',
      openingAmount: 25,
      openedBy: 'Celio',
    });

    writeScopedCashSession('owner-1', 'operator-1', null);

    expect(readScopedCashSession('owner-1', 'operator-1')).toBeNull();
  });
});

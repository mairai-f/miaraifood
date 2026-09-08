import { describe, expect, it } from 'vitest';
import {
  getOperationalScopeCacheKey,
  isValidStoreScopeCode,
  normalizeStoreScopeCode,
  readOperationalScopeCache,
  writeOperationalScopeCache,
  type OperationalScope,
} from '@/lib/storeScope';

describe('store scope codes', () => {
  it('normalizes branch names for integrations', () => {
    expect(normalizeStoreScopeCode('Filial São José / Centro')).toBe('FILIAL-SAO-JOSE-CENTRO');
  });

  it('keeps supported separators', () => {
    expect(normalizeStoreScopeCode('SP_01-caixa')).toBe('SP_01-CAIXA');
  });

  it('validates only normalized non-empty codes', () => {
    expect(isValidStoreScopeCode('MATRIZ')).toBe(true);
    expect(isValidStoreScopeCode('FILIAL_02')).toBe(true);
    expect(isValidStoreScopeCode('filial 2')).toBe(false);
    expect(isValidStoreScopeCode('')).toBe(false);
  });

  it('isolates the selected scope by company, user and runtime', () => {
    const scope: OperationalScope = {
      location: { id: 'loc-1', code: 'MATRIZ', name: 'Matriz', locationType: 'headquarters', isHeadquarters: true },
      terminal: { id: 'term-1', locationId: 'loc-1', code: 'WEB', name: 'Web', terminalType: 'web' },
    };
    window.localStorage.clear();
    writeOperationalScopeCache('owner-1', 'user-1', 'web', scope);

    expect(readOperationalScopeCache('owner-1', 'user-1', 'web')).toEqual(scope);
    expect(readOperationalScopeCache('owner-1', 'user-1', 'desktop')).toBeNull();
    expect(getOperationalScopeCacheKey('owner-1', 'user-1', 'web')).toContain('owner-1:user-1:web');
  });
});

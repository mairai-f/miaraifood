import { describe, expect, it } from 'vitest';

import { shouldUseOfflineSnapshotFallback } from '@/lib/offlineSnapshotPolicy';

describe('shouldUseOfflineSnapshotFallback', () => {
  it('usa snapshot offline quando todos os erros sao de rede', () => {
    expect(shouldUseOfflineSnapshotFallback([
      new Error('Failed to fetch'),
      new Error('NetworkError when attempting to fetch resource.'),
    ])).toBe(true);
  });

  it('bloqueia snapshot offline quando existe erro funcional misturado', () => {
    expect(shouldUseOfflineSnapshotFallback([
      new Error('Failed to fetch'),
      new Error('new row violates row-level security policy'),
    ])).toBe(false);
  });

  it('retorna false quando nao ha erro relevante', () => {
    expect(shouldUseOfflineSnapshotFallback([])).toBe(false);
    expect(shouldUseOfflineSnapshotFallback([null, undefined])).toBe(false);
  });
});

import {
  buildStoreDataScopeKey,
  readStoreDataModuleCache,
  writeStoreDataModuleCache,
} from '@/lib/storeDataCache';

describe('storeDataCache', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns cached data only for the same company, user, scope and signature', () => {
    const scopeKey = buildStoreDataScopeKey('location-1');

    writeStoreDataModuleCache({
      ownerUserId: 'owner-1',
      userId: 'user-1',
      scopeKey,
      module: 'products',
      signature: 'sig-1',
      data: { products: [{ id: 'product-1', name: 'Cafe' }] },
    });

    expect(readStoreDataModuleCache({
      ownerUserId: 'owner-1',
      userId: 'user-1',
      scopeKey,
      module: 'products',
      signature: 'sig-1',
    })).toEqual({ products: [{ id: 'product-1', name: 'Cafe' }] });

    expect(readStoreDataModuleCache({
      ownerUserId: 'owner-2',
      userId: 'user-1',
      scopeKey,
      module: 'products',
      signature: 'sig-1',
    })).toBeNull();

    expect(readStoreDataModuleCache({
      ownerUserId: 'owner-1',
      userId: 'user-1',
      scopeKey,
      module: 'products',
      signature: 'sig-2',
    })).toBeNull();
  });
});

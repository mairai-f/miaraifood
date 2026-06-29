import { describe, expect, it } from 'vitest';
import {
  getDefaultPermissionsForRole,
  isErpPermissionKey,
  isRuntimeScopeAllowed,
} from '@/lib/permissions';

describe('ERP permissions', () => {
  it('keeps the current operational access for operators', () => {
    const permissions = getDefaultPermissionsForRole('operator');

    expect(permissions.has('pdv.use')).toBe(true);
    expect(permissions.has('pdv.open_cash')).toBe(true);
    expect(permissions.has('pdv.sell_without_stock')).toBe(true);
    expect(permissions.has('products.manage')).toBe(false);
    expect(permissions.has('financial.manage')).toBe(false);
  });

  it('limits the waiter fallback to service tickets', () => {
    const permissions = getDefaultPermissionsForRole('waiter');

    expect([...permissions]).toEqual(['service_tickets.use']);
  });

  it('gives administrators every catalogued permission', () => {
    const permissions = getDefaultPermissionsForRole('admin');

    expect(permissions.has('rbac.manage')).toBe(true);
    expect(permissions.has('multi_store.manage')).toBe(true);
  });

  it('separates Web-only code from the Desktop runtime', () => {
    expect(isRuntimeScopeAllowed('web', false)).toBe(true);
    expect(isRuntimeScopeAllowed('web', true)).toBe(false);
    expect(isRuntimeScopeAllowed('desktop', true)).toBe(true);
    expect(isRuntimeScopeAllowed('both', true)).toBe(true);
  });

  it('rejects unknown permission keys from offline cache', () => {
    expect(isErpPermissionKey('pdv.use')).toBe(true);
    expect(isErpPermissionKey('permission.injected')).toBe(false);
  });
});

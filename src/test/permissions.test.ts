import { describe, expect, it } from 'vitest';
import {
  getDefaultPermissionsForRole,
  isErpPermissionKey,
  isRuntimeScopeAllowed,
  togglePermissionWithDependencies,
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

  it('aplica dependencias ao escolher acessos manualmente', () => {
    const enabled = togglePermissionWithDependencies(new Set(), 'products.manage', true);
    expect(enabled).toEqual(new Set(['products.manage', 'products.view']));
    const disabled = togglePermissionWithDependencies(enabled, 'products.view', false);
    expect(disabled.size).toBe(0);
  });

  it('keeps the waiter fallback inside the dining room', () => {
    const permissions = getDefaultPermissionsForRole('waiter');

    // O garcom atende mesa, comanda e chamado, e conversa com a equipe.
    expect(permissions.has('service_tickets.use')).toBe(true);
    expect(permissions.has('food.tables.view')).toBe(true);
    expect(permissions.has('food.orders.create')).toBe(true);
    expect(permissions.has('food.waiter_calls.handle')).toBe(true);
    expect(permissions.has('chat.view')).toBe(true);

    // Nada de caixa, cadastro, estoque, financeiro ou administracao.
    expect(permissions.has('pdv.use')).toBe(false);
    expect(permissions.has('products.manage')).toBe(false);
    expect(permissions.has('stock.manage')).toBe(false);
    expect(permissions.has('financial.manage')).toBe(false);
    expect(permissions.has('clients.manage')).toBe(false);
    expect(permissions.has('rbac.manage')).toBe(false);
    expect(permissions.has('multi_store.manage')).toBe(false);
  });

  it('keeps the HR fallback isolated from commercial modules', () => {
    const permissions = getDefaultPermissionsForRole('hr');

    expect([...permissions]).toEqual(['hr.view']);
    expect(permissions.has('pdv.use')).toBe(false);
    expect(permissions.has('clients.view')).toBe(false);
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

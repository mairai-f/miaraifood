import type { UserRole } from '@/lib/access';

/** Onde um modulo pode ser executado sem aumentar desnecessariamente o Desktop. */
export type RuntimeScope = 'web' | 'desktop' | 'both';

/**
 * Chaves conhecidas pelo frontend. O banco continua sendo a fonte de verdade,
 * mas esta lista permite validacao de tipo e um fallback seguro no modo offline.
 */
export const ERP_PERMISSION_KEYS = [
  'dashboard.view',
  'pdv.use',
  'pdv.open_cash',
  'pdv.close_cash',
  'pdv.cash_out',
  'pdv.cancel_sale',
  'pdv.edit_price',
  'pdv.sell_without_stock',
  'pdv.view_other_cashiers',
  'pdv.change_seller',
  'service_tickets.use',
  'service_tickets.transfer',
  'service_tickets.cancel',
  'clients.view',
  'clients.manage',
  'products.view',
  'products.manage',
  'stock.view',
  'stock.manage',
  'purchases.view',
  'purchases.manage',
  'reports.view',
  'financial.view',
  'financial.manage',
  'pricing.view',
  'pricing.manage',
  'fiscal.view',
  'fiscal.manage',
  'rewards.manage',
  'deleted.view',
  'settings.manage',
  'staff.manage',
  'rbac.manage',
  'access_monitor.view',
  'audit.view',
  'delivery.use',
  'conciliation.manage',
  'multi_store.manage',
  'time_clock.manage',
  'self_service.manage',
] as const;

export type ErpPermissionKey = (typeof ERP_PERMISSION_KEYS)[number];

const operatorDefaults = new Set<ErpPermissionKey>([
  'dashboard.view',
  'pdv.use',
  'pdv.open_cash',
  'pdv.close_cash',
  'pdv.cash_out',
  'pdv.cancel_sale',
  'pdv.sell_without_stock',
  'service_tickets.use',
  'service_tickets.transfer',
  'clients.view',
  'clients.manage',
  'products.view',
]);

const waiterDefaults = new Set<ErpPermissionKey>(['service_tickets.use']);

/** Mantem o comportamento anterior quando o Desktop estiver realmente offline. */
export const getDefaultPermissionsForRole = (role: UserRole): Set<ErpPermissionKey> => {
  if (role === 'admin') return new Set(ERP_PERMISSION_KEYS);
  return new Set(role === 'waiter' ? waiterDefaults : operatorDefaults);
};

/** Impede que rotas Web administrativas sejam abertas ou pre-carregadas no Electron. */
export const isRuntimeScopeAllowed = (scope: RuntimeScope, isDesktop: boolean) =>
  scope === 'both' || scope === (isDesktop ? 'desktop' : 'web');

export const isErpPermissionKey = (value: string): value is ErpPermissionKey =>
  (ERP_PERMISSION_KEYS as readonly string[]).includes(value);

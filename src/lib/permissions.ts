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
  'audit.view',
  'hr.view',
  'hr.employees.manage',
  'hr.documents.manage',
  'hr.time_clock.manage',
  'hr.schedules.manage',
  'hr.leave.manage',
  'hr.payroll.manage',
  'hr.exports.manage',
  'hr.audit.view',
  'hr.settings.manage',
  'hr.access.manage',
  'employee_portal.view',
  'employee_portal.profile.update',
  'employee_portal.time_clock',
  'employee_portal.leave',
  'employee_portal.documents',
  'employee_portal.payroll',
  'employee_portal.announcements',
  'delivery.use',
  'conciliation.manage',
  'multi_store.manage',
  'time_clock.manage',
  'self_service.manage',
  'food.tables.view',
  'food.tables.manage',
  'food.orders.manage',
  'food.orders.create',
  'food.orders.edit',
  'food.orders.cancel',
  'food.tables.close',
  'food.payments.manage',
  'food.qr.manage',
  'food.qrmenu.manage',
  'food.waiter_calls.handle',
  'food.kds.use',
  'food.kds.manage',
  'food.delivery.manage',
] as const;

export type ErpPermissionKey = (typeof ERP_PERMISSION_KEYS)[number];

export const OPERATIONAL_MANAGER_PERMISSION_KEYS = [
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
  'rewards.manage',
  'deleted.view',
  'staff.manage',
  'delivery.use',
  'conciliation.manage',
  'multi_store.manage',
  'time_clock.manage',
  'self_service.manage',
  'food.tables.view',
  'food.tables.manage',
  'food.orders.manage',
  'food.orders.create',
  'food.orders.edit',
  'food.orders.cancel',
  'food.tables.close',
  'food.payments.manage',
  'food.qr.manage',
  'food.qrmenu.manage',
  'food.waiter_calls.handle',
  'food.kds.use',
  'food.kds.manage',
  'food.delivery.manage',
] as const satisfies readonly ErpPermissionKey[];

export const SENSITIVE_ADMIN_PERMISSION_KEYS = [
  'settings.manage',
  'rbac.manage',
  'fiscal.manage',
  'audit.view',
] as const satisfies readonly ErpPermissionKey[];

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
const hrDefaults = new Set<ErpPermissionKey>(['hr.view']);

/** Mantem o comportamento anterior quando o Desktop estiver realmente offline. */
export const getDefaultPermissionsForRole = (role: UserRole): Set<ErpPermissionKey> => {
  if (role === 'admin') return new Set(ERP_PERMISSION_KEYS);
  if (role === 'hr') return new Set(hrDefaults);
  return new Set(role === 'waiter' ? waiterDefaults : operatorDefaults);
};

/** Impede que rotas Web administrativas sejam abertas ou pre-carregadas no Electron. */
export const isRuntimeScopeAllowed = (scope: RuntimeScope, isDesktop: boolean) =>
  scope === 'both' || scope === (isDesktop ? 'desktop' : 'web');

export const isErpPermissionKey = (value: string): value is ErpPermissionKey =>
  (ERP_PERMISSION_KEYS as readonly string[]).includes(value);

const permissionDependencies: Partial<Record<ErpPermissionKey, ErpPermissionKey[]>> = {
  'pdv.open_cash': ['pdv.use'], 'pdv.close_cash': ['pdv.use'], 'pdv.cash_out': ['pdv.use'],
  'pdv.cancel_sale': ['pdv.use'], 'pdv.edit_price': ['pdv.use'], 'pdv.view_other_cashiers': ['pdv.use'],
  'pdv.change_seller': ['pdv.use'], 'service_tickets.transfer': ['service_tickets.use'],
  'service_tickets.cancel': ['service_tickets.use'], 'clients.manage': ['clients.view'],
  'products.manage': ['products.view'], 'stock.manage': ['stock.view'], 'purchases.manage': ['purchases.view'],
  'financial.manage': ['financial.view'], 'pricing.manage': ['pricing.view'], 'fiscal.manage': ['fiscal.view'],
  'hr.access.manage': ['hr.view'], 'hr.employees.manage': ['hr.view'], 'hr.documents.manage': ['hr.view'],
  'hr.time_clock.manage': ['hr.view'], 'hr.schedules.manage': ['hr.view'], 'hr.leave.manage': ['hr.view'],
  'hr.payroll.manage': ['hr.view'], 'hr.exports.manage': ['hr.view'], 'hr.audit.view': ['hr.view'], 'hr.settings.manage': ['hr.view'],
  'employee_portal.profile.update': ['employee_portal.view'], 'employee_portal.time_clock': ['employee_portal.view'],
  'employee_portal.leave': ['employee_portal.view'], 'employee_portal.documents': ['employee_portal.view'],
  'employee_portal.payroll': ['employee_portal.view'], 'employee_portal.announcements': ['employee_portal.view'],
  'food.tables.manage': ['food.tables.view'], 'food.orders.create': ['food.tables.view'],
  'food.orders.edit': ['food.orders.create'], 'food.orders.cancel': ['food.orders.create'],
  'food.tables.close': ['food.tables.view'], 'food.payments.manage': ['food.tables.close'],
  'food.qr.manage': ['food.tables.manage'], 'food.qrmenu.manage': ['food.tables.view'],
  'food.waiter_calls.handle': ['food.tables.view'], 'food.kds.manage': ['food.kds.use'],
};

/** Aplica dependencias sem criar um perfil-base: cada escolha continua explicita. */
export const togglePermissionWithDependencies = (
  current: ReadonlySet<ErpPermissionKey>,
  permissionKey: ErpPermissionKey,
  checked: boolean,
) => {
  const next = new Set(current);
  const enable = (key: ErpPermissionKey) => {
    next.add(key);
    permissionDependencies[key]?.forEach(enable);
  };
  const disable = (key: ErpPermissionKey) => {
    next.delete(key);
    (Object.entries(permissionDependencies) as Array<[ErpPermissionKey, ErpPermissionKey[]]>).forEach(([dependent, dependencies]) => {
      if (dependencies.includes(key)) disable(dependent);
    });
  };
  if (checked) enable(permissionKey); else disable(permissionKey);
  return next;
};

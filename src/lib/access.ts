export type UserRole = 'admin' | 'operator' | 'waiter';

export const roleLabel: Record<UserRole, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  waiter: 'Garcom',
};

const operatorAllowedPaths = new Set([
  '/',
  '/pdv',
  '/comandas',
  '/clientes',
  '/produtos',
]);

const waiterAllowedPaths = new Set([
  '/comandas',
]);

export const normalizeUserRole = (value: string | null | undefined): UserRole => {
  if (value === 'operator' || value === 'waiter') return value;
  return 'admin';
};

export const canAccessPath = (role: UserRole, path: string) => {
  if (role === 'admin') return true;
  if (role === 'operator' && operatorAllowedPaths.has(path)) return true;
  if (role === 'waiter' && waiterAllowedPaths.has(path)) return true;
  return role === 'operator' && path.startsWith('/cliente/');
};

export const canManageProducts = (role: UserRole) => role === 'admin';
export const canAccessAdminArea = (role: UserRole) => role === 'admin';

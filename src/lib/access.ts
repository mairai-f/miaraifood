export type UserRole = 'admin' | 'operator';

export const roleLabel: Record<UserRole, string> = {
  admin: 'Administrador',
  operator: 'Operador',
};

const operatorAllowedPaths = new Set([
  '/',
  '/pdv',
  '/clientes',
  '/produtos',
]);

export const canAccessPath = (role: UserRole, path: string) => {
  if (role === 'admin') return true;
  if (operatorAllowedPaths.has(path)) return true;
  return path.startsWith('/cliente/');
};

export const canManageProducts = (role: UserRole) => role === 'admin';
export const canAccessAdminArea = (role: UserRole) => role === 'admin';

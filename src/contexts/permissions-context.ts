import { createContext } from 'react';
import type { ErpPermissionKey } from '@/lib/permissions';

export interface PermissionsContextValue {
  loading: boolean;
  permissions: ReadonlySet<ErpPermissionKey>;
  hasPermission: (permission: ErpPermissionKey) => boolean;
  refreshPermissions: () => Promise<void>;
}

export const PermissionsContext = createContext<PermissionsContextValue | null>(null);

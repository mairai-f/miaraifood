import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionsContext, type PermissionsContextValue } from '@/contexts/permissions-context';
import { supabase } from '@/integrations/supabase/client';
import {
  getDefaultPermissionsForRole,
  isErpPermissionKey,
  type ErpPermissionKey,
} from '@/lib/permissions';
import { getRedactedLogValue } from '../../shared/security/redaction';

interface PermissionRpcRow {
  permission_key: string;
  allowed: boolean;
}

const permissionCacheKey = (ownerUserId: string, userId: string) =>
  `happycash:erp-permissions:${ownerUserId}:${userId}`;

const readPermissionCache = (ownerUserId: string, userId: string) => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(permissionCacheKey(ownerUserId, userId));
    if (!rawValue) return null;
    const values = JSON.parse(rawValue) as string[];
    return new Set(values.filter(isErpPermissionKey));
  } catch {
    return null;
  }
};

const writePermissionCache = (
  ownerUserId: string,
  userId: string,
  permissions: ReadonlySet<ErpPermissionKey>,
) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      permissionCacheKey(ownerUserId, userId),
      JSON.stringify(Array.from(permissions)),
    );
  } catch {
    // Permissoes continuam em memoria quando o armazenamento local estiver indisponivel.
  }
};

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, ownerUserId, role, isLocalOfflineSession } = useAuth();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Set<ErpPermissionKey>>(
    () => getDefaultPermissionsForRole(role),
  );

  const refreshPermissions = useCallback(async () => {
    if (!user?.id || !ownerUserId) {
      setPermissions(getDefaultPermissionsForRole(role));
      setLoading(false);
      return;
    }

    const cachedPermissions = readPermissionCache(ownerUserId, user.id);
    const fallbackPermissions = cachedPermissions ?? getDefaultPermissionsForRole(role);
    setPermissions(fallbackPermissions);

    if (role === 'admin') {
      setPermissions(getDefaultPermissionsForRole(role));
      setLoading(false);
      return;
    }

    if (isLocalOfflineSession) {
      setPermissions(fallbackPermissions);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Os tipos gerados do Supabase serao atualizados depois que a migracao for aplicada.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_my_erp_permissions');
      if (error) throw error;

      const allowedPermissions = new Set<ErpPermissionKey>();
      for (const row of (data ?? []) as PermissionRpcRow[]) {
        if (row.allowed && isErpPermissionKey(row.permission_key)) {
          allowedPermissions.add(row.permission_key);
        }
      }

      setPermissions(allowedPermissions);
      writePermissionCache(ownerUserId, user.id, allowedPermissions);
    } catch (error) {
      // Falha de rede nao deve derrubar o PDV: usa o ultimo conjunto validado.
      console.error('Nao foi possivel atualizar as permissoes do ERP:', getRedactedLogValue(error));
      setPermissions(fallbackPermissions);
    } finally {
      setLoading(false);
    }
  }, [isLocalOfflineSession, ownerUserId, role, user?.id]);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  const value = useMemo<PermissionsContextValue>(() => ({
    loading,
    permissions,
    hasPermission: (permission) => role === 'admin' || permissions.has(permission),
    refreshPermissions,
  }), [loading, permissions, refreshPermissions, role]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

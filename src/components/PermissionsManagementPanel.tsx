import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getRedactedLogValue } from '../../shared/security/redaction';

interface StaffProfile {
  user_id: string;
  username: string;
  role: 'operator' | 'waiter';
}
interface StaffPermissionRow {
  permission_key: string;
  module_key: string;
  name: string;
  description: string;
  runtime_scope: 'web' | 'desktop' | 'both';
  effective_allowed: boolean;
  override_allowed: boolean | null;
}

const moduleLabels: Record<string, string> = {
  dashboard: 'Painel',
  pdv: 'PDV e caixa',
  service_tickets: 'Comandas',
  clients: 'Clientes',
  products: 'Produtos',
  stock: 'Estoque',
  purchases: 'Compras e fornecedores',
  reports: 'Relatorios',
  financial: 'Financeiro',
  pricing: 'Precificacao',
  fiscal: 'Fiscal',
  rewards: 'Recompensas',
  deleted: 'Registros excluidos',
  settings: 'Configuracoes',
  staff: 'Colaboradores e permissoes',
  security: 'Seguranca e auditoria',
};

const manageableModules = new Set(Object.keys(moduleLabels));
const runtimeLabels = { web: 'Web', desktop: 'Desktop', both: 'Web + Desktop' } as const;

/**
 * Matriz Web de permissoes individuais. O componente e carregado com React.lazy
 * em Configuracoes, portanto seu codigo nao entra no fluxo operacional do Desktop.
 */
export function PermissionsManagementPanel() {
  const { isAdmin, ownerUserId } = useAuth();
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [permissions, setPermissions] = useState<StaffPermissionRow[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissionKey, setSavingPermissionKey] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    if (!isAdmin || !ownerUserId) {
      setStaff([]);
      setLoadingStaff(false);
      return;
    }

    setLoadingStaff(true);
    // O cast temporario pode ser removido depois de regenerar src/integrations/supabase/types.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('user_id, username, role')
      .eq('owner_user_id', ownerUserId)
      .in('role', ['operator', 'waiter'])
      .order('username');

    if (error) {
      console.error('Erro ao carregar colaboradores para o RBAC:', getRedactedLogValue(error));
      toast.error('Nao foi possivel carregar os colaboradores.');
      setStaff([]);
    } else {
      const nextStaff = (data ?? []) as StaffProfile[];
      setStaff(nextStaff);
      setSelectedUserId((current) => current || nextStaff[0]?.user_id || '');
    }
    setLoadingStaff(false);
  }, [isAdmin, ownerUserId]);

  const loadPermissions = useCallback(async (userId: string) => {
    if (!userId) {
      setPermissions([]);
      return;
    }

    setLoadingPermissions(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_staff_erp_permissions', {
        target_user_id: userId,
      });
      if (error) throw error;
      setPermissions(
        ((data ?? []) as StaffPermissionRow[]).filter((permission) =>
          manageableModules.has(permission.module_key),
        ),
      );
    } catch (error) {
      console.error('Erro ao carregar matriz RBAC:', getRedactedLogValue(error));
      toast.error('Nao foi possivel carregar as permissoes. Aplique a nova migracao do banco.');
      setPermissions([]);
    } finally {
      setLoadingPermissions(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    void loadPermissions(selectedUserId);
  }, [loadPermissions, selectedUserId]);

  const permissionsByModule = useMemo(() => {
    const grouped = new Map<string, StaffPermissionRow[]>();
    for (const permission of permissions) {
      const current = grouped.get(permission.module_key) ?? [];
      current.push(permission);
      grouped.set(permission.module_key, current);
    }
    return Array.from(grouped.entries());
  }, [permissions]);

  const setPermissionOverride = async (permissionKey: string, allowed: boolean | null) => {
    if (!selectedUserId) return;
    setSavingPermissionKey(permissionKey);

    try {
      // null remove a excecao e faz o colaborador voltar a herdar o grupo padrao.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('set_staff_erp_permission_override', {
        target_user_id: selectedUserId,
        target_permission_key: permissionKey,
        target_allowed: allowed,
      });
      if (error) throw error;
      await loadPermissions(selectedUserId);
      toast.success(allowed === null ? 'Permissao restaurada para o padrao do grupo.' : 'Permissao atualizada.');
    } catch (error) {
      console.error('Erro ao salvar permissao:', getRedactedLogValue(error));
      toast.error('Nao foi possivel salvar a permissao.');
    } finally {
      setSavingPermissionKey(null);
    }
  };

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Permissoes por colaborador
          </CardTitle>
          <Badge variant="outline">Somente Web</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          O grupo define o acesso inicial. Uma alteracao nesta tela cria uma excecao individual que prevalece sobre o grupo.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="max-w-md space-y-2">
          <Label htmlFor="rbac-staff-select">Colaborador</Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={loadingStaff || staff.length === 0}>
            <SelectTrigger id="rbac-staff-select">
              <SelectValue placeholder={loadingStaff ? 'Carregando...' : 'Selecione um colaborador'} />
            </SelectTrigger>
            <SelectContent>
              {staff.map((profile) => (
                <SelectItem key={profile.user_id} value={profile.user_id}>
                  {profile.username} · {profile.role === 'waiter' ? 'Garcom' : 'Operador'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!loadingStaff && staff.length === 0 && (
          <p className="rounded-md border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            Cadastre um operador ou garcom para configurar permissoes.
          </p>
        )}

        {loadingPermissions ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando permissoes...
          </div>
        ) : (
          <div className="space-y-5">
            {permissionsByModule.map(([moduleKey, modulePermissions]) => (
              <section key={moduleKey} aria-labelledby={`rbac-module-${moduleKey}`} className="space-y-2">
                <h3 id={`rbac-module-${moduleKey}`} className="text-sm font-semibold text-foreground">
                  {moduleLabels[moduleKey] ?? moduleKey}
                </h3>
                <div className="divide-y rounded-lg border border-border/70">
                  {modulePermissions.map((permission) => {
                    const saving = savingPermissionKey === permission.permission_key;
                    return (
                      <div key={permission.permission_key} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{permission.name}</p>
                            <Badge variant="secondary">{runtimeLabels[permission.runtime_scope]}</Badge>
                            {permission.override_allowed !== null && <Badge>Personalizado</Badge>}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{permission.description}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {permission.override_allowed !== null && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              title="Restaurar permissao herdada do grupo"
                              aria-label={`Restaurar ${permission.name}`}
                              disabled={saving}
                              onClick={() => void setPermissionOverride(permission.permission_key, null)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Switch
                            checked={permission.effective_allowed}
                            disabled={saving}
                            aria-label={permission.name}
                            onCheckedChange={(checked) => void setPermissionOverride(permission.permission_key, checked)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

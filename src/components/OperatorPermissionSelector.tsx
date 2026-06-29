import { useMemo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { ErpPermissionKey } from '@/lib/permissions';

export interface OperatorPermissionOption {
  permission_key: ErpPermissionKey;
  module_key: string;
  name: string;
  description: string;
}

interface OperatorPermissionSelectorProps {
  permissions: OperatorPermissionOption[];
  selected: ReadonlySet<ErpPermissionKey>;
  loading: boolean;
  onToggle: (permissionKey: ErpPermissionKey, checked: boolean) => void;
  onToggleModule: (permissionKeys: ErpPermissionKey[], checked: boolean) => void;
}

const moduleLabels: Record<string, string> = {
  dashboard: 'Painel', pdv: 'PDV e caixa', service_tickets: 'Comandas', clients: 'Clientes',
  products: 'Produtos', stock: 'Estoque', purchases: 'Compras e fornecedores', reports: 'Relatórios',
  financial: 'Financeiro', pricing: 'Precificação', fiscal: 'Fiscal', rewards: 'Recompensas',
  deleted: 'Registros excluídos', settings: 'Configurações', staff: 'Colaboradores',
  security: 'Segurança e auditoria', delivery: 'Delivery', conciliation: 'Conciliação',
  multi_store: 'Filiais', time_clock: 'Relógio de ponto', self_service: 'Autoatendimento',
};

export function OperatorPermissionSelector({
  permissions,
  selected,
  loading,
  onToggle,
  onToggleModule,
}: OperatorPermissionSelectorProps) {
  const grouped = useMemo(() => {
    const modules = new Map<string, OperatorPermissionOption[]>();
    permissions.forEach((permission) => {
      const current = modules.get(permission.module_key) ?? [];
      current.push(permission);
      modules.set(permission.module_key, current);
    });
    return [...modules.entries()];
  }, [permissions]);

  if (loading) return <p className="py-8 text-center text-sm text-muted-foreground">Carregando acessos...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-primary/5 p-3 text-sm">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span>O mesmo acesso vale para Web, Desktop e Mobile.</span>
        <Badge variant="outline">{selected.size} selecionados</Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {grouped.map(([moduleKey, modulePermissions]) => {
          const keys = modulePermissions.map((permission) => permission.permission_key);
          const selectedCount = keys.filter((key) => selected.has(key)).length;
          const allSelected = selectedCount === keys.length;
          const sectionChecked = allSelected ? true : selectedCount > 0 ? 'indeterminate' : false;
          return (
            <section key={moduleKey} className="rounded-lg border" aria-labelledby={`operator-module-${moduleKey}`}>
              <div className="flex items-center justify-between gap-3 border-b bg-muted/30 p-3">
                <h3 id={`operator-module-${moduleKey}`} className="text-sm font-semibold">{moduleLabels[moduleKey] ?? moduleKey}</h3>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={sectionChecked} onCheckedChange={(checked) => onToggleModule(keys, checked === true)} />
                  Todos
                </label>
              </div>
              <div className="divide-y">
                {modulePermissions.map((permission) => (
                  <label key={permission.permission_key} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/20">
                    <Checkbox
                      className="mt-0.5"
                      checked={selected.has(permission.permission_key)}
                      onCheckedChange={(checked) => onToggle(permission.permission_key, checked === true)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{permission.name}</span>
                      <span className="block text-xs text-muted-foreground">{permission.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

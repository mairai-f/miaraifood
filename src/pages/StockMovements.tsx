import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { StockInsightsPageLayout } from '@/components/stock/StockInsightsPageLayout';
import { DataRouteLoader } from '@/components/DataRouteLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime } from '../../shared/locale/format';
import { getRedactedLogValue } from '../../shared/security/redaction';
import { filterProductsBySearch, toProductUppercase } from '@/lib/productSearch';
import { formatProductCode } from '@/lib/productCode';
import { getStockMovementDirection } from '@/lib/stockMovement';
import { supabase } from '@/integrations/supabase/client';

interface ProfilesQueryClient {
  from(table: 'profiles'): {
    select(columns: string): {
      eq(column: string, value: string): {
        in(column: string, values: string[]): Promise<{
          data: MovementActorProfile[] | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
}

const db = supabase as unknown as ProfilesQueryClient;

type MovementActorProfile = {
  user_id: string;
  username?: string | null;
  email?: string | null;
};

export default function StockMovements() {
  const { products, stockMovements, loading } = useData();
  const { ownerUserId } = useAuth();
  const [movementHistorySearch, setMovementHistorySearch] = useState('');
  const [movementHistoryType, setMovementHistoryType] = useState('all');
  const [movementDateFrom, setMovementDateFrom] = useState('');
  const [movementDateTo, setMovementDateTo] = useState('');
  const [movementActorNames, setMovementActorNames] = useState<Record<string, string>>({});

  const filteredMovements = useMemo(() => stockMovements.filter((movement) => {
    const product = products.find((item) => item.id === movement.product_id);
    const matchesProduct = !movementHistorySearch.trim()
      || filterProductsBySearch(product ? [product] : [], movementHistorySearch).length > 0;
    const direction = getStockMovementDirection(movement);
    const movementDate = movement.date.slice(0, 10);
    const matchesDate = (!movementDateFrom || movementDate >= movementDateFrom) && (!movementDateTo || movementDate <= movementDateTo);
    return matchesProduct && matchesDate && (movementHistoryType === 'all' || movementHistoryType === direction || movementHistoryType === movement.type);
  }), [movementDateFrom, movementDateTo, movementHistorySearch, movementHistoryType, products, stockMovements]);

  const unresolvedMovementOperatorIds = useMemo(() => (
    [...new Set(
      stockMovements
        .filter((movement) => !movement.actor_label && movement.operator_user_id && !movementActorNames[movement.operator_user_id])
        .map((movement) => movement.operator_user_id as string)
    )]
  ), [movementActorNames, stockMovements]);

  useEffect(() => {
    if (!ownerUserId || unresolvedMovementOperatorIds.length === 0) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    let cancelled = false;

    const loadMovementActors = async () => {
      const { data, error } = await db
        .from('profiles')
        .select('user_id, username, email')
        .eq('owner_user_id', ownerUserId)
        .in('user_id', unresolvedMovementOperatorIds);

      if (error) {
        console.warn('Nao foi possivel resolver os usuarios das movimentacoes de estoque:', getRedactedLogValue(error));
        return;
      }

      if (cancelled) return;

      const nextNames = ((data ?? []) as MovementActorProfile[]).reduce<Record<string, string>>((map, profile) => {
        const label = profile.username?.trim() || profile.email?.trim() || profile.user_id;
        map[profile.user_id] = label;
        return map;
      }, {});

      if (Object.keys(nextNames).length === 0) return;

      setMovementActorNames((current) => ({ ...current, ...nextNames }));
    };

    void loadMovementActors();

    return () => {
      cancelled = true;
    };
  }, [ownerUserId, unresolvedMovementOperatorIds]);

  const getMovementActorLabel = (movement: (typeof stockMovements)[number]) => (
    movement.actor_label
    || (movement.operator_user_id ? movementActorNames[movement.operator_user_id] : null)
    || movement.operator_user_id
    || 'Sistema'
  );

  const movementSummary = useMemo(() => filteredMovements.reduce((summary, movement) => {
    const direction = getStockMovementDirection(movement);
    if (direction === 'entrada') summary.entries += 1;
    if (direction === 'saida') summary.exits += 1;
    if (direction === 'ajuste') summary.adjustments += 1;
    return summary;
  }, {
    entries: 0,
    exits: 0,
    adjustments: 0,
  }), [filteredMovements]);

  const exportMovements = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [[
      'Data',
      'Codigo',
      'Produto',
      'Tipo',
      'Quantidade',
      'Origem',
      'Usuario',
      'Saldo anterior',
      'Saldo posterior',
      'Motivo',
    ].map(escapeCsv).join(';')];

    filteredMovements.forEach((movement) => {
      const product = products.find((item) => item.id === movement.product_id);
      lines.push([
        formatDateTime(movement.date),
        formatProductCode(product?.code),
        product?.name ?? 'Produto removido',
        getStockMovementDirection(movement),
        movement.quantity,
        movement.source ?? 'manual',
        getMovementActorLabel(movement),
        movement.balance_before ?? '',
        movement.balance_after ?? '',
        movement.reason,
      ].map(escapeCsv).join(';'));
    });

    const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `movimentacoes-estoque-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <DataRouteLoader label="Carregando movimentações de estoque..." />;
  }

  return (
    <StockInsightsPageLayout
      title="Movimentações de estoque"
      description="Histórico detalhado de entradas, saídas e ajustes para auditoria rápida."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Registros filtrados</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{filteredMovements.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Entradas / Saídas</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{movementSummary.entries} / {movementSummary.exits}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ajustes</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{movementSummary.adjustments}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Histórico recente</CardTitle>
          <Button size="sm" variant="outline" onClick={exportMovements} disabled={filteredMovements.length === 0}>
            <Download className="mr-1 h-4 w-4" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_170px_150px_150px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Filtrar por produto"
                value={movementHistorySearch}
                onChange={(event) => setMovementHistorySearch(toProductUppercase(event.target.value))}
              />
            </div>
            <Select value={movementHistoryType} onValueChange={setMovementHistoryType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
                <SelectItem value="ajuste">Ajustes</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={movementDateFrom} onChange={(event) => setMovementDateFrom(event.target.value)} aria-label="Movimentações a partir de" />
            <Input type="date" value={movementDateTo} onChange={(event) => setMovementDateTo(event.target.value)} aria-label="Movimentações até" />
          </div>

          {filteredMovements.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma movimentação encontrada.</p>
          ) : (
            <div className="space-y-2">
              {filteredMovements.slice(0, 80).map((movement) => {
                const product = products.find((item) => item.id === movement.product_id);
                const direction = getStockMovementDirection(movement);

                return (
                  <div key={movement.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {formatProductCode(product?.code) || 'Sem código'} · {product?.name || 'Produto removido'}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {movement.source === 'purchase' || /compra/i.test(movement.reason)
                          ? 'Compra'
                          : movement.source === 'sale' || /venda/i.test(movement.reason)
                            ? 'Venda'
                            : 'Manual'}
                        {' · '}
                        {movement.reason}
                        {' · '}
                        {formatDateTime(movement.date)}
                      </p>
                      <p className="text-muted-foreground">Usuário: {getMovementActorLabel(movement)}</p>
                      {movement.balance_before != null && movement.balance_after != null && (
                        <p className="text-muted-foreground">Saldo {movement.balance_before} → {movement.balance_after}</p>
                      )}
                    </div>
                    <span className={`ml-3 shrink-0 font-bold ${direction === 'entrada' ? 'text-green-500' : 'text-destructive'}`}>
                      {direction === 'entrada' ? '+' : '-'}{movement.quantity}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </StockInsightsPageLayout>
  );
}

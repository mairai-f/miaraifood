import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { StockInsightsPageLayout } from '@/components/stock/StockInsightsPageLayout';
import { DataRouteLoader } from '@/components/DataRouteLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStockAnalytics } from '@/hooks/useStockAnalytics';
import { formatProductCode } from '@/lib/productCode';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export default function StockAbcCurve() {
  const { loading } = useData();
  const { abcRows, productsById } = useStockAnalytics();

  const curveGroups = useMemo(() => (
    ['A', 'B', 'C'].map((curve) => {
      const rows = abcRows.filter((row) => row.curve === curve);
      const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
      const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);

      return {
        curve,
        rows,
        revenue,
        quantity,
      };
    })
  ), [abcRows]);

  if (loading) {
    return <DataRouteLoader label="Carregando curva ABC..." />;
  }

  return (
    <StockInsightsPageLayout
      title="Curva ABC do estoque"
      description="Classificação dos produtos mais relevantes em faturamento nos últimos 90 dias."
    >
      <div className="grid gap-3 md:grid-cols-3">
        {curveGroups.map((group) => (
          <Card key={group.curve} className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Curva {group.curve}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{group.rows.length} produtos</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {currencyFormatter.format(group.revenue)} · {group.quantity.toFixed(0)} un
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {abcRows.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Ainda não há vendas suficientes para a Curva ABC.</p>
            <p className="text-xs text-muted-foreground">Assim que houver histórico de vendas, essa análise aparecerá aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {curveGroups.map((group) => (
            <Card key={group.curve} className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>Curva {group.curve}</span>
                  <Badge variant={group.curve === 'A' ? 'default' : 'secondary'}>
                    {group.rows.length} itens
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {group.rows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem produtos nessa faixa.</p>
                ) : (
                  <div className="space-y-2">
                    {group.rows.map((row, index) => {
                      const product = productsById.get(row.productId);
                      return (
                        <div key={row.productId} className="rounded-lg border border-border/60 bg-background/70 p-3 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">
                                #{index + 1} · {product?.name ?? row.productId}
                              </p>
                              <p className="text-muted-foreground">
                                {formatProductCode(product?.code) || 'Sem código'} · {row.quantity.toFixed(0)} un
                              </p>
                            </div>
                            <Badge variant="outline">{row.sharePct.toFixed(1)}%</Badge>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-muted-foreground">
                            <span>Receita {currencyFormatter.format(row.revenue)}</span>
                            <span>Acumulado {row.cumulativePct.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </StockInsightsPageLayout>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { StockInsightsPageLayout } from '@/components/stock/StockInsightsPageLayout';
import { DataRouteLoader } from '@/components/DataRouteLoader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStockAnalytics } from '@/hooks/useStockAnalytics';
import { toProductUppercase } from '@/lib/productSearch';

export default function StockPurchaseSuggestions() {
  const { loading } = useData();
  const { purchaseSuggestions } = useStockAnalytics();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filteredSuggestions = useMemo(() => {
    const normalizedSearch = toProductUppercase(search).trim();
    if (!normalizedSearch) return purchaseSuggestions;

    return purchaseSuggestions.filter((suggestion) => (
      toProductUppercase(suggestion.productName).includes(normalizedSearch)
      || toProductUppercase(suggestion.supplierName).includes(normalizedSearch)
    ));
  }, [purchaseSuggestions, search]);

  const summary = useMemo(() => filteredSuggestions.reduce((result, suggestion) => {
    if (suggestion.severity === 'critical') result.critical += 1;
    if (suggestion.severity === 'attention') result.attention += 1;
    result.units += suggestion.suggestedQuantity;
    return result;
  }, {
    critical: 0,
    attention: 0,
    units: 0,
  }), [filteredSuggestions]);

  const openPurchaseOrder = (productId: string, quantity: number, supplierName: string) => {
    const params = new URLSearchParams({
      tab: 'compras',
      product: productId,
      quantity: String(quantity),
      supplier: supplierName,
    });
    navigate(`/operacoes?${params.toString()}`);
  };

  if (loading) {
    return <DataRouteLoader label="Carregando sugestões de compras..." />;
  }

  return (
    <StockInsightsPageLayout
      title="Sugestões de compras"
      description="Produtos com risco de ruptura e quantidades sugeridas para reposição."
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Itens críticos</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{summary.critical}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Itens em atenção</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{summary.attention}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Unidades sugeridas</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{summary.units}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-sm">Fila de reposição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar produto ou fornecedor"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {filteredSuggestions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma sugestão encontrada.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {filteredSuggestions.map((suggestion) => (
                <div key={suggestion.productId} className="rounded-xl border border-border/60 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{suggestion.productName}</p>
                        <Badge variant={suggestion.severity === 'critical' ? 'destructive' : 'secondary'} className="shrink-0">
                          {suggestion.severity === 'critical' ? 'Zerado' : 'Baixo'}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{suggestion.supplierName}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => openPurchaseOrder(suggestion.productId, suggestion.suggestedQuantity, suggestion.supplierName)}
                    >
                      Abrir compras
                    </Button>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      Atual {suggestion.currentStock} · alvo {suggestion.targetStock ?? suggestion.minStock}
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      Comprar {suggestion.suggestedQuantity} un
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      Média {(suggestion.averageDailySales ?? 0).toFixed(1)} / dia
                    </div>
                    <div className="rounded-md border border-border/60 px-3 py-2">
                      Restante {suggestion.estimatedDaysRemaining != null ? `${suggestion.estimatedDaysRemaining.toFixed(1)} dias` : 'sem cálculo'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </StockInsightsPageLayout>
  );
}

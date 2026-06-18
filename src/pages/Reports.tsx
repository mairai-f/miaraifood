import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, TrendingUp, Package, Users, DollarSign } from 'lucide-react';
import { formatDateOnly, translateCurrentText } from '../../shared/locale/format';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658'];

export default function Reports() {
  const { sales, saleItems, clients, products, debtEntries, payments } = useData();
  const today = new Date();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(today); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  const filteredSales = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');
    return sales.filter(s => {
      const d = new Date(s.date);
      return d >= start && d <= end;
    });
  }, [sales, startDate, endDate]);

  const activeFilteredSales = useMemo(
    () => filteredSales.filter(sale => sale.status !== 'cancelled'),
    [filteredSales],
  );

  const filteredItems = useMemo(() => {
    const saleIds = new Set(activeFilteredSales.map(s => s.id));
    return saleItems.filter(i => saleIds.has(i.sale_id));
  }, [activeFilteredSales, saleItems]);

  const filteredFiadoEntries = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');

    return debtEntries.filter(entry => {
      const entryDate = new Date(entry.date_added);
      const shouldCountInHistory = !entry.deleted || entry.status === 'paid';
      return shouldCountInHistory && entryDate >= start && entryDate <= end;
    });
  }, [debtEntries, startDate, endDate]);

  const filteredFiadoPayments = useMemo(() => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59');

    return payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate >= start && paymentDate <= end;
    });
  }, [payments, startDate, endDate]);

  // Total revenue & profit
  const totalRevenue = activeFilteredSales.reduce((s, sale) => s + sale.total, 0);
  const totalCost = filteredItems.reduce((s, i) => s + i.cost_price * i.quantity, 0);
  const totalProfit = totalRevenue - totalCost;
  const averageTicket = activeFilteredSales.length > 0 ? totalRevenue / activeFilteredSales.length : 0;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const totalUnitsSold = filteredItems.reduce((sum, item) => sum + item.quantity, 0);
  const averageUnitsPerSale = activeFilteredSales.length > 0 ? totalUnitsSold / activeFilteredSales.length : 0;
  const totalFiadoSpent = filteredFiadoEntries.reduce((sum, entry) => sum + entry.total, 0);
  const totalFiadoPaid = filteredFiadoPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalOpenFiado = debtEntries
    .filter(entry => entry.status === 'pending' && !entry.deleted && !entry.manual_deleted)
    .reduce((sum, entry) => sum + entry.total, 0);
  const lowStockProducts = useMemo(
    () => products
      .filter(product => !product.deleted && product.min_stock > 0 && product.stock <= product.min_stock)
      .sort((a, b) => (a.stock - a.min_stock) - (b.stock - b.min_stock)),
    [products],
  );
  const overdueBuckets = useMemo(() => {
    const now = new Date();
    const buckets = {
      d7: { label: '7+ dias', count: 0, total: 0 },
      d15: { label: '15+ dias', count: 0, total: 0 },
      d30: { label: '30+ dias', count: 0, total: 0 },
    };

    debtEntries
      .filter(entry => entry.status === 'pending' && !entry.deleted && !entry.manual_deleted)
      .forEach(entry => {
        const ageDays = Math.floor((now.getTime() - new Date(entry.date_added).getTime()) / (24 * 60 * 60 * 1000));
        if (ageDays >= 30) {
          buckets.d30.count += 1;
          buckets.d30.total += entry.total;
        } else if (ageDays >= 15) {
          buckets.d15.count += 1;
          buckets.d15.total += entry.total;
        } else if (ageDays >= 7) {
          buckets.d7.count += 1;
          buckets.d7.total += entry.total;
        }
      });

    return [buckets.d7, buckets.d15, buckets.d30];
  }, [debtEntries]);

  // Top products
  const productRanking = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
    for (const i of filteredItems) {
      const key = i.product_name;
      const existing = map.get(key);
      const revenue = i.total;
      const profit = revenue - i.cost_price * i.quantity;
      if (existing) {
        existing.qty += i.quantity;
        existing.revenue += revenue;
        existing.profit += profit;
      } else {
        map.set(key, { name: key, qty: i.quantity, revenue, profit });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [filteredItems]);

  // Top clients
  const clientRanking = useMemo(() => {
    const map = new Map<string, { name: string; totalSpent: number; totalPaid: number; items: number }>();

    for (const entry of filteredFiadoEntries) {
      const client = clients.find(c => c.id === entry.client_id);
      if (!client) continue;

      const existing = map.get(client.id);
      if (existing) {
        existing.totalSpent += entry.total;
        existing.items += entry.quantity;
      } else {
        map.set(client.id, {
          name: client.name,
          totalSpent: entry.total,
          totalPaid: 0,
          items: entry.quantity,
        });
      }
    }

    for (const payment of filteredFiadoPayments) {
      const client = clients.find(c => c.id === payment.client_id);
      if (!client) continue;

      const existing = map.get(client.id);
      if (existing) {
        existing.totalPaid += payment.amount;
      } else {
        map.set(client.id, {
          name: client.name,
          totalSpent: 0,
          totalPaid: payment.amount,
          items: 0,
        });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => {
        if (b.totalSpent !== a.totalSpent) return b.totalSpent - a.totalSpent;
        if (b.totalPaid !== a.totalPaid) return b.totalPaid - a.totalPaid;
        return b.items - a.items;
      })
      .slice(0, 10);
  }, [clients, filteredFiadoEntries, filteredFiadoPayments]);

  const clientRevenueRanking = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; sales: number }>();

    for (const sale of activeFilteredSales) {
      if (!sale.client_id) continue;
      const client = clients.find(c => c.id === sale.client_id);
      if (!client) continue;

      const existing = map.get(client.id);
      if (existing) {
        existing.revenue += sale.total;
        existing.sales += 1;
      } else {
        map.set(client.id, {
          name: client.name,
          revenue: sale.total,
          sales: 1,
        });
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [activeFilteredSales, clients]);

  const staleProducts = useMemo(() => {
    const soldProductIds = new Set(filteredItems.map(item => item.product_id).filter(Boolean));
    return products
      .filter(product => !product.deleted && !soldProductIds.has(product.id))
      .sort((a, b) => (b.stock * (b.cost_price || 0)) - (a.stock * (a.cost_price || 0)))
      .slice(0, 10);
  }, [filteredItems, products]);

  // Vendas do dia 
  const salesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of activeFilteredSales) {
      const day = formatDateOnly(s.date);
      map.set(day, (map.get(day) || 0) + s.total);
    }
    return Array.from(map.entries()).map(([day, total]) => ({ day, total }));
  }, [activeFilteredSales]);

  const salesByHour = useMemo(() => {
    const hourly = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: `${String(hour).padStart(2, '0')}h`,
      total: 0,
      count: 0,
    }));

    for (const sale of activeFilteredSales) {
      const hour = new Date(sale.date).getHours();
      hourly[hour].total += sale.total;
      hourly[hour].count += 1;
    }

    return hourly.filter(item => item.count > 0);
  }, [activeFilteredSales]);

  const bestSalesHour = salesByHour.reduce(
    (best, item) => item.total > best.total ? item : best,
    { hour: 0, label: '--', total: 0, count: 0 },
  );

  // metodo de pagamento
  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of activeFilteredSales) {
      const label = {
        dinheiro: translateCurrentText('Dinheiro'),
        cartao_debito: translateCurrentText('Debito'),
        cartao_credito: translateCurrentText('Credito'),
        pix: 'Pix',
        fiado: translateCurrentText('Fiado'),
      }[s.payment_method] || translateCurrentText(s.payment_method);
      map.set(label, (map.get(label) || 0) + s.total);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [activeFilteredSales]);

  const exportCsv = () => {
    const rows = [
      ['tipo', 'data', 'descricao', 'cliente', 'quantidade', 'total', 'lucro'],
      ...activeFilteredSales.map(sale => [
        'venda',
        sale.date,
        sale.payment_method,
        clients.find(client => client.id === sale.client_id)?.name || '',
        '',
        sale.total.toFixed(2),
        filteredItems
          .filter(item => item.sale_id === sale.id)
          .reduce((sum, item) => sum + (item.total_profit ?? item.total - item.cost_price * item.quantity), 0)
          .toFixed(2),
      ]),
      ...filteredFiadoEntries.map(entry => [
        'fiado',
        entry.date_added,
        entry.product_name,
        clients.find(client => client.id === entry.client_id)?.name || '',
        String(entry.quantity),
        entry.total.toFixed(2),
        '',
      ]),
    ];
    const csv = rows
      .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `happycash-relatorio-${startDate}-a-${endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" data-tour-id="reports-header">📊 Relatórios</h1>

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 items-end" data-tour-id="reports-filters">
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs w-40" /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs w-40" /></div>
        <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />Exportar CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-tour-id="reports-stats">
        {[
          { label: 'Vendas válidas', value: activeFilteredSales.length, icon: TrendingUp },
          { label: 'Faturamento', value: `R$ ${totalRevenue.toFixed(2)}`, icon: DollarSign },
          { label: 'Custo', value: `R$ ${totalCost.toFixed(2)}`, icon: Package },
          { label: 'Lucro', value: `R$ ${totalProfit.toFixed(2)}`, icon: TrendingUp },
          { label: 'Ticket médio', value: `R$ ${averageTicket.toFixed(2)}`, icon: DollarSign },
          { label: 'Margem', value: `${profitMargin.toFixed(1)}%`, icon: TrendingUp },
          { label: 'Fiado aberto', value: `R$ ${totalOpenFiado.toFixed(2)}`, icon: Users },
          { label: 'Itens/venda', value: averageUnitsPerSale.toFixed(1), icon: Package },
        ].map((s, i) => (
          <Card key={i} className="border-border/50">
            <CardHeader className="pb-1 px-3 pt-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-3 pb-3"><p className="text-lg font-bold">{s.value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-tour-id="reports-alerts">
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm">Produtos Abaixo do Mínimo</CardTitle></CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum produto abaixo do mínimo.</p> : (
              <div className="space-y-2">
                {lowStockProducts.slice(0, 12).map(product => (
                  <div key={product.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate">{product.name}</span>
                    <span className="font-medium text-destructive">Est: {product.stock} / mín: {product.min_stock}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm">Inadimplência por Tempo</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {overdueBuckets.map(bucket => (
                <div key={bucket.label} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">{bucket.label}</p>
                  <p className="mt-1 text-sm font-bold">R$ {bucket.total.toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground">{bucket.count} item(ns)</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by day chart */}
      {salesByDay.length > 0 && (
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm">Vendas por Dia</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesByDay}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} /><Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {salesByHour.length > 0 && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Horários de Maior Movimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">Melhor horário</p>
                <p className="text-lg font-bold">{bestSalesHour.label}</p>
                <p className="text-[11px] text-muted-foreground">R$ {bestSalesHour.total.toFixed(2)} em {bestSalesHour.count} venda(s)</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">Itens vendidos</p>
                <p className="text-lg font-bold">{totalUnitsSold}</p>
                <p className="text-[11px] text-muted-foreground">No período filtrado</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">Vendas canceladas</p>
                <p className="text-lg font-bold">{filteredSales.length - activeFilteredSales.length}</p>
                <p className="text-[11px] text-muted-foreground">Fora do faturamento</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={salesByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-tour-id="reports-rankings">
        {/* Top products */}
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm">🏆 Produtos Mais Vendidos</CardTitle></CardHeader>
          <CardContent>
            {productRanking.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados</p> : (
              <div className="space-y-2">
                {productRanking.map((p, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="truncate mr-2">{i + 1}. {p.name}</span>
                    <span className="text-muted-foreground whitespace-nowrap">{p.qty}x — R$ {p.revenue.toFixed(2)} (lucro: R$ {p.profit.toFixed(2)})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment breakdown */}
        {paymentBreakdown.length > 0 && (
          <Card className="border-border/50">
            <CardHeader><CardTitle className="text-sm">Formas de Pagamento</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart><Pie data={paymentBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={10}>
                  {paymentBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} /></PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm">Clientes por Receita</CardTitle></CardHeader>
          <CardContent>
            {clientRevenueRanking.length === 0 ? <p className="text-xs text-muted-foreground">Sem vendas vinculadas a clientes.</p> : (
              <div className="space-y-2">
                {clientRevenueRanking.map((client, index) => (
                  <div key={client.name} className="flex items-start justify-between gap-3 text-xs">
                    <span className="truncate">{index + 1}. {client.name}</span>
                    <div className="shrink-0 text-right">
                      <p className="font-medium">R$ {client.revenue.toFixed(2)}</p>
                      <p className="text-muted-foreground">{client.sales} venda(s)</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top clients */}
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm">👥 Clientes que Mais Compram no Fiado</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-secondary/20 p-3">
              <div>
                <p className="text-[11px] text-muted-foreground">Total gasto</p>
                <p className="text-sm font-bold">R$ {totalFiadoSpent.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Total pago</p>
                <p className="text-sm font-bold text-primary">R$ {totalFiadoPaid.toFixed(2)}</p>
              </div>
            </div>
            {clientRanking.length === 0 ? <p className="text-xs text-muted-foreground">Sem dados</p> : (
              <div className="space-y-2">
                {clientRanking.map((c, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-xs">
                    <span className="truncate mr-2">{i + 1}. {c.name}</span>
                    <div className="shrink-0 text-right">
                      <p className="font-medium">Gasto: R$ {c.totalSpent.toFixed(2)}</p>
                      <p className="text-muted-foreground">Pago: R$ {c.totalPaid.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stale products */}
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm">📦 Produtos Sem Venda no Período</CardTitle></CardHeader>
          <CardContent>
            {staleProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todos os produtos ativos venderam no período.</p>
            ) : (
              <div className="space-y-2">
                {staleProducts.map(product => (
                  <div key={product.id} className="flex items-start justify-between gap-3 text-xs">
                    <span className="truncate">{product.name}</span>
                    <div className="shrink-0 text-right">
                      <p className="font-medium">Estoque: {product.stock}</p>
                      <p className="text-muted-foreground">Custo parado: R$ {(product.stock * (product.cost_price || 0)).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

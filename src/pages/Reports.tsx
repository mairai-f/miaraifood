import { useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, Users, DollarSign } from 'lucide-react';
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

  const filteredItems = useMemo(() => {
    const saleIds = new Set(filteredSales.map(s => s.id));
    return saleItems.filter(i => saleIds.has(i.sale_id));
  }, [filteredSales, saleItems]);

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
  const totalRevenue = filteredSales.reduce((s, sale) => s + sale.total, 0);
  const totalCost = filteredItems.reduce((s, i) => s + i.cost_price * i.quantity, 0);
  const totalProfit = totalRevenue - totalCost;
  const totalFiadoSpent = filteredFiadoEntries.reduce((sum, entry) => sum + entry.total, 0);
  const totalFiadoPaid = filteredFiadoPayments.reduce((sum, payment) => sum + payment.amount, 0);

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

  // Vendas do dia 
  const salesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filteredSales) {
      const day = formatDateOnly(s.date);
      map.set(day, (map.get(day) || 0) + s.total);
    }
    return Array.from(map.entries()).map(([day, total]) => ({ day, total }));
  }, [filteredSales]);

  // metodo de pagamento
  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filteredSales) {
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
  }, [filteredSales]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">📊 Relatórios</h1>

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1"><Label className="text-xs">De</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 text-xs w-40" /></div>
        <div className="space-y-1"><Label className="text-xs">Até</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 text-xs w-40" /></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Vendas', value: filteredSales.length, icon: TrendingUp },
          { label: 'Faturamento', value: `R$ ${totalRevenue.toFixed(2)}`, icon: DollarSign },
          { label: 'Custo', value: `R$ ${totalCost.toFixed(2)}`, icon: Package },
          { label: 'Lucro', value: `R$ ${totalProfit.toFixed(2)}`, icon: TrendingUp },
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
          <CardHeader><CardTitle className="text-sm">📦 Produtos Parados</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const soldIds = new Set(saleItems.map(i => i.product_id));
              const stale = products.filter(p => !soldIds.has(p.id) && !p.deleted);
              return stale.length === 0
                ? <p className="text-xs text-muted-foreground">Todos os produtos foram vendidos</p>
                : <div className="space-y-1">{stale.slice(0, 10).map(p => <p key={p.id} className="text-xs">{p.name} — R$ {p.price.toFixed(2)}</p>)}</div>;
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

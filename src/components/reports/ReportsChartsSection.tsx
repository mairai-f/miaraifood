import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658'];

type SalesByDayRow = {
  day: string;
  total: number;
};

type SalesByHourRow = {
  hour: number;
  label: string;
  total: number;
  count: number;
};

type PaymentBreakdownRow = {
  name: string;
  value: number;
};

interface ReportsChartsSectionProps {
  salesByDay: SalesByDayRow[];
  salesByHour: SalesByHourRow[];
  bestSalesHour: SalesByHourRow;
  totalUnitsSold: number;
  filteredSalesCount: number;
  activeFilteredSalesCount: number;
  paymentBreakdown: PaymentBreakdownRow[];
}

export function ReportsChartsSection({
  salesByDay,
  salesByHour,
  bestSalesHour,
  totalUnitsSold,
  filteredSalesCount,
  activeFilteredSalesCount,
  paymentBreakdown,
}: ReportsChartsSectionProps) {
  return (
    <>
      {salesByDay.length > 0 && (
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm">Vendas por Dia</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
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
                <p className="text-lg font-bold">{filteredSalesCount - activeFilteredSalesCount}</p>
                <p className="text-[11px] text-muted-foreground">Fora do faturamento</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={salesByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {paymentBreakdown.length > 0 && (
        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-sm">Formas de Pagamento</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={paymentBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  fontSize={10}
                >
                  {paymentBreakdown.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </>
  );
}

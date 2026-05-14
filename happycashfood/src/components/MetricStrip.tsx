import { Clock, DollarSign, ReceiptText, UsersRound } from "lucide-react";
import type { FoodOrder, FoodTable } from "@/types";
import { currency, occupiedTables, orderTotal } from "@/lib/foodMetrics";

interface MetricStripProps {
  tables: FoodTable[];
  orders: FoodOrder[];
  readyItems: number;
}

export function MetricStrip({ tables, orders, readyItems }: MetricStripProps) {
  const openOrders = orders.filter((order) => order.status !== "paid");
  const revenue = openOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const metrics = [
    {
      label: "Mesas ocupadas",
      value: `${occupiedTables(tables).length}/${tables.length}`,
      icon: UsersRound,
      tone: "text-secondary",
    },
    {
      label: "Comandas abertas",
      value: openOrders.length,
      icon: ReceiptText,
      tone: "text-primary",
    },
    {
      label: "Itens prontos",
      value: readyItems,
      icon: Clock,
      tone: "text-warning",
    },
    {
      label: "Consumo aberto",
      value: currency.format(revenue),
      icon: DollarSign,
      tone: "text-success",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <article key={metric.label} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-2xl font-black">{metric.value}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${metric.tone}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

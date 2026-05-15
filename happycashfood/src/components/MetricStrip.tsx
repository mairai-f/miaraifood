import { useMemo, useState } from "react";
import { ChevronDown, Clock, DollarSign, ReceiptText, UsersRound } from "lucide-react";
import type { FoodOrder, FoodTable } from "@/types";
import {
  currency,
  formatElapsed,
  occupiedTables,
  orderTotal,
  sortOrdersByTableNumber,
  sortTablesByNumber,
} from "@/lib/foodMetrics";

interface MetricStripProps {
  tables: FoodTable[];
  orders: FoodOrder[];
  readyItems: number;
}

type MetricKey = "tables" | "orders" | "ready" | "revenue";

interface MetricDetail {
  id: string;
  title: string;
  subtitle: string;
  value: string;
  hint?: string;
}

export function MetricStrip({ tables, orders, readyItems }: MetricStripProps) {
  const [expandedMetric, setExpandedMetric] = useState<MetricKey | null>(null);
  const openOrders = useMemo(() => orders.filter((order) => order.status !== "paid"), [orders]);
  const revenue = openOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const orderByTableId = useMemo(
    () => new Map(openOrders.map((order) => [order.tableId, order])),
    [openOrders],
  );
  const tableNumberById = useMemo(
    () => new Map(tables.map((table) => [table.id, table.number])),
    [tables],
  );
  const occupiedTableDetails = useMemo<MetricDetail[]>(
    () =>
      sortTablesByNumber(occupiedTables(tables)).map((table) => {
        const order = orderByTableId.get(table.id);
        const itemCount = order?.items.reduce(
          (sum, item) => (item.status === "cancelled" ? sum : sum + item.quantity),
          0,
        ) ?? 0;

        return {
          id: table.id,
          title: `Mesa ${table.number}`,
          subtitle: [
            table.area,
            table.waiterName ? `Garcom ${table.waiterName}` : null,
            table.openedAt ? formatElapsed(table.openedAt) : null,
          ]
            .filter(Boolean)
            .join(" • "),
          value: order ? currency.format(orderTotal(order)) : "Sem consumo",
          hint: itemCount > 0 ? `${itemCount} ${itemCount === 1 ? "item" : "itens"}` : undefined,
        };
      }),
    [orderByTableId, tables],
  );
  const openOrderDetails = useMemo<MetricDetail[]>(
    () =>
      sortOrdersByTableNumber(openOrders, tables).map((order) => {
        const itemCount = order.items.reduce(
          (sum, item) => (item.status === "cancelled" ? sum : sum + item.quantity),
          0,
        );
        const productPreview = order.items
          .filter((item) => item.status !== "cancelled")
          .slice(0, 2)
          .map((item) => `${item.quantity}x ${item.productName}`)
          .join(", ");
        const extraItems = Math.max(
          0,
          order.items.filter((item) => item.status !== "cancelled").length - 2,
        );
        const tableNumber = tableNumberById.get(order.tableId) ?? order.customerName.replace(/^Mesa\s*/i, "").trim();

        return {
          id: order.id,
          title: `Mesa ${tableNumber || "--"}`,
          subtitle: productPreview
            ? `${productPreview}${extraItems > 0 ? ` +${extraItems}` : ""}`
            : "Sem itens enviados",
          value: currency.format(orderTotal(order)),
          hint: `${itemCount} ${itemCount === 1 ? "item" : "itens"}`,
        };
      }),
    [openOrders, tableNumberById, tables],
  );
  const readyItemDetails = useMemo<MetricDetail[]>(
    () =>
      sortOrdersByTableNumber(openOrders, tables).flatMap((order) => {
        const tableNumber = tableNumberById.get(order.tableId) ?? order.customerName.replace(/^Mesa\s*/i, "").trim();
        return order.items
          .filter((item) => item.status === "ready")
          .map((item) => ({
            id: `${order.id}-${item.id}`,
            title: item.productName,
            subtitle: `Mesa ${tableNumber || "--"} • ${formatElapsed(item.createdAt)}`,
            value: `${item.quantity}x`,
            hint: currency.format(item.quantity * item.unitPrice),
          }));
      }),
    [openOrders, tableNumberById, tables],
  );
  const openConsumptionDetails = useMemo<MetricDetail[]>(
    () =>
      sortOrdersByTableNumber(openOrders, tables).map((order) => {
        const itemCount = order.items.reduce(
          (sum, item) => (item.status === "cancelled" ? sum : sum + item.quantity),
          0,
        );
        const tableNumber = tableNumberById.get(order.tableId) ?? order.customerName.replace(/^Mesa\s*/i, "").trim();

        return {
          id: `consumption-${order.id}`,
          title: `Mesa ${tableNumber || "--"}`,
          subtitle: [
            order.customerName || null,
            order.waiterName ? `Garcom ${order.waiterName}` : null,
            formatElapsed(order.openedAt),
          ]
            .filter(Boolean)
            .join(" • "),
          value: currency.format(orderTotal(order)),
          hint: `${itemCount} ${itemCount === 1 ? "item" : "itens"}`,
        };
      }),
    [openOrders, tableNumberById, tables],
  );
  const metrics = [
    {
      key: "tables" as const,
      label: "Mesas ocupadas",
      value: `${occupiedTableDetails.length}/${tables.length}`,
      icon: UsersRound,
      tone: "text-secondary",
      details: occupiedTableDetails,
      emptyLabel: "Nenhuma mesa ocupada no momento.",
    },
    {
      key: "orders" as const,
      label: "Comandas abertas",
      value: openOrders.length,
      icon: ReceiptText,
      tone: "text-primary",
      details: openOrderDetails,
      emptyLabel: "Nenhuma comanda aberta no momento.",
    },
    {
      key: "ready" as const,
      label: "Itens prontos",
      value: readyItems,
      icon: Clock,
      tone: "text-warning",
      details: readyItemDetails,
      emptyLabel: "Nenhum item pronto no momento.",
    },
    {
      key: "revenue" as const,
      label: "Consumo aberto",
      value: currency.format(revenue),
      icon: DollarSign,
      tone: "text-success",
      details: openConsumptionDetails,
      emptyLabel: "Nenhum consumo aberto no momento.",
    },
  ];

  return (
    <section className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const isExpanded = expandedMetric === metric.key;
        return (
          <article
            key={metric.label}
            className={`rounded-lg border bg-card shadow-sm transition ${
              isExpanded ? "border-primary ring-1 ring-primary/20" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => setExpandedMetric((current) => (current === metric.key ? null : metric.key))}
              aria-expanded={isExpanded}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
            >
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-2xl font-black">{metric.value}</p>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">
                  Clique para {isExpanded ? "recolher" : "ver detalhes"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-muted ${metric.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition ${isExpanded ? "rotate-180" : ""}`}
                />
              </div>
            </button>

            {isExpanded && (
              <div className="border-t px-4 pb-4 pt-3">
                {metric.details.length > 0 ? (
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {metric.details.map((detail) => (
                      <article key={detail.id} className="rounded-lg border bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-black">{detail.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{detail.subtitle}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black">{detail.value}</p>
                            {detail.hint && (
                              <p className="text-xs text-muted-foreground">{detail.hint}</p>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">
                    {metric.emptyLabel}
                  </p>
                )}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

import { useMemo, useState } from "react";
import { Bell, CheckCircle2, ChefHat, Clock3, Package2, X } from "lucide-react";
import type { FoodOrder, FoodTable, KitchenStatus, KitchenTicket, Station } from "@/types";
import { formatElapsed, nextKitchenStatus, statusLabel } from "@/lib/foodMetrics";

interface KitchenDisplayProps {
  tickets: KitchenTicket[];
  orders: FoodOrder[];
  tables: FoodTable[];
  onAdvanceTicket: (ticketId: string) => void;
}

const columns: KitchenStatus[] = ["received", "preparing", "ready", "delivered"];

const stationLabel: Record<Station, string> = {
  kitchen: "Cozinha",
  bar: "Bar",
  counter: "Balcao",
};

const columnTone: Record<KitchenStatus, string> = {
  received: "border-blue-200 bg-blue-50 text-blue-800",
  preparing: "border-amber-200 bg-amber-50 text-amber-900",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  delivered: "border-slate-200 bg-slate-50 text-slate-700",
};

const statusHint: Record<KitchenStatus, string> = {
  received: "Pedidos novos aguardando inicio.",
  preparing: "Pedidos em preparo na cozinha, bar ou balcao.",
  ready: "Pedidos prontos para retirada ou entrega na mesa.",
  delivered: "Pedidos ja entregues ao cliente.",
};

const sumTicketItems = (ticket: KitchenTicket) =>
  ticket.items.reduce((sum, item) => sum + item.quantity, 0);

export function KitchenDisplay({ tickets, orders, tables, onAdvanceTicket }: KitchenDisplayProps) {
  const [activeStatus, setActiveStatus] = useState<KitchenStatus | null>(null);
  const [modalPage, setModalPage] = useState(0);
  const ticketsPerPage = 3;
  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const tableById = useMemo(
    () => new Map(tables.map((table) => [table.id, table])),
    [tables],
  );

  const resolveOrigin = (ticket: KitchenTicket) => {
    if (ticket.tableNumber === "Delivery") return "Delivery";
    const order = orderById.get(ticket.orderId);
    const table = order ? tableById.get(order.tableId) : null;
    return table?.area || "Salao";
  };

  const summaries = useMemo(
    () =>
      columns.map((status, index) => {
        const statusTickets = tickets.filter((ticket) => ticket.status === status);
        const itemCount = statusTickets.reduce((sum, ticket) => sum + sumTicketItems(ticket), 0);
        const stationCounts = {
          kitchen: statusTickets
            .filter((ticket) => ticket.station === "kitchen")
            .reduce((sum, ticket) => sum + sumTicketItems(ticket), 0),
          bar: statusTickets
            .filter((ticket) => ticket.station === "bar")
            .reduce((sum, ticket) => sum + sumTicketItems(ticket), 0),
          counter: statusTickets
            .filter((ticket) => ticket.station === "counter")
            .reduce((sum, ticket) => sum + sumTicketItems(ticket), 0),
        };

        const originCounts = statusTickets.reduce<Record<string, number>>((accumulator, ticket) => {
          const origin = resolveOrigin(ticket);
          accumulator[origin] = (accumulator[origin] || 0) + 1;
          return accumulator;
        }, {});

        return {
          status,
          shortcut: String(index + 1),
          tickets: statusTickets,
          itemCount,
          stationCounts,
          originCounts: Object.entries(originCounts)
            .sort((left, right) => right[1] - left[1])
            .slice(0, 3),
        };
      }),
    [tickets, orderById, tableById],
  );

  const activeSummary = summaries.find((summary) => summary.status === activeStatus) ?? null;
  const totalModalPages = activeSummary ? Math.max(1, Math.ceil(activeSummary.tickets.length / ticketsPerPage)) : 1;
  const visibleTickets = activeSummary
    ? activeSummary.tickets.slice(modalPage * ticketsPerPage, modalPage * ticketsPerPage + ticketsPerPage)
    : [];

  const openStatusModal = (status: KitchenStatus) => {
    setActiveStatus(status);
    setModalPage(0);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-black">KDS cozinha e bar</h3>
          <p className="text-sm text-muted-foreground">Clique no status para abrir o modal com os pedidos sem depender de rolagem.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-bold">
          <Bell className="h-4 w-4 text-warning" />
          {summaries.find((summary) => summary.status === "received")?.itemCount ?? 0} itens novos
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {summaries.map((summary) => {
          const { status } = summary;
          return (
            <button
              key={status}
              type="button"
              onClick={() => openStatusModal(status)}
              className="rounded-lg border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-panel"
            >
              <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${columnTone[status]}`}>
                <div>
                  <p className="text-sm font-black">{statusLabel[status]}</p>
                  <p className="text-xs font-semibold opacity-80">{statusHint[status]}</p>
                </div>
                <span className="rounded-full bg-card/80 px-3 py-1 text-xs font-black">
                  {summary.shortcut}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Quantidade explicita</p>
                  <p className="mt-2 text-3xl font-black">{summary.itemCount} itens</p>
                  <p className="mt-1 text-sm text-muted-foreground">{summary.tickets.length} comandas nesta etapa</p>
                </div>

                <div className="grid gap-2">
                  <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <span className="font-black">Cozinha:</span> {summary.stationCounts.kitchen} item(ns)
                  </div>
                  <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <span className="font-black">Bar:</span> {summary.stationCounts.bar} item(ns)
                  </div>
                  <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <span className="font-black">Balcao:</span> {summary.stationCounts.counter} item(ns)
                  </div>
                  <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                    <span className="font-black">Origem:</span>{" "}
                    {summary.originCounts.length > 0
                      ? summary.originCounts.map(([origin, count]) => `${origin} ${count}`).join(" • ")
                      : "Sem comandas"}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs font-semibold text-muted-foreground">
                Clique para abrir os pedidos {statusLabel[status].toLowerCase()}s em modal.
              </p>
            </button>
          );
        })}
      </div>

      {activeSummary && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-3">
          <div className="w-full max-w-6xl rounded-2xl border bg-card shadow-panel">
            <div className="flex items-start justify-between gap-3 border-b p-4 sm:p-5">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">KDS detalhado</p>
                <h3 className="text-2xl font-black sm:text-3xl">{statusLabel[activeSummary.status]}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeSummary.itemCount} itens em {activeSummary.tickets.length} comandas nesta etapa.
                </p>
              </div>
              <button
                type="button"
                data-modal-close="true"
                onClick={() => setActiveStatus(null)}
                className="grid h-10 w-10 place-items-center rounded-lg border bg-background text-muted-foreground"
                aria-label="Fechar modal do KDS"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-5">
              <div className="space-y-3">
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Resumo</p>
                  <p className="mt-2 text-3xl font-black">{activeSummary.itemCount} itens</p>
                  <p className="mt-1 text-sm text-muted-foreground">{activeSummary.tickets.length} comandas abertas</p>
                </div>
                <div className="rounded-lg border bg-background p-3 text-sm">
                  <p><span className="font-black">Cozinha:</span> {activeSummary.stationCounts.kitchen} item(ns)</p>
                  <p className="mt-2"><span className="font-black">Bar:</span> {activeSummary.stationCounts.bar} item(ns)</p>
                  <p className="mt-2"><span className="font-black">Balcao:</span> {activeSummary.stationCounts.counter} item(ns)</p>
                </div>
                <div className="rounded-lg border bg-background p-3 text-sm">
                  <p className="font-black">Atalhos do modal</p>
                  <p className="mt-2 text-muted-foreground">Esc fecha. Tab percorre os botoes. Use os numeros do menu lateral para trocar de area.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid gap-3 xl:grid-cols-3">
                  {visibleTickets.length > 0 ? (
                    visibleTickets.map((ticket) => {
                      const nextStatus = nextKitchenStatus(activeSummary.status);
                      const extraItems = Math.max(0, ticket.items.length - 3);
                      return (
                        <article key={ticket.id} className="rounded-lg border bg-background p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold uppercase text-muted-foreground">{stationLabel[ticket.station]}</p>
                              <h4 className="mt-1 text-xl font-black">{ticket.tableNumber === "Delivery" ? "Delivery" : `Mesa ${ticket.tableNumber}`}</h4>
                              <p className="mt-1 text-xs font-semibold text-muted-foreground">{resolveOrigin(ticket)}</p>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                              <Clock3 className="h-3.5 w-3.5" />
                              {formatElapsed(ticket.createdAt)}
                            </span>
                          </div>

                          <div className="mt-3 rounded-lg border bg-card p-3">
                            <p className="text-xs font-bold uppercase text-muted-foreground">Itens</p>
                            <div className="mt-2 space-y-2">
                              {ticket.items.slice(0, 3).map((item) => (
                                <div key={item.id} className="rounded-lg border bg-background px-3 py-2">
                                  <p className="text-sm font-black">{item.quantity}x {item.productName}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{item.notes || "Sem observacao"}</p>
                                </div>
                              ))}
                              {extraItems > 0 && (
                                <p className="text-xs font-semibold text-muted-foreground">+ {extraItems} item(ns) nesta comanda.</p>
                              )}
                            </div>
                          </div>

                          {activeSummary.status !== "delivered" && (
                            <button
                              type="button"
                              onClick={() => onAdvanceTicket(ticket.id)}
                              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-black text-primary-foreground"
                            >
                              {nextStatus === "delivered" ? <CheckCircle2 className="h-4 w-4" /> : <ChefHat className="h-4 w-4" />}
                              Marcar {statusLabel[nextStatus]}
                            </button>
                          )}
                        </article>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground xl:col-span-3">
                      Nenhuma comanda nesta etapa.
                    </div>
                  )}
                </div>

                {activeSummary.tickets.length > ticketsPerPage && (
                  <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setModalPage((current) => Math.max(0, current - 1))}
                      disabled={modalPage === 0}
                      className="rounded-lg border px-3 py-2 font-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <span className="font-bold">Pagina {modalPage + 1} de {totalModalPages}</span>
                    <button
                      type="button"
                      onClick={() => setModalPage((current) => Math.min(totalModalPages - 1, current + 1))}
                      disabled={modalPage >= totalModalPages - 1}
                      className="rounded-lg border px-3 py-2 font-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Proxima
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

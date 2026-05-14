import { Bell, CheckCircle2, ChefHat, Clock3 } from "lucide-react";
import type { KitchenStatus, KitchenTicket, Station } from "@/types";
import { formatElapsed, nextKitchenStatus, statusLabel } from "@/lib/foodMetrics";

interface KitchenDisplayProps {
  tickets: KitchenTicket[];
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

export function KitchenDisplay({ tickets, onAdvanceTicket }: KitchenDisplayProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-black">KDS cozinha e bar</h3>
          <p className="text-sm text-muted-foreground">Pedidos em tempo real separados por praca de producao.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-bold">
          <Bell className="h-4 w-4 text-warning" />
          {tickets.filter((ticket) => ticket.status === "received").length} novos
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((status) => {
          const columnTickets = tickets.filter((ticket) => ticket.status === status);
          return (
            <div key={status} className="rounded-lg border bg-card shadow-sm">
              <div className={`flex items-center justify-between rounded-t-lg border-b px-4 py-3 ${columnTone[status]}`}>
                <span className="text-sm font-black">{statusLabel[status]}</span>
                <span className="rounded-full bg-card/80 px-2 py-0.5 text-xs font-black">{columnTickets.length}</span>
              </div>
              <div className="max-h-[calc(100vh-240px)] space-y-3 overflow-y-auto p-3 scrollbar-thin">
                {columnTickets.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Sem pedidos.</p>
                ) : (
                  columnTickets.map((ticket) => (
                    <article key={ticket.id} className="rounded-lg border bg-background p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase text-muted-foreground">{stationLabel[ticket.station]}</p>
                          <h4 className="mt-1 text-xl font-black">Mesa {ticket.tableNumber}</h4>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatElapsed(ticket.createdAt)}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2">
                        {ticket.items.map((item) => (
                          <div key={item.id} className="rounded-lg border bg-card p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-black">
                                {item.quantity}x {item.productName}
                              </p>
                            </div>
                            {item.notes ? (
                              <p className="mt-2 rounded bg-warning/15 px-2 py-1 text-sm font-bold text-warning-foreground">
                                {item.notes}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      {status !== "delivered" ? (
                        <button
                          type="button"
                          onClick={() => onAdvanceTicket(ticket.id)}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-black text-primary-foreground"
                        >
                          {nextKitchenStatus(status) === "delivered" ? <CheckCircle2 className="h-4 w-4" /> : <ChefHat className="h-4 w-4" />}
                          Marcar {statusLabel[nextKitchenStatus(status)]}
                        </button>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { MapPin, MessageCircle, Timer, Truck } from "lucide-react";
import type { DeliveryOrder, DeliveryStatus } from "@/types";
import { currency, deliveryTotal, formatElapsed } from "@/lib/foodMetrics";

interface DeliveryPanelProps {
  deliveries: DeliveryOrder[];
  onAdvanceDelivery: (deliveryId: string) => void;
}

const deliveryLabel: Record<DeliveryStatus, string> = {
  new: "Novo",
  preparing: "Preparando",
  out: "Em rota",
  delivered: "Entregue",
};

const nextDelivery = (status: DeliveryStatus): DeliveryStatus => {
  if (status === "new") return "preparing";
  if (status === "preparing") return "out";
  if (status === "out") return "delivered";
  return "delivered";
};

export function DeliveryPanel({ deliveries, onAdvanceDelivery }: DeliveryPanelProps) {
  const columns: DeliveryStatus[] = ["new", "preparing", "out", "delivered"];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-black">Delivery</h3>
          <p className="text-sm text-muted-foreground">Pedido online, endereco, taxa, entregador e WhatsApp.</p>
        </div>
        <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
          <Truck className="h-4 w-4" />
          Novo pedido
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((status) => {
          const columnOrders = deliveries.filter((delivery) => delivery.status === status);
          return (
            <div key={status} className="rounded-lg border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h4 className="font-black">{deliveryLabel[status]}</h4>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-black">{columnOrders.length}</span>
              </div>
              <div className="space-y-3 p-3">
                {columnOrders.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Sem pedidos.</p>
                ) : (
                  columnOrders.map((delivery) => (
                    <article key={delivery.id} className="rounded-lg border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black">{delivery.customerName}</p>
                          <p className="text-xs font-semibold text-muted-foreground">{delivery.phone}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                          <Timer className="h-3.5 w-3.5" />
                          {formatElapsed(delivery.createdAt)}
                        </span>
                      </div>

                      <p className="mt-3 flex gap-2 rounded-lg bg-muted p-2 text-sm font-semibold">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {delivery.address}
                      </p>

                      <div className="mt-3 divide-y rounded-lg border bg-card">
                        {delivery.items.map((item) => (
                          <div key={item.id} className="flex justify-between gap-3 p-2 text-sm">
                            <span className="font-bold">{item.quantity}x {item.productName}</span>
                            <span>{currency.format(item.quantity * item.unitPrice)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-muted-foreground">Total</span>
                        <span className="text-lg font-black">{currency.format(deliveryTotal(delivery))}</span>
                      </div>

                      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                        {status !== "delivered" ? (
                          <button
                            type="button"
                            onClick={() => onAdvanceDelivery(delivery.id)}
                            className="rounded-lg bg-primary px-3 py-2 text-sm font-black text-primary-foreground"
                          >
                            Marcar {deliveryLabel[nextDelivery(status)]}
                          </button>
                        ) : (
                          <span className="rounded-lg bg-success/10 px-3 py-2 text-center text-sm font-black text-success">Concluido</span>
                        )}
                        <button type="button" aria-label={`Abrir WhatsApp de ${delivery.customerName}`} className="rounded-lg border bg-card px-3 py-2">
                          <MessageCircle className="h-4 w-4" />
                        </button>
                      </div>
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

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MapPin, MessageCircle, Plus, Timer, Truck, X } from "lucide-react";
import type { DeliveryOrder, DeliveryStatus, MenuProduct, PaymentMethod } from "@/types";
import { currency, deliveryTotal, formatElapsed } from "@/lib/foodMetrics";

interface DeliveryPanelProps {
  deliveries: DeliveryOrder[];
  products: MenuProduct[];
  onAdvanceDelivery: (deliveryId: string) => void;
  onCreateDelivery: (delivery: {
    customerName: string;
    phone: string;
    address: string;
    productId: string;
    quantity: number;
    deliveryFee: number;
    paymentMethod: PaymentMethod;
    note: string;
  }) => void;
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

const paymentMethodLabel: Record<PaymentMethod, string> = {
  pix: "Pix",
  card: "Cartao",
  cash: "Dinheiro",
  mixed: "Dividido",
  fiado: "Fiado",
};

const deliveryInputClassName = "h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2";
const deliveryLabelClassName = "text-xs font-black uppercase tracking-wide text-muted-foreground";

export function DeliveryPanel({ deliveries, products, onAdvanceDelivery, onCreateDelivery }: DeliveryPanelProps) {
  const columns: DeliveryStatus[] = ["new", "preparing", "out", "delivered"];
  const activeProducts = useMemo(() => products.filter((product) => product.active), [products]);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    address: "",
    productId: activeProducts[0]?.id ?? "",
    quantity: "1",
    deliveryFee: "8",
    paymentMethod: "pix" as PaymentMethod,
    note: "",
  });
  const selectedProduct = activeProducts.find((product) => product.id === form.productId) ?? activeProducts[0];
  const quantity = Math.max(1, Number(form.quantity.replace(",", ".")) || 1);
  const deliveryFee = Math.max(0, Number(form.deliveryFee.replace(",", ".")) || 0);
  const previewTotal = selectedProduct ? selectedProduct.price * quantity + deliveryFee : deliveryFee;

  useEffect(() => {
    if (!newOrderOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [newOrderOpen]);

  const closeNewOrder = () => {
    setNewOrderOpen(false);
  };

  const submitNewOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProduct || !form.customerName.trim() || !form.phone.trim() || !form.address.trim()) return;

    onCreateDelivery({
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      productId: selectedProduct.id,
      quantity,
      deliveryFee,
      paymentMethod: form.paymentMethod,
      note: form.note.trim(),
    });

    setForm({
      customerName: "",
      phone: "",
      address: "",
      productId: activeProducts[0]?.id ?? "",
      quantity: "1",
      deliveryFee: "8",
      paymentMethod: "pix",
      note: "",
    });
    closeNewOrder();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-2xl font-black">Delivery</h3>
          <p className="text-sm text-muted-foreground">Pedido online, endereco, taxa, entregador e WhatsApp.</p>
        </div>
        <button
          type="button"
          onClick={() => setNewOrderOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground"
        >
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
                        <button
                          type="button"
                          aria-label={`Abrir WhatsApp de ${delivery.customerName}`}
                          onClick={() => window.open(`https://wa.me/55${delivery.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")}
                          className="rounded-lg border bg-card px-3 py-2"
                        >
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

      {newOrderOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-foreground/60 p-3"
          onClick={closeNewOrder}
        >
          <form
            onSubmit={submitNewOrder}
            className="w-full max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-panel"
            style={{ maxHeight: "calc(100dvh - 24px)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b p-4 sm:p-5">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Novo delivery</p>
                <h3 className="text-2xl font-black sm:text-3xl">Cadastrar pedido de entrega</h3>
                <p className="mt-1 text-sm text-muted-foreground">Cliente, endereco, produto e pagamento em um fluxo unico.</p>
              </div>
              <button
                type="button"
                onClick={closeNewOrder}
                data-modal-close="true"
                className="grid h-10 w-10 place-items-center rounded-lg border bg-background text-muted-foreground"
                aria-label="Fechar novo pedido"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_320px]">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className={deliveryLabelClassName}>Nome do cliente</span>
                  <input
                    value={form.customerName}
                    onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                    className={deliveryInputClassName}
                    placeholder="Ex: Paulo Nunes"
                    required
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={deliveryLabelClassName}>Telefone / WhatsApp</span>
                  <input
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    className={deliveryInputClassName}
                    placeholder="Ex: 11977776666"
                    required
                  />
                </label>
                <label className="grid gap-1.5 md:col-span-2">
                  <span className={deliveryLabelClassName}>Endereco de entrega</span>
                  <input
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    className={deliveryInputClassName}
                    placeholder="Rua, numero, bairro e complemento"
                    required
                  />
                </label>
                <label className="grid gap-1.5 md:col-span-2">
                  <span className={deliveryLabelClassName}>Produto do pedido</span>
                  <select
                    value={selectedProduct?.id ?? ""}
                    onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value }))}
                    className={deliveryInputClassName}
                  >
                    {activeProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {currency.format(product.price)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className={deliveryLabelClassName}>Quantidade</span>
                  <input
                    value={form.quantity}
                    onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                    className={deliveryInputClassName}
                    inputMode="numeric"
                    placeholder="Ex: 2"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={deliveryLabelClassName}>Taxa de entrega</span>
                  <input
                    value={form.deliveryFee}
                    onChange={(event) => setForm((current) => ({ ...current, deliveryFee: event.target.value }))}
                    className={deliveryInputClassName}
                    inputMode="decimal"
                    placeholder="Ex: 8"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className={deliveryLabelClassName}>Forma de pagamento</span>
                  <select
                    value={form.paymentMethod}
                    onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod }))}
                    className={deliveryInputClassName}
                  >
                    {Object.entries(paymentMethodLabel).map(([method, label]) => (
                      <option key={method} value={method}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className={deliveryLabelClassName}>Observacao para cozinha</span>
                  <input
                    value={form.note}
                    onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    className={deliveryInputClassName}
                    placeholder="Ex: sem cebola"
                  />
                </label>
              </div>

              <aside className="rounded-lg border bg-background p-4">
                <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Resumo do pedido</p>
                <h4 className="mt-3 text-xl font-black">{selectedProduct?.name ?? "Selecione um produto"}</h4>
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Itens</span>
                    <span className="font-black">{quantity}x</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Entrega</span>
                    <span className="font-black">{currency.format(deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-t pt-3">
                    <span className="font-black">Total previsto</span>
                    <span className="font-black text-primary">{currency.format(previewTotal)}</span>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={!selectedProduct}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Criar pedido
                </button>
              </aside>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

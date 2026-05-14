import { useMemo, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, Percent, QrCode, ReceiptText, Scissors } from "lucide-react";
import type { FoodOrder, FoodTable, PaymentMethod } from "@/types";
import {
  currency,
  itemTotal,
  orderServiceFee,
  orderSubtotal,
  orderTotal,
  sortOrdersByTableNumber,
  sortTablesByNumber,
} from "@/lib/foodMetrics";

interface CheckoutPanelProps {
  orders: FoodOrder[];
  tables: FoodTable[];
  selectedOrderId: string;
  splitCount: number;
  onSelectOrder: (orderId: string) => void;
  onSplitCountChange: (count: number) => void;
  onCloseOrder: (
    orderId: string,
    method: PaymentMethod,
    details: { discount: number; cashReceived: number; paidBy: string },
  ) => void;
}

const paymentMethods: Array<{ id: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { id: "pix", label: "Pix", icon: QrCode },
  { id: "card", label: "Cartao", icon: CreditCard },
  { id: "cash", label: "Dinheiro", icon: Banknote },
  { id: "mixed", label: "Dividido", icon: Scissors },
  { id: "fiado", label: "Fiado", icon: ReceiptText },
];

export function CheckoutPanel({
  orders,
  tables,
  selectedOrderId,
  splitCount,
  onSelectOrder,
  onSplitCountChange,
  onCloseOrder,
}: CheckoutPanelProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [discountInput, setDiscountInput] = useState("");
  const [discountType, setDiscountType] = useState<"value" | "percent">("value");
  const [cashReceivedInput, setCashReceivedInput] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [confirming, setConfirming] = useState(false);
  const payableOrders = useMemo(
    () => sortOrdersByTableNumber(orders.filter((order) => order.status !== "paid"), tables),
    [orders, tables],
  );
  const selectedOrder = payableOrders.find((order) => order.id === selectedOrderId) ?? payableOrders[0];
  const selectedTable = selectedOrder ? tables.find((table) => table.id === selectedOrder.tableId) : null;
  const subtotal = selectedOrder ? orderSubtotal(selectedOrder) : 0;
  const serviceFee = selectedOrder ? orderServiceFee(selectedOrder) : 0;
  const rawDiscount = Number(discountInput.replace(",", ".")) || 0;
  const checkoutDiscount = selectedOrder
    ? Math.min(subtotal + serviceFee, discountType === "percent" ? (subtotal + serviceFee) * (rawDiscount / 100) : rawDiscount + selectedOrder.discount)
    : 0;
  const baseTotal = selectedOrder ? orderTotal({ ...selectedOrder, discount: 0 }) : 0;
  const total = Math.max(0, baseTotal - checkoutDiscount);
  const splitValue = splitCount > 0 ? total / splitCount : total;
  const cashReceived = Number(cashReceivedInput.replace(",", ".")) || 0;
  const change = paymentMethod === "cash" ? Math.max(0, cashReceived - total) : 0;
  const canClose = Boolean(selectedOrder && paymentMethod && (paymentMethod !== "cash" || cashReceived >= total));

  const handleClose = () => {
    if (!selectedOrder || !canClose) return;
    onCloseOrder(selectedOrder.id, paymentMethod, {
      discount: checkoutDiscount,
      cashReceived: paymentMethod === "cash" ? cashReceived : total,
      paidBy: paidBy.trim() || selectedOrder.customerName,
    });
    setConfirming(false);
    setDiscountInput("");
    setPaymentMethod("pix");
    setCashReceivedInput("");
    setPaidBy("");
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <aside className="rounded-lg border bg-card shadow-sm">
        <div className="border-b p-4">
          <h3 className="text-2xl font-black">Contas abertas</h3>
          <p className="text-sm text-muted-foreground">Mesas sempre em ordem numerica no fechamento.</p>
        </div>
        <div className="max-h-[calc(100vh-220px)] divide-y overflow-y-auto scrollbar-thin">
          {payableOrders.map((order) => {
            const table = tables.find((item) => item.id === order.tableId);
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => onSelectOrder(order.id)}
                className={`w-full p-4 text-left transition hover:bg-muted ${
                  selectedOrder?.id === order.id ? "bg-primary/10" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black">Mesa {table?.number ?? "?"}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.items.filter((item) => item.status !== "cancelled").length} itens - {order.status}
                    </p>
                  </div>
                  <span className="font-black">{currency.format(orderTotal(order))}</span>
                </div>
              </button>
            );
          })}
          {payableOrders.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma comanda aberta.</p>
          )}
        </div>
      </aside>

      <div className="rounded-lg border bg-card shadow-panel">
        {selectedOrder ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Fechamento estilo PDV</p>
                <h3 className="text-3xl font-black">Mesa {selectedTable?.number ?? "?"}</h3>
              </div>
              <span className="rounded-lg bg-primary px-4 py-2 text-2xl font-black text-primary-foreground">
                {currency.format(total)}
              </span>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[1fr_330px]">
              <div className="space-y-4">
                <div className="rounded-lg border">
                  <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-black">
                    <ReceiptText className="h-4 w-4" />
                    Itens da comanda
                  </div>
                  <div className="divide-y">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className={`flex items-start justify-between gap-4 p-4 ${item.status === "cancelled" ? "opacity-60" : ""}`}>
                        <div className="min-w-0">
                          <p className="font-bold">{item.quantity}x {item.productName}</p>
                          <p className="text-sm text-muted-foreground">{item.notes || "Sem observacao"}</p>
                          {item.selectedOptions.length > 0 && (
                            <p className="text-xs font-bold text-primary">{item.selectedOptions.join(" | ")}</p>
                          )}
                        </div>
                        <span className="font-black">{currency.format(itemTotal(item))}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-background p-4">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Subtotal</p>
                    <p className="mt-2 text-xl font-black">{currency.format(subtotal)}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <p className="flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground">
                      <Percent className="h-3.5 w-3.5" />
                      Servico
                    </p>
                    <p className="mt-2 text-xl font-black">{currency.format(serviceFee)}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-4">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Desconto</p>
                    <p className="mt-2 text-xl font-black">{currency.format(checkoutDiscount)}</p>
                  </div>
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-lg border bg-background p-4">
                  <label htmlFor="split-count" className="text-xs font-bold uppercase text-muted-foreground">
                    Dividir conta
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id="split-count"
                      type="number"
                      min={1}
                      max={20}
                      value={splitCount}
                      onChange={(event) => onSplitCountChange(Math.max(1, Number(event.target.value) || 1))}
                      className="h-11 w-24 rounded-lg border bg-card px-3 text-lg font-black outline-none ring-primary focus:ring-2"
                    />
                    <span className="text-sm font-bold text-muted-foreground">x {currency.format(splitValue)}</span>
                  </div>
                </div>

                <div className="rounded-lg border bg-background p-4">
                  <label htmlFor="checkout-discount" className="text-xs font-bold uppercase text-muted-foreground">
                    Desconto
                  </label>
                  <div className="mt-2 grid grid-cols-[1fr_86px] gap-2">
                    <input
                      id="checkout-discount"
                      type="text"
                      inputMode="decimal"
                      value={discountInput}
                      onChange={(event) => setDiscountInput(event.target.value)}
                      className="h-11 rounded-lg border bg-card px-3 text-sm font-bold outline-none ring-primary focus:ring-2"
                      placeholder="0,00"
                    />
                    <select
                      value={discountType}
                      onChange={(event) => setDiscountType(event.target.value as "value" | "percent")}
                      className="h-11 rounded-lg border bg-card px-3 text-sm font-black outline-none ring-primary focus:ring-2"
                    >
                      <option value="value">R$</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-2">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    const active = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`inline-flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left font-black transition ${
                          active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {method.label}
                        </span>
                        <span>{currency.format(total)}</span>
                      </button>
                    );
                  })}
                </div>

                {paymentMethod === "cash" && (
                  <div className="rounded-lg border bg-background p-4">
                    <label htmlFor="cash-received" className="text-xs font-bold uppercase text-muted-foreground">
                      Valor recebido
                    </label>
                    <input
                      id="cash-received"
                      type="text"
                      inputMode="decimal"
                      value={cashReceivedInput}
                      onChange={(event) => setCashReceivedInput(event.target.value)}
                      className="mt-2 h-11 w-full rounded-lg border bg-card px-3 font-black outline-none ring-primary focus:ring-2"
                      placeholder="0,00"
                    />
                    <p className="mt-2 text-sm font-black text-primary">Troco: {currency.format(change)}</p>
                  </div>
                )}

                <div className="rounded-lg border bg-background p-4">
                  <label htmlFor="paid-by" className="text-xs font-bold uppercase text-muted-foreground">
                    Pago por
                  </label>
                  <input
                    id="paid-by"
                    value={paidBy}
                    onChange={(event) => setPaidBy(event.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border bg-card px-3 text-sm font-bold outline-none ring-primary focus:ring-2"
                    placeholder={selectedOrder.customerName}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={!canClose}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finalizar comanda
                </button>
              </aside>
            </div>

            {confirming && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
                <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-panel">
                  <h4 className="text-xl font-black">Finalizar mesa {selectedTable?.number ?? "?"}?</h4>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Confirma o pagamento de {currency.format(total)} em {paymentMethods.find((method) => method.id === paymentMethod)?.label}?
                  </p>
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="rounded-lg border bg-background px-4 py-2 text-sm font-black"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground"
                    >
                      Confirmar pagamento
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center text-muted-foreground">Nenhuma comanda aberta.</div>
        )}
      </div>

      <div className="sr-only">
        {sortTablesByNumber(tables).map((table) => table.number).join(", ")}
      </div>
    </section>
  );
}

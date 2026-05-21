import { useEffect, useMemo, useState } from "react";
import { Banknote, CheckCircle2, CreditCard, Percent, Plus, Printer, QrCode, ReceiptText, Scissors, Trash2, X } from "lucide-react";
import type { FoodOrder, FoodTable, PaymentMethod, PaymentSplit } from "@/types";
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
    details: { discount: number; cashReceived: number; paidBy: string; paymentSplits?: PaymentSplit[] },
  ) => void;
}

const paymentMethods: Array<{ id: PaymentMethod; label: string; icon: typeof Banknote }> = [
  { id: "pix", label: "Pix", icon: QrCode },
  { id: "debit", label: "Debito", icon: CreditCard },
  { id: "credit", label: "Credito", icon: CreditCard },
  { id: "voucher", label: "Voucher", icon: ReceiptText },
  { id: "cash", label: "Dinheiro", icon: Banknote },
  { id: "mixed", label: "Dividido", icon: Scissors },
  { id: "fiado", label: "Fiado", icon: ReceiptText },
];
const splitMethods: Array<{ id: PaymentMethod; label: string }> = [
  { id: "cash", label: "Dinheiro" },
  { id: "pix", label: "Pix" },
  { id: "debit", label: "Debito" },
  { id: "credit", label: "Credito" },
  { id: "voucher", label: "Voucher" },
];

const paymentMethodLabels = Object.fromEntries(paymentMethods.map((method) => [method.id, method.label])) as Record<
  PaymentMethod,
  string
>;

const stationLabels: Record<FoodOrder["items"][number]["station"], string> = {
  kitchen: "Cozinha",
  bar: "Bar",
  counter: "Balcao",
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const receiptDate = (iso?: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso ?? Date.now()));

const buildCheckoutReceiptHtml = ({
  order,
  table,
  subtotal,
  serviceFee,
  discount,
  total,
  splitCount,
  splitValue,
  method,
  paidBy,
  cashReceived,
  change,
  paymentSplits,
}: {
  order: FoodOrder;
  table: FoodTable | null;
  subtotal: number;
  serviceFee: number;
  discount: number;
  total: number;
  splitCount: number;
  splitValue: number;
  method: PaymentMethod;
  paidBy: string;
  cashReceived: number;
  change: number;
  paymentSplits?: PaymentSplit[];
}) => {
  const activeItems = order.items.filter((item) => item.status !== "cancelled");
  const sectors = Array.from(new Set(activeItems.map((item) => stationLabels[item.station]))).join(", ") || "Balcao";
  const paymentLines =
    method === "mixed" && paymentSplits?.length
      ? paymentSplits
          .map(
            (part) => `
              <div class="row">
                <span>${escapeHtml(paymentMethodLabels[part.method] ?? part.label)}</span>
                <strong>${currency.format(part.amount)}</strong>
              </div>
            `,
          )
          .join("")
      : `
        <div class="row">
          <span>${escapeHtml(paymentMethodLabels[method] ?? method)}</span>
          <strong>${currency.format(method === "cash" ? cashReceived : total)}</strong>
        </div>
      `;
  const itemRows = activeItems
    .map(
      (item) => `
        <section class="item">
          <div class="row item-title">
            <strong>${escapeHtml(`${item.quantity}x ${item.productName}`)}</strong>
            <strong>${currency.format(itemTotal(item))}</strong>
          </div>
          <div class="muted">${escapeHtml(stationLabels[item.station])} | ${currency.format(item.unitPrice)} un.</div>
          ${item.selectedOptions.length ? `<div class="muted">${escapeHtml(item.selectedOptions.join(" | "))}</div>` : ""}
          ${item.notes ? `<div class="muted">Obs: ${escapeHtml(item.notes)}</div>` : ""}
        </section>
      `,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Cupom HappyCashFood</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      * { box-sizing: border-box; }
      body {
        width: 72mm;
        margin: 0 auto;
        background: #fff;
        color: #111;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 11px;
        line-height: 1.35;
      }
      .center { text-align: center; }
      .brand { font-size: 17px; font-weight: 900; letter-spacing: 0; }
      .muted { color: #555; }
      .divider { border-top: 1px dashed #111; margin: 8px 0; }
      .row { display: flex; justify-content: space-between; gap: 8px; }
      .row span:first-child, .row strong:first-child { min-width: 0; overflow-wrap: anywhere; }
      .item { padding: 5px 0; border-bottom: 1px dotted #999; }
      .item-title { align-items: flex-start; }
      .total { font-size: 15px; font-weight: 900; }
      .footer { margin-top: 10px; text-align: center; }
    </style>
  </head>
  <body>
    <header class="center">
      <div class="brand">HappyCashFood</div>
      <div class="muted">Cupom interno de fechamento</div>
    </header>
    <div class="divider"></div>
    <div class="row"><span>Mesa</span><strong>${escapeHtml(table?.number ?? "?")}</strong></div>
    <div class="row"><span>Cliente</span><strong>${escapeHtml(order.customerName || `Mesa ${table?.number ?? "?"}`)}</strong></div>
    <div class="row"><span>Garcom</span><strong>${escapeHtml(order.waiterName || "-")}</strong></div>
    <div class="row"><span>Pago por</span><strong>${escapeHtml(paidBy)}</strong></div>
    <div class="row"><span>Abertura</span><strong>${escapeHtml(receiptDate(order.openedAt))}</strong></div>
    <div class="row"><span>Fechamento</span><strong>${escapeHtml(receiptDate())}</strong></div>
    <div class="row"><span>Setores</span><strong>${escapeHtml(sectors)}</strong></div>
    <div class="divider"></div>
    ${itemRows || '<div class="center muted">Nenhum item ativo.</div>'}
    <div class="divider"></div>
    <div class="row"><span>Subtotal</span><strong>${currency.format(subtotal)}</strong></div>
    <div class="row"><span>Servico</span><strong>${currency.format(serviceFee)}</strong></div>
    <div class="row"><span>Desconto</span><strong>${currency.format(discount)}</strong></div>
    <div class="row"><span>Divisao</span><strong>${splitCount}x ${currency.format(splitValue)}</strong></div>
    <div class="row total"><span>Total</span><strong>${currency.format(total)}</strong></div>
    <div class="divider"></div>
    <strong>Pagamento</strong>
    ${paymentLines}
    ${method === "cash" ? `<div class="row"><span>Troco</span><strong>${currency.format(change)}</strong></div>` : ""}
    <div class="footer muted">Operacao registrada no HappyCashFood</div>
  </body>
</html>`;
};

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
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [printReceiptEnabled, setPrintReceiptEnabled] = useState(true);
  const [printStatus, setPrintStatus] = useState("");
  const [closingOrder, setClosingOrder] = useState(false);
  const [itemsPage, setItemsPage] = useState(0);
  const [paymentParts, setPaymentParts] = useState<PaymentSplit[]>([
    { id: "part-cash", label: "Dinheiro", method: "cash", amount: 0 },
    { id: "part-pix", label: "Pix", method: "pix", amount: 0 },
  ]);
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
  const mixedPaid = paymentParts.reduce((sum, part) => sum + part.amount, 0);
  const mixedRemaining = Math.max(0, total - mixedPaid);
  const canClose = Boolean(
    selectedOrder &&
      paymentMethod &&
      (paymentMethod !== "cash" || cashReceived >= total) &&
      (paymentMethod !== "mixed" || mixedPaid >= total),
  );
  const selectedOrderItems = selectedOrder?.items ?? [];
  const itemsPerPage = 3;
  const totalItemPages = Math.max(1, Math.ceil(selectedOrderItems.length / itemsPerPage));
  const visibleItems = selectedOrderItems.slice(itemsPage * itemsPerPage, itemsPage * itemsPerPage + itemsPerPage);
  const itemPageNumbers = Array.from({ length: totalItemPages }, (_, index) => index);

  useEffect(() => {
    setItemsPage(0);
  }, [selectedOrder?.id, checkoutModalOpen]);

  const closeModal = () => {
    setCheckoutModalOpen(false);
    setConfirming(false);
    setConfirmExitOpen(false);
    setPrintStatus("");
    setClosingOrder(false);
    setItemsPage(0);
  };

  const openOrderModal = (orderId: string) => {
    onSelectOrder(orderId);
    setCheckoutModalOpen(true);
    setConfirming(false);
    setConfirmExitOpen(false);
    setPrintStatus("");
    setClosingOrder(false);
    setItemsPage(0);
  };

  const requestModalClose = () => {
    if (!checkoutModalOpen) return;
    setConfirmExitOpen(true);
  };

  const updatePaymentPart = (partId: string, patch: Partial<PaymentSplit>) => {
    setPaymentParts((currentParts) =>
      currentParts.map((part) => (part.id === partId ? { ...part, ...patch } : part)),
    );
  };

  const addPaymentPart = () => {
    const method = splitMethods[0];
    setPaymentParts((currentParts) => [
      ...currentParts,
      {
        id: `part-${Date.now()}`,
        label: method.label,
        method: method.id,
        amount: mixedRemaining,
      },
    ]);
  };

  const removePaymentPart = (partId: string) => {
    setPaymentParts((currentParts) => currentParts.filter((part) => part.id !== partId));
  };

  const printCheckoutReceipt = async (paymentSplits?: PaymentSplit[]) => {
    if (!selectedOrder) return false;
    const receiptHtml = buildCheckoutReceiptHtml({
      order: selectedOrder,
      table: selectedTable,
      subtotal,
      serviceFee,
      discount: checkoutDiscount,
      total,
      splitCount,
      splitValue,
      method: paymentMethod,
      paidBy: paidBy.trim() || selectedOrder.customerName,
      cashReceived: paymentMethod === "cash" ? cashReceived : total,
      change,
      paymentSplits,
    });

    setPrintStatus("Enviando cupom para impressao...");

    try {
      if (typeof window.electronAPI?.printHtml === "function") {
        const printed = await window.electronAPI.printHtml(receiptHtml);
        setPrintStatus(printed ? "Cupom enviado para a impressora." : "Nao foi possivel imprimir no desktop.");
        return printed;
      }

      const printWindow = window.open("", "_blank", "width=420,height=720");
      if (!printWindow) {
        setPrintStatus("O navegador bloqueou a janela de impressao.");
        return false;
      }

      printWindow.document.open();
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      setPrintStatus("Cupom aberto para impressao no navegador.");
      return true;
    } catch {
      setPrintStatus("Nao foi possivel preparar o cupom para impressao.");
      return false;
    }
  };

  const resetCheckoutForm = () => {
    setConfirming(false);
    setConfirmExitOpen(false);
    setCheckoutModalOpen(false);
    setDiscountInput("");
    setPaymentMethod("pix");
    setCashReceivedInput("");
    setPaidBy("");
    setPaymentParts([
      { id: "part-cash", label: "Dinheiro", method: "cash", amount: 0 },
      { id: "part-pix", label: "Pix", method: "pix", amount: 0 },
    ]);
    setPrintStatus("");
    setClosingOrder(false);
    setItemsPage(0);
  };

  const handleClose = async () => {
    if (!selectedOrder || !canClose) return;
    const paymentSplits = paymentMethod === "mixed" ? paymentParts.filter((part) => part.amount > 0) : undefined;
    const details = {
      discount: checkoutDiscount,
      cashReceived: paymentMethod === "cash" ? cashReceived : paymentMethod === "mixed" ? mixedPaid : total,
      paidBy: paidBy.trim() || selectedOrder.customerName,
      paymentSplits,
    };

    setClosingOrder(true);
    if (printReceiptEnabled) {
      const printed = await printCheckoutReceipt(paymentSplits);
      if (!printed) {
        setClosingOrder(false);
        return;
      }
    }

    onCloseOrder(selectedOrder.id, paymentMethod, details);
    resetCheckoutForm();
  };

  return (
    <section className="space-y-3 sm:space-y-4">
      <div>
        <h3 className="text-2xl font-black">Caixa por mesa</h3>
        <p className="text-sm text-muted-foreground">Selecione uma mesa para abrir o fechamento em modal.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {payableOrders.map((order) => {
          const table = tables.find((item) => item.id === order.tableId);
          return (
            <button
              key={order.id}
              type="button"
              onClick={() => openOrderModal(order.id)}
              className={`rounded-lg border bg-card p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-panel sm:p-4 ${
                selectedOrder?.id === order.id && checkoutModalOpen ? "ring-2 ring-primary" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Mesa</p>
                  <p className="mt-1 text-2xl font-black sm:text-3xl">{table?.number ?? "?"}</p>
                </div>
                <span className="rounded-full border bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {order.items.filter((item) => item.status !== "cancelled").length} itens
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3 sm:mt-4">
                <span className="text-sm font-semibold text-muted-foreground">{order.customerName || `Mesa ${table?.number ?? "?"}`}</span>
                <span className="text-lg font-black">{currency.format(orderTotal(order))}</span>
              </div>
            </button>
          );
        })}
        {payableOrders.length === 0 && (
          <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground sm:p-8">
            Nenhuma comanda aberta.
          </div>
        )}
      </div>

      {checkoutModalOpen && selectedOrder && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-2 sm:p-4"
          onClick={requestModalClose}
        >
          <div
            className="w-full max-w-6xl rounded-2xl border bg-card shadow-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
              <div>
                <h3 className="text-2xl font-black sm:text-3xl">Mesa {selectedTable?.number ?? "?"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Fechamento rapido sem rolagem horizontal ou vertical.</p>
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span className="rounded-lg bg-primary px-3 py-1.5 text-xl font-black text-primary-foreground sm:px-4 sm:py-2 sm:text-2xl">
                  {currency.format(total)}
                </span>
                <button
                  type="button"
                  onClick={requestModalClose}
                  data-modal-close="true"
                  className="grid h-9 w-9 place-items-center rounded-lg border bg-background text-muted-foreground sm:h-10 sm:w-10"
                  aria-label="Fechar fechamento"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Cliente</p>
                    <p className="mt-2 font-black">{selectedOrder.customerName}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Itens</p>
                    <p className="mt-2 text-2xl font-black">{selectedOrderItems.length}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Divisao</p>
                    <p className="mt-2 font-black">{splitCount}x de {currency.format(splitValue)}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Pago por</p>
                    <p className="mt-2 font-black">{paidBy.trim() || selectedOrder.customerName}</p>
                  </div>
                </div>

                <div className="rounded-lg border bg-background">
                  <div className="flex items-center justify-between border-b px-3 py-2.5 text-sm font-black sm:px-4 sm:py-3">
                    <span className="inline-flex items-center gap-2">
                      <ReceiptText className="h-4 w-4" />
                      Itens da comanda
                    </span>
                    <span>Pagina {itemsPage + 1} de {totalItemPages}</span>
                  </div>
                  <div className="grid gap-3 p-3 lg:grid-cols-2">
                    {visibleItems.map((item) => (
                      <div key={item.id} className={`rounded-lg border bg-card p-3 ${item.status === "cancelled" ? "opacity-60" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold">{item.quantity}x {item.productName}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{item.notes || "Sem observacao"}</p>
                            {item.selectedOptions.length > 0 && (
                              <p className="mt-1 truncate text-xs font-bold text-primary">{item.selectedOptions.join(" | ")}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-sm font-black sm:text-base">{currency.format(itemTotal(item))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrderItems.length > itemsPerPage && (
                  <div className="space-y-2 rounded-lg border bg-background px-3 py-2 text-sm">
                    <div className="flex flex-wrap gap-2">
                      {itemPageNumbers.map((page) => (
                        <button
                          key={`checkout-page-${page}`}
                          type="button"
                          onClick={() => setItemsPage(page)}
                          className={`rounded-lg border px-3 py-1.5 font-black transition ${
                            itemsPage === page
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card text-muted-foreground hover:border-primary hover:text-foreground"
                          }`}
                        >
                          {page + 1}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setItemsPage((current) => Math.max(0, current - 1))}
                      disabled={itemsPage === 0}
                      className="rounded-lg border px-3 py-2 font-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <span className="font-bold">Itens {itemsPage * itemsPerPage + 1} a {Math.min(selectedOrderItems.length, (itemsPage + 1) * itemsPerPage)}</span>
                    <button
                      type="button"
                      onClick={() => setItemsPage((current) => Math.min(totalItemPages - 1, current + 1))}
                      disabled={itemsPage >= totalItemPages - 1}
                      className="rounded-lg border px-3 py-2 font-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Proxima
                    </button>
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-background p-3 sm:p-4">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Subtotal</p>
                    <p className="mt-2 text-lg font-black sm:text-xl">{currency.format(subtotal)}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-3 sm:p-4">
                    <p className="flex items-center gap-1 text-xs font-bold uppercase text-muted-foreground">
                      <Percent className="h-3.5 w-3.5" />
                      Servico
                    </p>
                    <p className="mt-2 text-lg font-black sm:text-xl">{currency.format(serviceFee)}</p>
                  </div>
                  <div className="rounded-lg border bg-background p-3 sm:p-4">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Desconto</p>
                    <p className="mt-2 text-lg font-black sm:text-xl">{currency.format(checkoutDiscount)}</p>
                  </div>
                </div>
              </div>

              <aside className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-background p-3">
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

                  <div className="rounded-lg border bg-background p-3">
                    <label htmlFor="checkout-discount" className="text-xs font-bold uppercase text-muted-foreground">
                      Desconto
                    </label>
                    <div className="mt-2 grid grid-cols-[1fr_78px] gap-2">
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
                </div>

                <div className="rounded-lg border bg-background p-3">
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

                {paymentMethod === "cash" && (
                  <div className="rounded-lg border bg-background p-3">
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

                {paymentMethod === "mixed" && (
                  <div className="rounded-lg border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold uppercase text-muted-foreground">Multiplos pagamentos</p>
                      <button type="button" onClick={addPaymentPart} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-black">
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {paymentParts.map((part) => (
                        <div key={part.id} className="grid grid-cols-[1fr_96px_auto] gap-2">
                          <select
                            value={part.method}
                            onChange={(event) => {
                              const method = splitMethods.find((entry) => entry.id === event.target.value) || splitMethods[0];
                              updatePaymentPart(part.id, { method: method.id, label: method.label });
                            }}
                            className="h-10 rounded-lg border bg-card px-2 text-xs font-black outline-none ring-primary focus:ring-2"
                          >
                            {splitMethods.map((method) => (
                              <option key={method.id} value={method.id}>
                                {method.label}
                              </option>
                            ))}
                          </select>
                          <input
                            value={part.amount || ""}
                            onChange={(event) => updatePaymentPart(part.id, { amount: Number(event.target.value.replace(",", ".")) || 0 })}
                            className="h-10 rounded-lg border bg-card px-2 text-sm font-black outline-none ring-primary focus:ring-2"
                            inputMode="decimal"
                            placeholder="0,00"
                          />
                          <button type="button" onClick={() => removePaymentPart(part.id)} className="grid h-10 w-10 place-items-center rounded-lg border bg-card text-muted-foreground" aria-label="Remover forma">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-black">
                      <p className="rounded-lg bg-muted p-2">Pago: {currency.format(mixedPaid)}</p>
                      <p className="rounded-lg bg-muted p-2">Falta: {currency.format(mixedRemaining)}</p>
                    </div>
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    const active = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`inline-flex items-center justify-between gap-3 rounded-lg border px-3 py-3 text-left text-sm font-black transition ${
                          active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {method.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
                  Esc fecha o modal. Tab percorre os campos. O menu lateral continua com atalhos numericos.
                </div>

                <div className="rounded-lg border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-black">
                      <Printer className="h-4 w-4" />
                      Cupom
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrintReceiptEnabled((current) => !current)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-black ${
                        printReceiptEnabled ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                      }`}
                    >
                      {printReceiptEnabled ? "Imprimir ao fechar" : "Sem impressao"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void printCheckoutReceipt(paymentMethod === "mixed" ? paymentParts.filter((part) => part.amount > 0) : undefined)}
                    disabled={closingOrder}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Printer className="h-4 w-4" />
                    Imprimir agora
                  </button>
                  {printStatus && <p className="mt-2 text-xs font-bold text-muted-foreground">{printStatus}</p>}
                </div>

                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={!canClose || closingOrder}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finalizar comanda
                </button>
              </aside>
            </div>
          </div>
        </div>
      )}

      {confirming && selectedOrder && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-foreground/60 p-3 sm:p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-card p-4 shadow-panel sm:rounded-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="text-xl font-black">Finalizar mesa {selectedTable?.number ?? "?"}?</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              Confirma o pagamento de {currency.format(total)} em {paymentMethods.find((method) => method.id === paymentMethod)?.label}?
            </p>
            {printStatus && <p className="mt-3 rounded-lg border bg-background p-3 text-xs font-bold text-muted-foreground">{printStatus}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                data-modal-close="true"
                disabled={closingOrder}
                className="rounded-lg border bg-background px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => void handleClose()}
                disabled={closingOrder}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {closingOrder ? "Finalizando..." : printReceiptEnabled ? "Confirmar e imprimir" : "Confirmar pagamento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmExitOpen && selectedOrder && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-foreground/70 p-3 sm:p-4"
          onClick={() => setConfirmExitOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border bg-card p-4 shadow-panel sm:rounded-2xl sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h4 className="text-xl font-black">Sair do fechamento?</h4>
            <p className="mt-2 text-sm text-muted-foreground">
              A tela de pagamento e sensivel. Deseja sair da mesa {selectedTable?.number ?? "?"} sem concluir a cobranca agora?
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmExitOpen(false)}
                data-modal-close="true"
                className="rounded-lg border bg-background px-4 py-2 text-sm font-black"
              >
                Continuar fechamento
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground"
              >
                Sair do modal
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sr-only">
        {sortTablesByNumber(tables).map((table) => table.number).join(", ")}
      </div>
    </section>
  );
}

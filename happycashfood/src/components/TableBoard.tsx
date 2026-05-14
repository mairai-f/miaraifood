import { useMemo, useState } from "react";
import { ArrowRightLeft, Clock, LockKeyhole, Plus, ReceiptText, Search, Trash2, UsersRound } from "lucide-react";
import type { FoodOrder, FoodRole, FoodTable, MenuProduct } from "@/types";
import {
  currency,
  formatElapsed,
  orderTotal,
  productMatchesSearch,
  productPriceLabel,
  sortTablesByNumber,
  statusLabel,
  statusTone,
  tableOrder,
} from "@/lib/foodMetrics";

interface TableBoardProps {
  tables: FoodTable[];
  orders: FoodOrder[];
  products: MenuProduct[];
  role: FoodRole;
  selectedTableId: string;
  note: string;
  transferTargetId: string;
  onSelectTable: (tableId: string) => void;
  onOpenTable: (tableId: string) => void;
  onAddProduct: (product: MenuProduct) => void;
  onNoteChange: (note: string) => void;
  onTransferTargetChange: (tableId: string) => void;
  onTransferTable: () => void;
  onSetClosing: () => void;
  onRemoveItem: (orderId: string, itemId: string) => void;
}

export function TableBoard({
  tables,
  orders,
  products,
  role,
  selectedTableId,
  note,
  transferTargetId,
  onSelectTable,
  onOpenTable,
  onAddProduct,
  onNoteChange,
  onTransferTargetChange,
  onTransferTable,
  onSetClosing,
  onRemoveItem,
}: TableBoardProps) {
  const [search, setSearch] = useState("");
  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? tables[0];
  const selectedOrder = tableOrder(orders, selectedTable.id);
  const sortedTables = useMemo(() => sortTablesByNumber(tables), [tables]);
  const filteredProducts = useMemo(
    () => products.filter((product) => product.active && productMatchesSearch(product, search)),
    [products, search],
  );
  const categories = Array.from(new Set(filteredProducts.map((product) => product.category)));
  const canTransfer = role === "admin" || role === "cashier";

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black">Mapa de mesas</h3>
            <p className="text-sm text-muted-foreground">Atendimento, consumo e status por mesa.</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenTable(selectedTable.id)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Abrir mesa
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {sortedTables.map((table) => {
            const order = tableOrder(orders, table.id);
            const selected = selectedTableId === table.id;
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => onSelectTable(table.id)}
                className={`min-h-[154px] rounded-lg border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-panel ${
                  selected ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">{table.area}</p>
                    <p className="mt-1 text-3xl font-black">Mesa {table.number}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone[table.status]}`}>
                    {table.status === "free" ? "Livre" : table.status === "closing" ? "Fechamento" : "Ocupada"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <UsersRound className="h-3.5 w-3.5" />
                    {table.seats} lugares
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {table.openedAt ? formatElapsed(table.openedAt) : "-"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <span className="text-xs font-semibold text-muted-foreground">{table.customerName ?? "Sem cliente"}</span>
                  <span className="text-sm font-black">{order ? currency.format(orderTotal(order)) : currency.format(0)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="rounded-lg border bg-card shadow-panel xl:sticky xl:top-24 xl:max-h-[calc(100vh-120px)]">
        <div className="border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Comanda ativa</p>
              <h3 className="text-2xl font-black">Mesa {selectedTable.number}</h3>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusTone[selectedTable.status]}`}>
              {selectedTable.status === "free" ? "Livre" : selectedTable.status === "closing" ? "Fechamento" : "Ocupada"}
            </span>
          </div>
        </div>

        <div className="max-h-[calc(100vh-280px)] space-y-5 overflow-y-auto p-4 pb-28 scrollbar-thin">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-semibold text-muted-foreground">Cliente</p>
              <p className="mt-1 font-bold">{selectedOrder?.customerName ?? selectedTable.customerName ?? "Nao identificado"}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-semibold text-muted-foreground">Garcom</p>
              <p className="mt-1 font-bold">{selectedOrder?.waiterName ?? selectedTable.waiterName ?? "Livre"}</p>
            </div>
          </div>

          <div>
            <label htmlFor="product-search" className="text-xs font-bold uppercase text-muted-foreground">
              Buscar produto
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-lg border bg-background px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                id="product-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                placeholder="Digite coca, pizza, burger..."
              />
            </div>
          </div>

          <div>
            <label htmlFor="order-note" className="text-xs font-bold uppercase text-muted-foreground">
              Observacao do proximo item
            </label>
            <textarea
              id="order-note"
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              className="mt-2 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
              placeholder="Sem cebola, extra bacon, massa fina..."
            />
          </div>

          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category}>
                <h4 className="mb-2 text-xs font-black uppercase text-muted-foreground">{category}</h4>
                <div className="grid gap-2">
                  {filteredProducts
                    .filter((product) => product.category === category)
                    .map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => onAddProduct(product)}
                        className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-left transition hover:border-primary hover:bg-primary/5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Cod. {product.code} - {product.station === "bar" ? "Bar" : product.station === "counter" ? "Balcao" : "Cozinha"}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {product.ingredients.join(", ")}
                          </p>
                          {product.sizes.length > 0 && (
                            <p className="mt-1 text-xs font-bold text-primary">
                              {product.sizes.map((size) => `${size.name} ${currency.format(size.price)}`).join(" | ")}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-sm font-black">{productPriceLabel(product)}</span>
                      </button>
                    ))}
                  {filteredProducts.filter((product) => product.category === category).length === 0 && (
                    <p className="rounded-lg border bg-background p-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border bg-background">
            <div className="flex items-center justify-between border-b p-3">
              <span className="inline-flex items-center gap-2 text-sm font-black">
                <ReceiptText className="h-4 w-4" />
                Itens
              </span>
              <span className="text-sm font-black">{selectedOrder ? currency.format(orderTotal(selectedOrder)) : currency.format(0)}</span>
            </div>
            <div className="divide-y">
              {selectedOrder?.items.length ? (
                selectedOrder.items.map((item) => (
                  <div key={item.id} className={`p-3 ${item.status === "cancelled" ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">
                          {item.quantity}x {item.productName}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.notes || "Sem observacao"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.ingredients.join(", ")}</p>
                        {item.selectedOptions.length > 0 && (
                          <p className="mt-1 text-xs font-bold text-primary">{item.selectedOptions.join(" | ")}</p>
                        )}
                        <p className="mt-1 text-xs font-bold text-muted-foreground">{statusLabel[item.status]}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-black">{currency.format(item.quantity * item.unitPrice)}</span>
                        {item.status !== "cancelled" && (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(selectedOrder.id, item.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg border text-destructive"
                            title={role === "admin" ? "Remover item" : "Remover com autorizacao do administrador"}
                          >
                            {role === "admin" ? <Trash2 className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-3 text-sm text-muted-foreground">Nenhum item na comanda.</p>
              )}
            </div>
          </div>

          {canTransfer && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <select
                value={transferTargetId}
                onChange={(event) => onTransferTargetChange(event.target.value)}
                className="rounded-lg border bg-background px-3 py-2 text-sm font-semibold outline-none ring-primary focus:ring-2"
              >
                <option value="">Transferir para...</option>
                {sortTablesByNumber(tables)
                  .filter((table) => table.id !== selectedTable.id)
                  .map((table) => (
                    <option key={table.id} value={table.id}>
                      Mesa {table.number}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={onTransferTable}
                className="inline-flex items-center justify-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-bold"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transferir
              </button>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t bg-card p-4">
          <button
            type="button"
            onClick={onSetClosing}
            className="w-full rounded-lg bg-warning px-4 py-3 text-sm font-black text-warning-foreground shadow-sm"
          >
            Solicitar fechamento
          </button>
        </div>
      </aside>
    </div>
  );
}

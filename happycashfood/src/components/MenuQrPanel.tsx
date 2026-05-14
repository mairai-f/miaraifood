import { useMemo, useState } from "react";
import { BellRing, Camera, Minus, Plus, QrCode, Receipt, Search, ShoppingCart, X } from "lucide-react";
import type { FoodOrder, FoodTable, MenuProduct } from "@/types";
import {
  currency,
  orderTotal,
  productMatchesSearch,
  productPriceLabel,
  sortTablesByNumber,
  tableOrder,
} from "@/lib/foodMetrics";

interface MenuQrPanelProps {
  tables: FoodTable[];
  products: MenuProduct[];
  orders: FoodOrder[];
  selectedTableId: string;
  customerMode: boolean;
  onSelectTable: (tableId: string) => void;
  onCustomerAddProduct: (tableId: string, product: MenuProduct, note: string, selectedOptions: string[], unitPrice?: number) => void;
  onCancelItem: (orderId: string, itemId: string) => void;
  onRequestPayment: (tableId: string) => void;
}

export function MenuQrPanel({
  tables,
  products,
  orders,
  selectedTableId,
  customerMode,
  onSelectTable,
  onCustomerAddProduct,
  onCancelItem,
  onRequestPayment,
}: MenuQrPanelProps) {
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const [selectedSizeByProduct, setSelectedSizeByProduct] = useState<Record<string, string>>({});
  const visibleProducts = useMemo(
    () => products.filter((product) => product.qrVisible && product.active && productMatchesSearch(product, search)),
    [products, search],
  );
  const categories = Array.from(new Set(visibleProducts.map((product) => product.category)));
  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? tables[0];
  const selectedOrder = selectedTable ? tableOrder(orders, selectedTable.id) : undefined;

  const addProduct = (product: MenuProduct) => {
    const selectedSizeId = selectedSizeByProduct[product.id];
    const size = product.sizes.find((item) => item.id === selectedSizeId);
    const selectedOptions = size ? [size.name] : [];
    onCustomerAddProduct(selectedTable.id, product, note.trim(), selectedOptions, size?.price);
    setNote("");
  };

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_390px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black">{customerMode ? `Cardapio mesa ${selectedTable.number}` : "Cardapio digital QR Code"}</h3>
            <p className="text-sm text-muted-foreground">
              {customerMode ? "Cliente ve apenas cardapio, pedido e solicitacao de pagamento." : "Produtos publicados para cliente, mesa e pedido sem garcom."}
            </p>
          </div>
          {!customerMode && (
            <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
              <QrCode className="h-4 w-4" />
              Gerar QRs
            </button>
          )}
        </div>

        {!customerMode && (
          <div className="rounded-lg border bg-card p-3">
            <label htmlFor="qr-table" className="text-xs font-black uppercase text-muted-foreground">
              Mesa do QR
            </label>
            <select
              id="qr-table"
              value={selectedTable.id}
              onChange={(event) => onSelectTable(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm font-bold outline-none ring-primary focus:ring-2"
            >
              {sortTablesByNumber(tables).map((table) => (
                <option key={table.id} value={table.id}>
                  Mesa {table.number} - {table.area}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-lg border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
            placeholder="Buscar pizza, coca, drink..."
          />
        </div>

        <div className="space-y-5">
          {categories.map((category) => (
            <div key={category} className="rounded-lg border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h4 className="font-black">{category}</h4>
                <span className="text-xs font-bold text-muted-foreground">
                  {visibleProducts.filter((product) => product.category === category).length} itens
                </span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleProducts
                  .filter((product) => product.category === category)
                  .map((product) => {
                    const selectedSizeId = selectedSizeByProduct[product.id] || product.sizes[0]?.id || "";
                    return (
                      <article key={product.id} className="rounded-lg border bg-background p-3">
                        <div className="flex h-28 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Camera className="h-8 w-8" />
                        </div>
                        <div className="mt-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-black">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{product.ingredients.join(", ")}</p>
                          </div>
                          <span className="shrink-0 font-black">{productPriceLabel(product)}</span>
                        </div>

                        {product.sizes.length > 0 && (
                          <div className="mt-3 grid grid-cols-3 gap-1">
                            {product.sizes.map((size) => (
                              <button
                                key={size.id}
                                type="button"
                                onClick={() => setSelectedSizeByProduct((current) => ({ ...current, [product.id]: size.id }))}
                                className={`rounded-lg border px-2 py-1 text-xs font-black ${
                                  selectedSizeId === size.id ? "border-primary bg-primary text-primary-foreground" : "bg-card"
                                }`}
                              >
                                {size.name} {currency.format(size.price)}
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-1">
                          {product.tags.map((tag) => (
                            <span key={tag} className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                              {tag}
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => addProduct(product)}
                          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-black text-primary-foreground"
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar
                        </button>
                      </article>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="rounded-lg border bg-card p-4 shadow-panel xl:sticky xl:top-24 xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
        <div className="rounded-lg border bg-background p-4">
          <p className="text-xs font-bold uppercase text-muted-foreground">{customerMode ? "Sua mesa" : "Preview mesa"}</p>
          <h4 className="mt-1 text-2xl font-black">Mesa {selectedTable.number}</h4>
          <div className="mt-4 grid aspect-square place-items-center rounded-lg border-2 border-dashed bg-muted">
            <div className="grid h-40 w-40 place-items-center rounded-lg bg-card shadow-sm">
              <QrCode className="h-24 w-24 text-primary" />
            </div>
          </div>
          <p className="mt-3 break-all rounded-lg bg-muted p-3 text-xs font-semibold text-muted-foreground">
            happycashfood.app/menu/demo-restaurante/mesa-{selectedTable.number}
          </p>
        </div>

        <div className="mt-4">
          <label htmlFor="customer-note" className="text-xs font-bold uppercase text-muted-foreground">
            Observacao
          </label>
          <textarea
            id="customer-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
            placeholder="Ex: sem cebola, gelo separado..."
          />
        </div>

        <div className="mt-4 rounded-lg border bg-background">
          <div className="flex items-center justify-between border-b p-3">
            <span className="inline-flex items-center gap-2 text-sm font-black">
              <ShoppingCart className="h-4 w-4" />
              Pedido da mesa
            </span>
            <span className="text-sm font-black">{selectedOrder ? currency.format(orderTotal(selectedOrder)) : currency.format(0)}</span>
          </div>
          <div className="divide-y">
            {selectedOrder?.items.length ? (
              selectedOrder.items.map((item) => (
                <div key={item.id} className={`p-3 ${item.status === "cancelled" ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{item.quantity}x {item.productName}</p>
                      <p className="text-xs text-muted-foreground">{item.notes || item.ingredients.join(", ")}</p>
                      {item.selectedOptions.length > 0 && (
                        <p className="text-xs font-bold text-primary">{item.selectedOptions.join(" | ")}</p>
                      )}
                    </div>
                    {item.status !== "cancelled" && (
                      <button
                        type="button"
                        onClick={() => onCancelItem(selectedOrder.id, item.id)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-destructive"
                        title="Cancelar item"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="p-3 text-sm text-muted-foreground">Nenhum pedido enviado.</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <button type="button" className="inline-flex items-center justify-between rounded-lg border bg-background px-4 py-3 font-black">
            <span className="inline-flex items-center gap-2">
              <BellRing className="h-4 w-4" />
              Chamar garcom
            </span>
            <span className="text-xs text-muted-foreground">ativo</span>
          </button>
          <button
            type="button"
            onClick={() => onRequestPayment(selectedTable.id)}
            className="inline-flex items-center justify-between rounded-lg bg-warning px-4 py-3 font-black text-warning-foreground"
          >
            <span className="inline-flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Solicitar pagamento
            </span>
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </section>
  );
}

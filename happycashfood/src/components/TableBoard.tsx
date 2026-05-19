import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Clock, LockKeyhole, Plus, ReceiptText, Search, Trash2, UsersRound, Wallet, X } from "lucide-react";
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
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [tableItemsPage, setTableItemsPage] = useState(0);
  const [activeCategory, setActiveCategory] = useState("");
  const [productPage, setProductPage] = useState(0);
  const sortedTables = useMemo(() => sortTablesByNumber(tables), [tables]);
  const selectedTable = tables.find((table) => table.id === selectedTableId) ?? tables[0];
  const selectedOrder = selectedTable ? tableOrder(orders, selectedTable.id) : undefined;
  const filteredProducts = useMemo(
    () => products.filter((product) => product.active && productMatchesSearch(product, search)),
    [products, search],
  );
  const categories = Array.from(new Set(filteredProducts.map((product) => product.category)));
  const selectedCategory = categories.includes(activeCategory) ? activeCategory : categories[0] ?? "";
  const categoryProducts = selectedCategory
    ? filteredProducts.filter((product) => product.category === selectedCategory)
    : filteredProducts;
  const selectedOrderItems = selectedOrder?.items ?? [];
  const tableItemsPerPage = 3;
  const productItemsPerPage = 3;
  const tableTotalPages = Math.max(1, Math.ceil(selectedOrderItems.length / tableItemsPerPage));
  const visibleOrderItems = selectedOrderItems.slice(
    tableItemsPage * tableItemsPerPage,
    tableItemsPage * tableItemsPerPage + tableItemsPerPage,
  );
  const productTotalPages = Math.max(1, Math.ceil(categoryProducts.length / productItemsPerPage));
  const visibleCategoryProducts = categoryProducts.slice(
    productPage * productItemsPerPage,
    productPage * productItemsPerPage + productItemsPerPage,
  );
  const tablePageNumbers = Array.from({ length: tableTotalPages }, (_, index) => index);
  const productPageNumbers = Array.from({ length: productTotalPages }, (_, index) => index);
  const canTransfer = role === "admin" || role === "cashier";

  useEffect(() => {
    if (categories.includes(activeCategory)) return;
    setActiveCategory(categories[0] ?? "");
  }, [activeCategory, categories]);

  useEffect(() => {
    setTableItemsPage(0);
  }, [selectedOrder?.id, tableModalOpen]);

  useEffect(() => {
    setProductPage(0);
  }, [selectedCategory, search, productModalOpen]);

  useEffect(() => {
    if (!tableModalOpen && !productModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [productModalOpen, tableModalOpen]);

  const openTableModal = (tableId: string) => {
    onSelectTable(tableId);
    setTableModalOpen(true);
    setProductModalOpen(false);
    setTableItemsPage(0);
  };

  const closeTableModal = () => {
    setProductModalOpen(false);
    setTableModalOpen(false);
    setSearch("");
    setTableItemsPage(0);
    setProductPage(0);
  };

  const closeProductModal = () => {
    setProductModalOpen(false);
    setProductPage(0);
  };

  const openProductCatalog = () => {
    if (!selectedTable) return;
    if (selectedTable.status === "free") {
      onOpenTable(selectedTable.id);
    }
    setProductModalOpen(true);
    setProductPage(0);
  };

  if (!selectedTable) {
    return (
      <section className="rounded-lg border bg-card p-6 text-center shadow-sm">
        <h3 className="text-2xl font-black">Nenhuma mesa cadastrada</h3>
        <p className="mt-2 text-sm text-muted-foreground">Cadastre as mesas na gestao para iniciar a operacao do HappyCashFood.</p>
      </section>
    );
  }

  return (
    <>
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-2xl font-black">Mapa de mesas</h3>
            <p className="text-sm text-muted-foreground">Toque em uma mesa para abrir a comanda em modal.</p>
          </div>
          <span className="rounded-full border bg-card px-3 py-2 text-xs font-bold text-muted-foreground">
            {sortedTables.filter((table) => table.status !== "free").length} mesas ocupadas
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {sortedTables.map((table) => {
            const order = tableOrder(orders, table.id);
            const selected = selectedTableId === table.id;
            return (
              <button
                key={table.id}
                type="button"
                onClick={() => openTableModal(table.id)}
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
                    {table.status === "free" ? "Livre" : table.status === "closing" ? "Fechando" : "Ocupada"}
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

      {tableModalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-foreground/50 p-3"
          onClick={closeTableModal}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-panel"
            style={{ maxHeight: "calc(100dvh - 24px)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b p-4 sm:p-5">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Comanda ativa</p>
                <h3 className="text-2xl font-black sm:text-3xl">Mesa {selectedTable.number}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Itens, consumo e acoes da mesa.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusTone[selectedTable.status]}`}>
                  {selectedTable.status === "free" ? "Livre" : selectedTable.status === "closing" ? "Fechando" : "Ocupada"}
                </span>
                <button
                  type="button"
                  onClick={closeTableModal}
                  data-modal-close="true"
                  className="grid h-9 w-9 place-items-center rounded-lg border bg-background text-muted-foreground sm:h-10 sm:w-10"
                  aria-label="Fechar modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[300px_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Cliente</p>
                    <p className="mt-1 font-bold">{selectedOrder?.customerName ?? selectedTable.customerName ?? `Mesa ${selectedTable.number}`}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Garcom</p>
                    <p className="mt-1 font-bold">{selectedOrder?.waiterName ?? selectedTable.waiterName ?? "Livre"}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Tempo aberto</p>
                    <p className="mt-1 font-bold">{selectedTable.openedAt ? formatElapsed(selectedTable.openedAt) : "-"}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs font-semibold text-muted-foreground">Consumo</p>
                    <p className="mt-1 font-bold">{selectedOrder ? currency.format(orderTotal(selectedOrder)) : currency.format(0)}</p>
                  </div>
                </div>

                <div className="grid gap-2.5">
                  {selectedTable.status === "free" ? (
                    <button
                      type="button"
                      onClick={() => onOpenTable(selectedTable.id)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-black text-primary-foreground"
                    >
                      <Plus className="h-4 w-4" />
                      Abrir mesa
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openProductCatalog}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-black text-primary-foreground"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar produtos
                    </button>
                  )}

                  {selectedOrder && role !== "customer" && (
                    <button
                      type="button"
                      onClick={onSetClosing}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-warning px-4 py-3 text-sm font-black text-warning-foreground"
                    >
                      <Wallet className="h-4 w-4" />
                      {role === "waiter" ? "Encerrar conta" : "Abrir fechamento"}
                    </button>
                  )}
                </div>

                {selectedOrder && canTransfer && (
                  <div className="rounded-lg border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm font-black">
                      <ArrowRightLeft className="h-4 w-4" />
                      Transferir comanda
                    </div>
                    <div className="mt-3 grid gap-2">
                      <select
                        value={transferTargetId}
                        onChange={(event) => onTransferTargetChange(event.target.value)}
                        className="h-11 rounded-lg border bg-card px-3 text-sm font-bold outline-none ring-primary focus:ring-2"
                      >
                        <option value="">Selecionar mesa</option>
                        {sortedTables
                          .filter((table) => table.id !== selectedTable.id)
                          .map((table) => (
                            <option key={table.id} value={table.id}>
                              Mesa {table.number} - {table.area}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={onTransferTable}
                        className="inline-flex h-11 items-center justify-center rounded-lg border bg-card px-4 text-sm font-black"
                      >
                        Transferir
                      </button>
                    </div>
                  </div>
                )}

              </div>

              <div className="space-y-4">
                <div className="rounded-lg border bg-background">
                  <div className="flex items-center justify-between border-b p-3">
                    <span className="inline-flex items-center gap-2 text-sm font-black">
                      <ReceiptText className="h-4 w-4" />
                      Itens da comanda
                    </span>
                    <span className="text-sm font-black">
                      {selectedOrderItems.length} item(ns) • {selectedOrder ? currency.format(orderTotal(selectedOrder)) : currency.format(0)}
                    </span>
                  </div>
                  <div className="grid gap-3 p-3 lg:grid-cols-2">
                    {visibleOrderItems.length > 0 ? (
                      visibleOrderItems.map((item) => (
                        <div key={item.id} className={`rounded-lg border bg-card p-3 ${item.status === "cancelled" ? "opacity-60" : ""}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold">{item.quantity}x {item.productName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{item.notes || "Sem observacao"}</p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">{item.ingredients.join(", ")}</p>
                              {item.selectedOptions.length > 0 && (
                                <p className="mt-1 truncate text-xs font-bold text-primary">{item.selectedOptions.join(" | ")}</p>
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
                                  title="Cancelar item com senha do administrador"
                                  aria-label={`Cancelar ${item.quantity}x ${item.productName}`}
                                >
                                  {role === "admin" ? <Trash2 className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground lg:col-span-2">Nenhum item na comanda.</p>
                    )}
                  </div>
                </div>

                {selectedOrderItems.length > tableItemsPerPage && (
                  <div className="space-y-2 rounded-lg border bg-background px-3 py-2 text-sm">
                    <div className="flex flex-wrap gap-2">
                      {tablePageNumbers.map((page) => (
                        <button
                          key={`table-page-${page}`}
                          type="button"
                          onClick={() => setTableItemsPage(page)}
                          className={`rounded-lg border px-3 py-1.5 font-black transition ${
                            tableItemsPage === page
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
                      onClick={() => setTableItemsPage((current) => Math.max(0, current - 1))}
                      disabled={tableItemsPage === 0}
                      className="rounded-lg border px-3 py-2 font-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <span className="font-bold">Pagina {tableItemsPage + 1} de {tableTotalPages}</span>
                    <button
                      type="button"
                      onClick={() => setTableItemsPage((current) => Math.min(tableTotalPages - 1, current + 1))}
                      disabled={tableItemsPage >= tableTotalPages - 1}
                      className="rounded-lg border px-3 py-2 font-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Proxima
                    </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {productModalOpen && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center overflow-hidden bg-foreground/60 p-3"
          onClick={closeProductModal}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-panel"
            style={{ maxHeight: "calc(100dvh - 24px)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b p-4 sm:p-5">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Cardapio da comanda</p>
                <h3 className="text-2xl font-black sm:text-3xl">Mesa {selectedTable.number}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Escolha por busca, categoria e pagina.</p>
              </div>
              <button
                type="button"
                onClick={closeProductModal}
                data-modal-close="true"
                className="grid h-9 w-9 place-items-center rounded-lg border bg-background text-muted-foreground sm:h-10 sm:w-10"
                aria-label="Fechar cardápio"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="grid gap-3 sm:gap-4 lg:grid-cols-[1fr_280px]">
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
                  <input
                    id="order-note"
                    value={note}
                    onChange={(event) => onNoteChange(event.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none ring-primary focus:ring-2"
                    placeholder="Sem cebola, extra bacon, massa fina..."
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`rounded-lg border px-3 py-2 text-sm font-black transition ${
                      selectedCategory === category
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:border-primary hover:text-foreground"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border bg-background px-3 py-2 text-sm">
                <span className="font-black">{selectedCategory || "Busca geral"}:</span>{" "}
                {categoryProducts.length} produto(s) separados por pagina.
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {visibleCategoryProducts.length > 0 ? (
                  visibleCategoryProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => onAddProduct(product)}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-left transition hover:border-primary hover:bg-primary/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.station === "bar" ? "Bar" : product.station === "counter" ? "Pizzaria / Balcao" : "Cozinha"} • Cod. {product.code}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{product.ingredients.join(", ")}</p>
                        {product.sizes.length > 0 && (
                          <p className="mt-1 truncate text-xs font-bold text-primary">
                            {product.sizes.map((size) => `${size.name} ${currency.format(size.price)}`).join(" | ")}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm font-black">{productPriceLabel(product)}</span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground lg:col-span-2">Nenhum produto encontrado nessa busca.</p>
                )}
              </div>

              {categoryProducts.length > productItemsPerPage && (
                <div className="space-y-2 rounded-lg border bg-background px-3 py-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {productPageNumbers.map((page) => (
                      <button
                        key={`product-page-${page}`}
                        type="button"
                        onClick={() => setProductPage(page)}
                        className={`rounded-lg border px-3 py-1.5 font-black transition ${
                          productPage === page
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
                    onClick={() => setProductPage((current) => Math.max(0, current - 1))}
                    disabled={productPage === 0}
                    className="rounded-lg border px-3 py-2 font-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <span className="font-bold">Pagina {productPage + 1} de {productTotalPages}</span>
                  <button
                    type="button"
                    onClick={() => setProductPage((current) => Math.min(productTotalPages - 1, current + 1))}
                    disabled={productPage >= productTotalPages - 1}
                    className="rounded-lg border px-3 py-2 font-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Proxima
                  </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}

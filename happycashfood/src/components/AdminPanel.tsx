import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChartNoAxesCombined, KeyRound, PackageCheck, Plus, Trash2, UsersRound } from "lucide-react";
import type { FoodOrder, FoodTable, FoodWaiter, MenuProduct, Station } from "@/types";
import { currency, normalizeSearch, occupiedTables, orderTotal, productPriceLabel, sortTablesByNumber, statusTone, waiterCommission } from "@/lib/foodMetrics";

interface AdminPanelProps {
  tables: FoodTable[];
  orders: FoodOrder[];
  products: MenuProduct[];
  waiters: FoodWaiter[];
  onAddTable: (table: { number: string; area: string; seats: number }) => void;
  onDeleteTable: (tableId: string) => void;
  onAddWaiter: (waiter: Omit<FoodWaiter, "id">) => void;
  onUpdateWaiter: (waiter: FoodWaiter) => void;
  onAddProduct: (product: Omit<MenuProduct, "id">) => void;
  onUpdateProduct: (product: MenuProduct) => void;
  onDeleteProduct: (productId: string) => void;
}

type AdminSection = "resumo" | "mesas" | "comissoes" | "cadastro-produto" | "editar-produto" | "excluir-produto";

const emptyProductForm = {
  code: "900",
  name: "",
  category: "Pizza",
  description: "",
  price: "0",
  costPrice: "0",
  station: "kitchen" as Station,
  stock: "0",
  prepMinutes: "10",
  ingredients: "",
  sizes: "",
  tags: "",
};

const parseNumber = (value: string) => Number(value.replace(",", ".")) || 0;

export function AdminPanel({
  tables,
  orders,
  products,
  waiters,
  onAddTable,
  onDeleteTable,
  onAddWaiter,
  onUpdateWaiter,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
}: AdminPanelProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>("resumo");
  const [tableForm, setTableForm] = useState({ number: "", area: "Salao", seats: "4" });
  const [waiterForm, setWaiterForm] = useState({ name: "", username: "", pin: "", commissionMode: "percent" as const, commissionValue: "5" });
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [productToDeleteId, setProductToDeleteId] = useState(products[0]?.id ?? "");
  const normalizedProductSearch = useMemo(() => normalizeSearch(productSearch), [productSearch]);
  const filteredProducts = useMemo(() => {
    if (!normalizedProductSearch) return products;
    return products.filter((product) => normalizeSearch(product.name).includes(normalizedProductSearch));
  }, [products, normalizedProductSearch]);
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? filteredProducts[0] ?? products[0] ?? null;
  const openRevenue = orders.filter((order) => order.status !== "paid").reduce((sum, order) => sum + orderTotal(order), 0);
  const hourlySales = useMemo(() => {
    const soldItems = orders.flatMap((order) =>
      order.items
        .filter((item) => item.status !== "cancelled")
        .map((item) => ({
          timestamp: new Date(item.createdAt).getTime(),
          quantity: item.quantity,
          revenue: item.quantity * item.unitPrice,
        })),
    );

    const end = new Date(soldItems.length > 0 ? Math.max(...soldItems.map((item) => item.timestamp)) : Date.now());
    end.setMinutes(0, 0, 0);

    const start = new Date(end);
    start.setHours(end.getHours() - 7);

    const buckets = Array.from({ length: 8 }, (_, index) => {
      const slot = new Date(start);
      slot.setHours(start.getHours() + index);
      return {
        key: slot.toISOString(),
        timestamp: slot.getTime(),
        label: `${String(slot.getHours()).padStart(2, "0")}h`,
        quantity: 0,
        revenue: 0,
      };
    });

    const bucketIndexByTimestamp = new Map(
      buckets.map((bucket, index) => [bucket.timestamp, index]),
    );

    soldItems.forEach((item) => {
      const hour = new Date(item.timestamp);
      hour.setMinutes(0, 0, 0);
      const bucketIndex = bucketIndexByTimestamp.get(hour.getTime());
      if (bucketIndex === undefined) return;

      buckets[bucketIndex].quantity += item.quantity;
      buckets[bucketIndex].revenue += item.revenue;
    });

    const maxRevenue = Math.max(...buckets.map((bucket) => bucket.revenue), 0);

    return buckets.map((bucket) => ({
      ...bucket,
      height: bucket.revenue > 0 && maxRevenue > 0
        ? Math.max(18, Math.round((bucket.revenue / maxRevenue) * 100))
        : 8,
      tooltip: `${bucket.label} • ${bucket.quantity} ${bucket.quantity === 1 ? "produto" : "produtos"} • ${currency.format(bucket.revenue)}`,
    }));
  }, [orders]);
  const productRanking = useMemo(() => {
    const soldByProduct = new Map<string, { productId: string; productName: string; quantity: number; revenue: number }>();

    orders.forEach((order) => {
      order.items
        .filter((item) => item.status !== "cancelled")
        .forEach((item) => {
          const current = soldByProduct.get(item.productId) ?? {
            productId: item.productId,
            productName: item.productName,
            quantity: 0,
            revenue: 0,
          };

          current.quantity += item.quantity;
          current.revenue += item.quantity * item.unitPrice;
          soldByProduct.set(item.productId, current);
        });
    });

    return Array.from(soldByProduct.values())
      .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
      .slice(0, 5);
  }, [orders]);
  const visibleProductRanking = useMemo(() => {
    if (!normalizedProductSearch) return productRanking;
    return productRanking.filter((product) => normalizeSearch(product.productName).includes(normalizedProductSearch));
  }, [normalizedProductSearch, productRanking]);
  const topProduct = visibleProductRanking[0] ?? (normalizedProductSearch ? undefined : productRanking[0]);

  useEffect(() => {
    if (filteredProducts.some((product) => product.id === selectedProductId)) return;
    setSelectedProductId(filteredProducts[0]?.id ?? "");
  }, [filteredProducts, selectedProductId]);

  useEffect(() => {
    if (filteredProducts.some((product) => product.id === productToDeleteId)) return;
    setProductToDeleteId(filteredProducts[0]?.id ?? "");
  }, [filteredProducts, productToDeleteId]);

  const productEditor = useMemo(() => {
    if (!selectedProduct) return null;
    return {
      ...selectedProduct,
      ingredientsText: selectedProduct.ingredients.join(", "),
      sizesText: selectedProduct.sizes.map((size) => `${size.name}:${size.price}`).join(", "),
      tagsText: selectedProduct.tags.join(", "),
    };
  }, [selectedProduct]);

  const sections: Array<{ id: AdminSection; label: string }> = [
    { id: "resumo", label: "Resumo" },
    { id: "mesas", label: "Mesas" },
    { id: "comissoes", label: "Comissoes" },
    { id: "cadastro-produto", label: "Cadastrar produto" },
    { id: "editar-produto", label: "Editar produto" },
    { id: "excluir-produto", label: "Excluir produto" },
  ];
  const showProductSearch = activeSection === "resumo" || activeSection === "editar-produto" || activeSection === "excluir-produto";

  const submitTable = (event: FormEvent) => {
    event.preventDefault();
    if (!tableForm.number.trim()) return;
    onAddTable({ number: tableForm.number.trim().padStart(2, "0"), area: tableForm.area.trim() || "Salao", seats: Number(tableForm.seats) || 4 });
    setTableForm({ number: "", area: "Salao", seats: "4" });
  };

  const submitWaiter = (event: FormEvent) => {
    event.preventDefault();
    if (!waiterForm.name.trim() || !waiterForm.username.trim() || !waiterForm.pin.trim()) return;
    onAddWaiter({
      name: waiterForm.name.trim(),
      username: waiterForm.username.trim().toLowerCase(),
      pin: waiterForm.pin.trim(),
      commissionMode: waiterForm.commissionMode,
      commissionValue: parseNumber(waiterForm.commissionValue),
      active: true,
    });
    setWaiterForm({ name: "", username: "", pin: "", commissionMode: "percent", commissionValue: "5" });
  };

  const submitProduct = (event: FormEvent) => {
    event.preventDefault();
    if (!productForm.name.trim()) return;
    onAddProduct({
      code: Number(productForm.code) || Date.now(),
      name: productForm.name.trim(),
      category: productForm.category.trim() || "Cardapio",
      description: productForm.description.trim(),
      price: parseNumber(productForm.price),
      costPrice: parseNumber(productForm.costPrice),
      station: productForm.station,
      stock: Number(productForm.stock) || 0,
      prepMinutes: Number(productForm.prepMinutes) || 0,
      active: true,
      qrVisible: false,
      tags: productForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      ingredients: productForm.ingredients.split(",").map((ingredient) => ingredient.trim()).filter(Boolean),
      sizes: productForm.sizes
        .split(",")
        .map((size) => size.trim())
        .filter(Boolean)
        .map((size, index) => {
          const [name, price] = size.split(":");
          return { id: `size-${Date.now()}-${index}`, name: name.trim(), price: parseNumber(price ?? "0") };
        }),
      options: [],
    });
    setProductForm(emptyProductForm);
  };

  const updateSelectedProductText = (field: "ingredients" | "sizes" | "tags", value: string) => {
    if (!selectedProduct) return;
    if (field === "ingredients") {
      onUpdateProduct({ ...selectedProduct, ingredients: value.split(",").map((item) => item.trim()).filter(Boolean) });
      return;
    }
    if (field === "tags") {
      onUpdateProduct({ ...selectedProduct, tags: value.split(",").map((item) => item.trim()).filter(Boolean) });
      return;
    }
    onUpdateProduct({
      ...selectedProduct,
      sizes: value
        .split(",")
        .map((size) => size.trim())
        .filter(Boolean)
        .map((size, index) => {
          const [name, price] = size.split(":");
          return { id: selectedProduct.sizes[index]?.id ?? `size-${Date.now()}-${index}`, name: name.trim(), price: parseNumber(price ?? "0") };
        }),
    });
  };

  return (
    <section className="space-y-5">
      <div>
        <h3 className="text-2xl font-black">Gestao HappyCashFood</h3>
        <p className="text-sm text-muted-foreground">Gestao separada por menu para a operacao food ficar leve e objetiva.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-muted-foreground">Ocupacao</p>
          <p className="mt-2 text-3xl font-black">{tables.length ? Math.round((occupiedTables(tables).length / tables.length) * 100) : 0}%</p>
        </article>
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-muted-foreground">Ticket aberto</p>
          <p className="mt-2 text-3xl font-black">{currency.format(openRevenue)}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-muted-foreground">
            {normalizedProductSearch ? "Mais vendido na busca" : "Mais vendido"}
          </p>
          <p className="mt-2 text-2xl font-black">{topProduct?.productName ?? "-"}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-muted-foreground">Plano offline</p>
          <p className="mt-2 text-3xl font-black">R$ 310</p>
        </article>
      </div>

      <div className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={`rounded-lg border px-4 py-2 text-sm font-black transition ${
              activeSection === section.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:border-primary hover:text-foreground"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {showProductSearch && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground">Busca de produto</p>
              <h4 className="text-lg font-black">Buscar pelo nome no dashboard</h4>
            </div>
            <div className="w-full lg:max-w-md">
              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                className="h-11 w-full rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2"
                placeholder="Digite o nome do produto"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {normalizedProductSearch
                ? `${filteredProducts.length} produto(s) encontrados na busca atual.`
                : `${products.length} produtos cadastrados para localizar por nome.`}
            </span>
            {productSearch && (
              <button
                type="button"
                onClick={() => setProductSearch("")}
                className="rounded-full border px-2.5 py-1 font-bold text-foreground transition hover:border-primary hover:text-primary"
              >
                Limpar busca
              </button>
            )}
          </div>
        </div>
      )}

      {activeSection === "resumo" && (
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Relatorios</p>
                <h4 className="text-xl font-black">Vendas por horario</h4>
              </div>
              <ChartNoAxesCombined className="h-5 w-5 text-primary" />
            </div>
            <div className="grid h-48 grid-cols-8 items-end gap-2">
              {hourlySales.map((hour) => (
                <div
                  key={hour.key}
                  title={hour.tooltip}
                  className="group flex h-full flex-col items-center justify-end gap-2"
                >
                  <div
                    className="w-full rounded-t bg-primary/80 transition group-hover:bg-primary"
                    style={{ height: `${hour.height}%` }}
                  />
                  <span className="text-center text-xs font-bold text-muted-foreground">{hour.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Passe o mouse nas barras para ver a quantidade de produtos e o total vendido por horario.
            </p>
          </div>

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-primary" />
              <h4 className="text-xl font-black">Ranking automatico</h4>
            </div>
            <div className="space-y-3">
              {visibleProductRanking.length > 0 ? (
                visibleProductRanking.map((product, index) => (
                  <article key={product.productId} className="flex items-center justify-between rounded-lg border bg-background p-3">
                    <div>
                      <p className="text-xs font-black uppercase text-muted-foreground">#{index + 1}</p>
                      <p className="font-black">{product.productName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black">{product.quantity} saídas</p>
                      <p className="text-xs text-muted-foreground">{currency.format(product.revenue)}</p>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                  {normalizedProductSearch
                    ? "Nenhum produto desta busca apareceu no ranking ainda."
                    : "O ranking passa a aparecer automaticamente conforme os pedidos entram."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSection === "mesas" && (
        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <form onSubmit={submitTable} className="rounded-lg border bg-card p-5 shadow-sm">
            <h4 className="text-xl font-black">Adicionar mesa</h4>
            <div className="mt-4 grid gap-3">
              <input value={tableForm.number} onChange={(event) => setTableForm((current) => ({ ...current, number: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Numero" />
              <input value={tableForm.area} onChange={(event) => setTableForm((current) => ({ ...current, area: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Area" />
              <input value={tableForm.seats} onChange={(event) => setTableForm((current) => ({ ...current, seats: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" inputMode="numeric" placeholder="Lugares" />
            </div>
            <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
              <Plus className="h-4 w-4" />
              Adicionar mesa
            </button>
          </form>

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h4 className="text-xl font-black">Mesas cadastradas</h4>
            <div className="mt-4 space-y-3">
              {sortTablesByNumber(tables).map((table) => {
                const hasOpenOrder = orders.some((order) => order.tableId === table.id && order.status !== "paid");
                return (
                  <article key={table.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3">
                    <div>
                      <p className="font-black">Mesa {table.number}</p>
                      <p className="text-xs text-muted-foreground">{table.area} - {table.seats} lugares</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusTone[table.status]}`}>
                        {table.status === "free" ? "Livre" : table.status === "closing" ? "Fechando" : "Ocupada"}
                      </span>
                      <button
                        type="button"
                        disabled={hasOpenOrder}
                        onClick={() => onDeleteTable(table.id)}
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-black text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeSection === "comissoes" && (
        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <form onSubmit={submitWaiter} className="rounded-lg border bg-card p-5 shadow-sm">
            <h4 className="text-xl font-black">Adicionar garcom</h4>
            <div className="mt-4 grid gap-3">
              <input value={waiterForm.name} onChange={(event) => setWaiterForm((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Nome" />
              <input value={waiterForm.username} onChange={(event) => setWaiterForm((current) => ({ ...current, username: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Usuario" />
              <input value={waiterForm.pin} onChange={(event) => setWaiterForm((current) => ({ ...current, pin: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="PIN" />
              <input value={waiterForm.commissionValue} onChange={(event) => setWaiterForm((current) => ({ ...current, commissionValue: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Comissao" />
              <select value={waiterForm.commissionMode} onChange={(event) => setWaiterForm((current) => ({ ...current, commissionMode: event.target.value as "percent" | "cash" }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2">
                <option value="percent">% sobre vendas</option>
                <option value="cash">Valor fixo por comanda</option>
              </select>
            </div>
            <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
              <KeyRound className="h-4 w-4" />
              Criar login
            </button>
          </form>

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" />
              <h4 className="text-xl font-black">Comissoes da equipe</h4>
            </div>
            <div className="space-y-3">
              {waiters.map((waiter) => (
                <article key={waiter.id} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{waiter.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Usuario {waiter.username} - {waiter.commissionMode === "percent" ? `${waiter.commissionValue}%` : currency.format(waiter.commissionValue)}
                      </p>
                    </div>
                    <span className="font-black text-primary">{currency.format(waiterCommission(waiter, orders))}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <input
                      value={waiter.commissionValue}
                      onChange={(event) => onUpdateWaiter({ ...waiter, commissionValue: parseNumber(event.target.value) })}
                      className="h-9 rounded-lg border bg-card px-2 text-sm font-bold outline-none ring-primary focus:ring-2"
                    />
                    <select
                      value={waiter.commissionMode}
                      onChange={(event) => onUpdateWaiter({ ...waiter, commissionMode: event.target.value as "percent" | "cash" })}
                      className="h-9 rounded-lg border bg-card px-2 text-sm font-bold outline-none ring-primary focus:ring-2"
                    >
                      <option value="percent">%</option>
                      <option value="cash">R$</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === "cadastro-produto" && (
        <form onSubmit={submitProduct} className="rounded-lg border bg-card p-5 shadow-sm">
          <h4 className="text-xl font-black">Cadastrar produto</h4>
          <p className="mt-1 text-sm text-muted-foreground">Use tamanhos como P:39.90, M:49.90, G:64.90. Ingredientes separados por virgula.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input value={productForm.code} onChange={(event) => setProductForm((current) => ({ ...current, code: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Codigo" />
            <input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2 md:col-span-2" placeholder="Nome do produto" />
            <input value={productForm.category} onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Categoria" />
            <input value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Preco" />
            <input value={productForm.costPrice} onChange={(event) => setProductForm((current) => ({ ...current, costPrice: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Custo" />
            <select value={productForm.station} onChange={(event) => setProductForm((current) => ({ ...current, station: event.target.value as Station }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2">
              <option value="kitchen">Cozinha</option>
              <option value="bar">Bar</option>
              <option value="counter">Balcao</option>
            </select>
            <input value={productForm.stock} onChange={(event) => setProductForm((current) => ({ ...current, stock: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Estoque" />
            <input value={productForm.prepMinutes} onChange={(event) => setProductForm((current) => ({ ...current, prepMinutes: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Min preparo" />
            <input value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2 md:col-span-3" placeholder="Descricao" />
            <input value={productForm.ingredients} onChange={(event) => setProductForm((current) => ({ ...current, ingredients: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2 md:col-span-3" placeholder="Ingredientes" />
            <input value={productForm.sizes} onChange={(event) => setProductForm((current) => ({ ...current, sizes: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2 md:col-span-2" placeholder="Tamanhos P:39.90, M:49.90" />
            <input value={productForm.tags} onChange={(event) => setProductForm((current) => ({ ...current, tags: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Tags" />
          </div>
          <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
            <PackageCheck className="h-4 w-4" />
            Salvar produto
          </button>
        </form>
      )}

      {activeSection === "editar-produto" && (
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <h4 className="text-xl font-black">Editar produto</h4>
          <p className="mt-1 text-sm text-muted-foreground">A busca por nome filtra a lista de edicao para achar o produto mais rapido.</p>
          {filteredProducts.length > 0 ? (
            <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="mt-4 h-11 w-full rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2">
              {filteredProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-4 rounded-lg border bg-background p-4 text-sm text-muted-foreground">
              Nenhum produto encontrado com esse nome.
            </p>
          )}
          {filteredProducts.length > 0 && productEditor && selectedProduct && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <input value={selectedProduct.name} onChange={(event) => onUpdateProduct({ ...selectedProduct, name: event.target.value })} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" />
              <input value={selectedProduct.price} onChange={(event) => onUpdateProduct({ ...selectedProduct, price: parseNumber(event.target.value) })} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" />
              <textarea value={productEditor.ingredientsText} onChange={(event) => updateSelectedProductText("ingredients", event.target.value)} className="min-h-24 rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-primary focus:ring-2 lg:col-span-2" />
              <input value={productEditor.sizesText} onChange={(event) => updateSelectedProductText("sizes", event.target.value)} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="P:39.90, M:49.90" />
              <input value={productEditor.tagsText} onChange={(event) => updateSelectedProductText("tags", event.target.value)} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" />
              <p className="rounded-lg bg-muted p-3 text-sm font-bold text-muted-foreground lg:col-span-2">
                Preco exibido: {productPriceLabel(selectedProduct)}
              </p>
            </div>
          )}
        </div>
      )}

      {activeSection === "excluir-produto" && (
        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <h4 className="text-xl font-black">Excluir produto do sistema</h4>
          </div>
          <p className="text-sm text-muted-foreground">Use esta area apenas para remover produtos do cardapio e da gestao.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            {filteredProducts.length > 0 ? (
              <select value={productToDeleteId} onChange={(event) => setProductToDeleteId(event.target.value)} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2">
                {filteredProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg border bg-background px-3 py-3 text-sm text-muted-foreground">
                Nenhum produto encontrado com esse nome.
              </div>
            )}
            <button
              type="button"
              onClick={() => onDeleteProduct(productToDeleteId)}
              disabled={!productToDeleteId || filteredProducts.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm font-black text-destructive disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Excluir produto
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

import { FormEvent, useMemo, useState } from "react";
import { BrainCircuit, ChartNoAxesCombined, KeyRound, PackageCheck, Plus, ShieldCheck, UsersRound } from "lucide-react";
import type { FoodOrder, FoodTable, FoodWaiter, MenuProduct, Station } from "@/types";
import { currency, occupiedTables, orderTotal, productPriceLabel, waiterCommission } from "@/lib/foodMetrics";

interface AdminPanelProps {
  tables: FoodTable[];
  orders: FoodOrder[];
  products: MenuProduct[];
  waiters: FoodWaiter[];
  onAddTable: (table: { number: string; area: string; seats: number }) => void;
  onAddWaiter: (waiter: Omit<FoodWaiter, "id">) => void;
  onUpdateWaiter: (waiter: FoodWaiter) => void;
  onAddProduct: (product: Omit<MenuProduct, "id">) => void;
  onUpdateProduct: (product: MenuProduct) => void;
}

const modules = [
  { label: "Permissoes por cargo", detail: "Admin, gerente, garcom, cozinha, caixa e cliente QR", icon: ShieldCheck },
  { label: "Estoque inteligente", detail: "Ficha tecnica, validade, perdas e baixa na venda", icon: PackageCheck },
  { label: "Clientes e fidelidade", detail: "Historico, cashback, cupons e fiado como no HappyCash", icon: UsersRound },
  { label: "IA comercial", detail: "Promocoes, precos, horario de pico e sugestoes", icon: BrainCircuit },
];

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
  onAddWaiter,
  onUpdateWaiter,
  onAddProduct,
  onUpdateProduct,
}: AdminPanelProps) {
  const [tableForm, setTableForm] = useState({ number: "", area: "Salao", seats: "4" });
  const [waiterForm, setWaiterForm] = useState({ name: "", username: "", pin: "", commissionMode: "percent" as const, commissionValue: "5" });
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
  const openRevenue = orders.filter((order) => order.status !== "paid").reduce((sum, order) => sum + orderTotal(order), 0);
  const topProduct = products[0];
  const hourlySales = [
    { label: "16h", height: 34 },
    { label: "17h", height: 48 },
    { label: "18h", height: 42 },
    { label: "19h", height: 65 },
    { label: "20h", height: 88 },
    { label: "21h", height: 74 },
    { label: "22h", height: 56 },
    { label: "23h", height: 38 },
  ];

  const productEditor = useMemo(() => {
    if (!selectedProduct) return null;
    return {
      ...selectedProduct,
      ingredientsText: selectedProduct.ingredients.join(", "),
      sizesText: selectedProduct.sizes.map((size) => `${size.name}:${size.price}`).join(", "),
      tagsText: selectedProduct.tags.join(", "),
    };
  }, [selectedProduct]);

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
      qrVisible: true,
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
        <p className="text-sm text-muted-foreground">Painel administrativo separado do HappyCash normal, mas com a mesma base de produtos, caixa, estoque e planos.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-muted-foreground">Ocupacao</p>
          <p className="mt-2 text-3xl font-black">{Math.round((occupiedTables(tables).length / tables.length) * 100)}%</p>
        </article>
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-muted-foreground">Ticket aberto</p>
          <p className="mt-2 text-3xl font-black">{currency.format(openRevenue)}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-muted-foreground">Mais vendido</p>
          <p className="mt-2 text-2xl font-black">{topProduct?.name ?? "-"}</p>
        </article>
        <article className="rounded-lg border bg-card p-4 shadow-sm">
          <p className="text-xs font-bold uppercase text-muted-foreground">Plano offline</p>
          <p className="mt-2 text-3xl font-black">R$ 310</p>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Relatorios</p>
                <h4 className="text-xl font-black">Vendas por horario</h4>
              </div>
              <ChartNoAxesCombined className="h-5 w-5 text-primary" />
            </div>
            <div className="grid h-64 grid-cols-8 items-end gap-3">
              {hourlySales.map((hour) => (
                <div key={hour.label} className="flex h-full flex-col justify-end gap-2">
                  <div className="rounded-t bg-primary" style={{ height: `${hour.height}%` }} />
                  <span className="text-center text-xs font-bold text-muted-foreground">{hour.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <form onSubmit={submitTable} className="rounded-lg border bg-card p-5 shadow-sm">
              <h4 className="text-xl font-black">Criar mesas</h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <input value={tableForm.number} onChange={(event) => setTableForm((current) => ({ ...current, number: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Numero" />
                <input value={tableForm.area} onChange={(event) => setTableForm((current) => ({ ...current, area: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Area" />
                <input value={tableForm.seats} onChange={(event) => setTableForm((current) => ({ ...current, seats: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" inputMode="numeric" placeholder="Lugares" />
              </div>
              <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
                <Plus className="h-4 w-4" />
                Adicionar mesa
              </button>
            </form>

            <form onSubmit={submitWaiter} className="rounded-lg border bg-card p-5 shadow-sm">
              <h4 className="text-xl font-black">Adicionar garcom</h4>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input value={waiterForm.name} onChange={(event) => setWaiterForm((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Nome" />
                <input value={waiterForm.username} onChange={(event) => setWaiterForm((current) => ({ ...current, username: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Usuario" />
                <input value={waiterForm.pin} onChange={(event) => setWaiterForm((current) => ({ ...current, pin: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="PIN" />
                <input value={waiterForm.commissionValue} onChange={(event) => setWaiterForm((current) => ({ ...current, commissionValue: event.target.value }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="Comissao" />
                <select value={waiterForm.commissionMode} onChange={(event) => setWaiterForm((current) => ({ ...current, commissionMode: event.target.value as "percent" | "cash" }))} className="h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2 sm:col-span-2">
                  <option value="percent">% sobre vendas</option>
                  <option value="cash">Valor fixo por comanda</option>
                </select>
              </div>
              <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
                <KeyRound className="h-4 w-4" />
                Criar login
              </button>
            </form>
          </div>

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
        </div>

        <aside className="space-y-5">
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h4 className="text-xl font-black">Comissoes</h4>
            <div className="mt-4 space-y-3">
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

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h4 className="text-xl font-black">Editar produto</h4>
            <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="mt-4 h-11 w-full rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2">
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            {productEditor && selectedProduct && (
              <div className="mt-4 space-y-3">
                <input value={selectedProduct.name} onChange={(event) => onUpdateProduct({ ...selectedProduct, name: event.target.value })} className="h-11 w-full rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" />
                <input value={selectedProduct.price} onChange={(event) => onUpdateProduct({ ...selectedProduct, price: parseNumber(event.target.value) })} className="h-11 w-full rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" />
                <textarea value={productEditor.ingredientsText} onChange={(event) => updateSelectedProductText("ingredients", event.target.value)} className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-primary focus:ring-2" />
                <input value={productEditor.sizesText} onChange={(event) => updateSelectedProductText("sizes", event.target.value)} className="h-11 w-full rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" placeholder="P:39.90, M:49.90" />
                <input value={productEditor.tagsText} onChange={(event) => updateSelectedProductText("tags", event.target.value)} className="h-11 w-full rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2" />
                <p className="rounded-lg bg-muted p-3 text-sm font-bold text-muted-foreground">
                  Preco exibido: {productPriceLabel(selectedProduct)}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h4 className="text-xl font-black">Modulos do produto</h4>
            </div>
            <div className="space-y-3">
              {modules.map((module) => {
                const Icon = module.icon;
                return (
                  <article key={module.label} className="flex gap-3 rounded-lg border bg-background p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-black">{module.label}</p>
                      <p className="text-sm text-muted-foreground">{module.detail}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

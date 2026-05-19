import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarRange,
  ChartNoAxesCombined,
  ClipboardList,
  KeyRound,
  PackageCheck,
  Plus,
  ReceiptText,
  Scale,
  Trash2,
  UsersRound,
} from "lucide-react";
import type {
  CommissionMode,
  FoodClosureReceipt,
  FoodOrder,
  FoodTable,
  FoodWaiter,
  InventoryItem,
  MenuProduct,
  PaymentMethod,
  ProductTechnicalSheet,
  RecipeIngredient,
  Station,
  StockMovement,
  StockMovementType,
} from "@/types";
import { currency, normalizeSearch, occupiedTables, orderTotal, productPriceLabel, sortTablesByNumber, statusTone, waiterCommission } from "@/lib/foodMetrics";

interface AdminPanelProps {
  tables: FoodTable[];
  orders: FoodOrder[];
  products: MenuProduct[];
  waiters: FoodWaiter[];
  closureReceipts: FoodClosureReceipt[];
  inventoryItems: InventoryItem[];
  stockMovements: StockMovement[];
  technicalSheets: ProductTechnicalSheet[];
  onAddTable: (table: { number: string; area: string; seats: number }) => void;
  onDeleteTable: (tableId: string) => void;
  onAddWaiter: (waiter: Omit<FoodWaiter, "id">) => void;
  onUpdateWaiter: (waiter: FoodWaiter) => void;
  onAddProduct: (product: Omit<MenuProduct, "id">) => void;
  onUpdateProduct: (product: MenuProduct) => void;
  onDeleteProduct: (productId: string) => void;
  onRegisterStockMovement: (movement: {
    inventoryItemId: string;
    type: StockMovementType;
    quantity: number;
    unitCost: number;
    reason: string;
    source: string;
  }) => void;
  onUpdateTechnicalSheet: (sheet: ProductTechnicalSheet) => void;
}

type AdminSection = "resumo" | "modulos" | "relatorios" | "estoque" | "ficha-tecnica" | "mesas" | "comissoes" | "cadastro-produto" | "editar-produto" | "excluir-produto";
type ReportPeriod = "weekly" | "monthly" | "yearly";

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
const paymentMethodLabel: Record<PaymentMethod, string> = {
  pix: "Pix",
  debit: "Debito",
  credit: "Credito",
  voucher: "Voucher",
  card: "Cartao",
  cash: "Dinheiro",
  mixed: "Dividido",
  fiado: "Fiado",
};
const stockMovementLabel: Record<StockMovementType, string> = {
  entrada: "Entrada",
  venda: "Venda",
  perda: "Perda",
  producao: "Producao propria",
  inventario: "Inventario",
};
const reportPeriods: Array<{ id: ReportPeriod; label: string; hint: string }> = [
  { id: "weekly", label: "Semanal", hint: "Ultimos 7 dias" },
  { id: "monthly", label: "Mensal", hint: "Ultimos 30 dias" },
  { id: "yearly", label: "Anual", hint: "Ultimos 12 meses" },
];

const foodInputClassName = "h-11 rounded-lg border bg-background px-3 font-bold outline-none ring-primary focus:ring-2";
const fieldLabelClassName = "text-xs font-black uppercase tracking-wide text-muted-foreground";

const Field = ({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) => (
  <label className={`grid gap-1.5 ${className}`}>
    <span className={fieldLabelClassName}>{label}</span>
    {children}
    {hint && <span className="text-xs leading-5 text-muted-foreground">{hint}</span>}
  </label>
);

export function AdminPanel({
  tables,
  orders,
  products,
  waiters,
  closureReceipts,
  inventoryItems,
  stockMovements,
  technicalSheets,
  onAddTable,
  onDeleteTable,
  onAddWaiter,
  onUpdateWaiter,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onRegisterStockMovement,
  onUpdateTechnicalSheet,
}: AdminPanelProps) {
  const [activeSection, setActiveSection] = useState<AdminSection>("resumo");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("weekly");
  const [tableForm, setTableForm] = useState({ number: "", area: "Salao", seats: "4" });
  const [waiterForm, setWaiterForm] = useState<{
    name: string;
    username: string;
    pin: string;
    commissionMode: CommissionMode;
    commissionValue: string;
  }>({ name: "", username: "", pin: "", commissionMode: "percent", commissionValue: "5" });
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [productToDeleteId, setProductToDeleteId] = useState(products[0]?.id ?? "");
  const [stockForm, setStockForm] = useState({
    inventoryItemId: inventoryItems[0]?.id ?? "",
    type: "entrada" as StockMovementType,
    quantity: "1",
    unitCost: "",
    reason: "",
    source: "Administrador",
  });
  const [technicalProductId, setTechnicalProductId] = useState(products[0]?.id ?? "");
  const [recipeDraft, setRecipeDraft] = useState("");
  const [sheetMetaForm, setSheetMetaForm] = useState({ yieldQuantity: "1", packagingCost: "0", wastePercent: "0", notes: "" });
  const normalizedProductSearch = useMemo(() => normalizeSearch(productSearch), [productSearch]);
  const filteredProducts = useMemo(() => {
    if (!normalizedProductSearch) return products;
    return products.filter((product) => normalizeSearch(product.name).includes(normalizedProductSearch));
  }, [products, normalizedProductSearch]);
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? filteredProducts[0] ?? products[0] ?? null;
  const selectedInventoryItem = inventoryItems.find((item) => item.id === stockForm.inventoryItemId) ?? inventoryItems[0] ?? null;
  const selectedTechnicalProduct = products.find((product) => product.id === technicalProductId) ?? products[0] ?? null;
  const selectedTechnicalSheet = selectedTechnicalProduct
    ? technicalSheets.find((sheet) => sheet.productId === selectedTechnicalProduct.id)
    : undefined;
  const lowStockItems = useMemo(
    () => inventoryItems.filter((item) => item.currentStock <= item.minimumStock),
    [inventoryItems],
  );
  const expiringItems = useMemo(() => {
    const limit = Date.now() + 7 * 24 * 60 * 60 * 1000;
    return inventoryItems.filter((item) => {
      if (!item.expirationDate) return false;
      const expirationTime = new Date(item.expirationDate).getTime();
      return Number.isFinite(expirationTime) && expirationTime <= limit;
    });
  }, [inventoryItems]);
  const stockValue = inventoryItems.reduce((sum, item) => sum + item.currentStock * item.averageCost, 0);
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
  const sortedClosureReceipts = useMemo(
    () => [...closureReceipts].sort((left, right) => new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime()),
    [closureReceipts],
  );
  const reportWindow = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (reportPeriod === "weekly") {
      start.setDate(start.getDate() - 6);
    } else if (reportPeriod === "monthly") {
      start.setDate(start.getDate() - 29);
    } else {
      start.setMonth(start.getMonth() - 11, 1);
      start.setHours(0, 0, 0, 0);
    }

    return { start, end };
  }, [reportPeriod]);
  const receiptsInPeriod = useMemo(
    () =>
      sortedClosureReceipts.filter((receipt) => {
        const paidAt = new Date(receipt.paidAt).getTime();
        return paidAt >= reportWindow.start.getTime() && paidAt <= reportWindow.end.getTime();
      }),
    [reportWindow.end, reportWindow.start, sortedClosureReceipts],
  );
  const reportRevenue = receiptsInPeriod.reduce((sum, receipt) => sum + receipt.total, 0);
  const reportOrderCount = receiptsInPeriod.length;
  const reportItemCount = receiptsInPeriod.reduce(
    (sum, receipt) => sum + receipt.items.reduce((subtotal, item) => subtotal + item.quantity, 0),
    0,
  );
  const averageTicket = reportOrderCount > 0 ? reportRevenue / reportOrderCount : 0;
  const reportTopMethods = useMemo(() => {
    const totals = new Map<PaymentMethod, { method: PaymentMethod; total: number; count: number }>();

    receiptsInPeriod.forEach((receipt) => {
      const current = totals.get(receipt.method) ?? { method: receipt.method, total: 0, count: 0 };
      current.total += receipt.total;
      current.count += 1;
      totals.set(receipt.method, current);
    });

    return Array.from(totals.values()).sort((left, right) => right.total - left.total);
  }, [receiptsInPeriod]);
  const reportTopProducts = useMemo(() => {
    const ranking = new Map<string, { productId: string; productName: string; quantity: number; revenue: number }>();

    receiptsInPeriod.forEach((receipt) => {
      receipt.items.forEach((item) => {
        const current = ranking.get(item.productId) ?? {
          productId: item.productId,
          productName: item.productName,
          quantity: 0,
          revenue: 0,
        };
        current.quantity += item.quantity;
        current.revenue += item.revenue;
        ranking.set(item.productId, current);
      });
    });

    return Array.from(ranking.values())
      .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
      .slice(0, 5);
  }, [receiptsInPeriod]);
  const reportWaiters = useMemo(() => {
    const ranking = new Map<string, { waiterName: string; total: number; count: number }>();

    receiptsInPeriod.forEach((receipt) => {
      const current = ranking.get(receipt.waiterName) ?? { waiterName: receipt.waiterName, total: 0, count: 0 };
      current.total += receipt.total;
      current.count += 1;
      ranking.set(receipt.waiterName, current);
    });

    return Array.from(ranking.values()).sort((left, right) => right.total - left.total || right.count - left.count);
  }, [receiptsInPeriod]);
  const highlightedWaiter = reportWaiters[0];

  useEffect(() => {
    if (filteredProducts.some((product) => product.id === selectedProductId)) return;
    setSelectedProductId(filteredProducts[0]?.id ?? "");
  }, [filteredProducts, selectedProductId]);

  useEffect(() => {
    if (filteredProducts.some((product) => product.id === productToDeleteId)) return;
    setProductToDeleteId(filteredProducts[0]?.id ?? "");
  }, [filteredProducts, productToDeleteId]);

  useEffect(() => {
    if (inventoryItems.some((item) => item.id === stockForm.inventoryItemId)) return;
    setStockForm((current) => ({ ...current, inventoryItemId: inventoryItems[0]?.id ?? "" }));
  }, [inventoryItems, stockForm.inventoryItemId]);

  useEffect(() => {
    if (products.some((product) => product.id === technicalProductId)) return;
    setTechnicalProductId(products[0]?.id ?? "");
  }, [products, technicalProductId]);

  useEffect(() => {
    if (!selectedTechnicalProduct) {
      setRecipeDraft("");
      setSheetMetaForm({ yieldQuantity: "1", packagingCost: "0", wastePercent: "0", notes: "" });
      return;
    }
    const sheet = technicalSheets.find((technicalSheet) => technicalSheet.productId === selectedTechnicalProduct.id);
    setRecipeDraft(
      sheet?.ingredients
        .map((ingredient) => `${ingredient.inventoryItemName} | ${ingredient.quantity} | ${ingredient.unit}`)
        .join("\n") || "",
    );
    setSheetMetaForm({
      yieldQuantity: String(sheet?.yieldQuantity || 1),
      packagingCost: String(sheet?.packagingCost || 0),
      wastePercent: String(sheet?.wastePercent || 0),
      notes: sheet?.notes || "",
    });
  }, [selectedTechnicalProduct?.id, technicalSheets]);

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
    { id: "modulos", label: "Modulos" },
    { id: "relatorios", label: "Relatorios" },
    { id: "estoque", label: "Estoque" },
    { id: "ficha-tecnica", label: "Ficha tecnica" },
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

  const submitStockMovement = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedInventoryItem) return;
    const quantity = parseNumber(stockForm.quantity);
    if (quantity <= 0 && stockForm.type !== "inventario") return;
    onRegisterStockMovement({
      inventoryItemId: selectedInventoryItem.id,
      type: stockForm.type,
      quantity,
      unitCost: parseNumber(stockForm.unitCost) || selectedInventoryItem.averageCost,
      reason: stockForm.reason,
      source: stockForm.source,
    });
    setStockForm((current) => ({
      ...current,
      quantity: "1",
      unitCost: "",
      reason: "",
      source: "Administrador",
    }));
  };

  const parseRecipeDraft = (): RecipeIngredient[] =>
    recipeDraft
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name = "", quantity = "0"] = line.split("|").map((part) => part.trim());
        const inventoryItem = inventoryItems.find((item) => normalizeSearch(item.name) === normalizeSearch(name));
        if (!inventoryItem) return null;
        return {
          inventoryItemId: inventoryItem.id,
          inventoryItemName: inventoryItem.name,
          quantity: parseNumber(quantity),
          unit: inventoryItem.unit,
        };
      })
      .filter((ingredient): ingredient is RecipeIngredient => Boolean(ingredient && ingredient.quantity > 0));

  const submitTechnicalSheet = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTechnicalProduct) return;
    const ingredients = parseRecipeDraft();
    if (!ingredients.length) return;
    onUpdateTechnicalSheet({
      id: selectedTechnicalSheet?.id ?? `sheet-${Date.now()}`,
      productId: selectedTechnicalProduct.id,
      productName: selectedTechnicalProduct.name,
      yieldQuantity: Math.max(1, parseNumber(sheetMetaForm.yieldQuantity)),
      packagingCost: Math.max(0, parseNumber(sheetMetaForm.packagingCost)),
      wastePercent: Math.max(0, parseNumber(sheetMetaForm.wastePercent)),
      notes: sheetMetaForm.notes.trim(),
      ingredients,
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
          <p className="text-xs font-bold uppercase text-muted-foreground">Fechamentos</p>
          <p className="mt-2 text-3xl font-black">{sortedClosureReceipts.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">fechamentos registrados</p>
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

      {activeSection === "modulos" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h4 className="text-xl font-black">HappyCashFood: sistema interno</h4>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Gestao de produtos, categorias e fichas tecnicas",
                "Estoque com entrada, perda, inventario e baixa por venda",
                "PDV rapido, caixa, descontos, troco e multiplos pagamentos",
                "Mesas, comandas, transferencia, fechamento e divisao de conta",
                "KDS para cozinha, bar, pizzaria e balcao",
                "Delivery com taxa, bairro, motoboy, tempo e WhatsApp",
                "Relatorios, ticket medio, ranking e comissao de garcom",
                "Operacao offline com impressao ESC/POS no desktop",
              ].map((item) => (
                <p key={item} className="rounded-lg border bg-background p-3 text-sm font-bold text-muted-foreground">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-primary" />
              <h4 className="text-xl font-black">HappyCashMenu: cardapio publico</h4>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Cardapio bonito com logo, capa, promocoes e categorias",
                "Produto com foto, preco, tempo, adicionais e observacao",
                "Carrinho, editar item, remover item e confirmacao sensivel",
                "QR Code por mesa e link de delivery organizado",
                "Cliente pede por mesa, retirada ou delivery",
                "QR abre o cardapio; dentro dele o cliente chama garcom ou fecha conta",
                "Login de fidelidade com email, senha e endereco",
                "Pedido cai no HappyCashFood separado por setor",
              ].map((item) => (
                <p key={item} className="rounded-lg border bg-background p-3 text-sm font-bold text-muted-foreground">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === "estoque" && (
        <div className="space-y-5">
          <div className="grid gap-3 lg:grid-cols-4">
            <article className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted-foreground">Valor em estoque</p>
              <p className="mt-2 text-3xl font-black">{currency.format(stockValue)}</p>
            </article>
            <article className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted-foreground">Itens no minimo</p>
              <p className="mt-2 text-3xl font-black text-amber-500">{lowStockItems.length}</p>
            </article>
            <article className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted-foreground">Validade proxima</p>
              <p className="mt-2 text-3xl font-black text-destructive">{expiringItems.length}</p>
            </article>
            <article className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted-foreground">Movimentos</p>
              <p className="mt-2 text-3xl font-black">{stockMovements.length}</p>
            </article>
          </div>

          <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
            <form onSubmit={submitStockMovement} className="rounded-lg border bg-card p-5 shadow-sm">
              <h4 className="text-xl font-black">Movimentar estoque</h4>
              <p className="mt-1 text-sm text-muted-foreground">Registre entrada, perda, inventario ou producao propria sem mexer em codigo.</p>
              <div className="mt-4 grid gap-3">
                <Field label="Ingrediente ou insumo">
                  <select
                    value={stockForm.inventoryItemId}
                    onChange={(event) => setStockForm((current) => ({ ...current, inventoryItemId: event.target.value }))}
                    className={foodInputClassName}
                  >
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tipo de movimento">
                  <select
                    value={stockForm.type}
                    onChange={(event) => setStockForm((current) => ({ ...current, type: event.target.value as StockMovementType }))}
                    className={foodInputClassName}
                  >
                    {Object.entries(stockMovementLabel).map(([type, label]) => (
                      <option key={type} value={type}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={stockForm.type === "inventario" ? "Saldo contado" : "Quantidade"}>
                    <input value={stockForm.quantity} onChange={(event) => setStockForm((current) => ({ ...current, quantity: event.target.value }))} className={foodInputClassName} inputMode="decimal" />
                  </Field>
                  <Field label="Custo unitario">
                    <input value={stockForm.unitCost} onChange={(event) => setStockForm((current) => ({ ...current, unitCost: event.target.value }))} className={foodInputClassName} inputMode="decimal" placeholder={selectedInventoryItem ? String(selectedInventoryItem.averageCost) : "0"} />
                  </Field>
                </div>
                <Field label="Motivo">
                  <input value={stockForm.reason} onChange={(event) => setStockForm((current) => ({ ...current, reason: event.target.value }))} className={foodInputClassName} placeholder="Ex: compra, perda, validade, producao de massa" />
                </Field>
                <Field label="Origem">
                  <input value={stockForm.source} onChange={(event) => setStockForm((current) => ({ ...current, source: event.target.value }))} className={foodInputClassName} placeholder="Ex: fornecedor, inventario, venda" />
                </Field>
              </div>
              <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
                <Scale className="h-4 w-4" />
                Registrar movimento
              </button>
            </form>

            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xl font-black">Controle de estoque</h4>
                  <p className="text-sm text-muted-foreground">Unidade, validade, estoque minimo e custo medio por insumo.</p>
                </div>
                {lowStockItems.length > 0 ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-black text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    Falta chegando
                  </span>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {inventoryItems.map((item) => {
                  const low = item.currentStock <= item.minimumStock;
                  return (
                    <article key={item.id} className={`rounded-lg border bg-background p-3 ${low ? "border-amber-400/50" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{item.name}</p>
                          <p className="text-xs font-bold text-muted-foreground">{item.supplier} - {item.productionArea || "Estoque"}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${low ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                          {item.currentStock} {item.unit}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-muted-foreground">
                        <span>Minimo: {item.minimumStock} {item.unit}</span>
                        <span>Custo: {currency.format(item.averageCost)}</span>
                        <span>Validade: {item.expirationDate ? new Intl.DateTimeFormat("pt-BR").format(new Date(item.expirationDate)) : "-"}</span>
                        <span>Ultimo mov.: {new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", dateStyle: "short" }).format(new Date(item.lastMovementAt))}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <h4 className="text-xl font-black">Historico recente de estoque</h4>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {stockMovements.slice(0, 9).map((movement) => (
                <article key={movement.id} className="rounded-lg border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{movement.inventoryItemName}</p>
                      <p className="text-xs font-bold text-muted-foreground">{stockMovementLabel[movement.type]} - {movement.source}</p>
                    </div>
                    <span className="text-sm font-black">{movement.quantity} {movement.unit}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">{movement.reason}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSection === "ficha-tecnica" && (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <form onSubmit={submitTechnicalSheet} className="rounded-lg border bg-card p-5 shadow-sm">
            <h4 className="text-xl font-black">Ficha tecnica do produto</h4>
            <p className="mt-1 text-sm text-muted-foreground">Defina os ingredientes que baixam automaticamente quando o item e vendido.</p>
            <div className="mt-4 grid gap-3">
              <Field label="Produto">
                <select value={technicalProductId} onChange={(event) => setTechnicalProductId(event.target.value)} className={foodInputClassName}>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Rende">
                  <input value={sheetMetaForm.yieldQuantity} onChange={(event) => setSheetMetaForm((current) => ({ ...current, yieldQuantity: event.target.value }))} className={foodInputClassName} inputMode="decimal" />
                </Field>
                <Field label="Embalagem">
                  <input value={sheetMetaForm.packagingCost} onChange={(event) => setSheetMetaForm((current) => ({ ...current, packagingCost: event.target.value }))} className={foodInputClassName} inputMode="decimal" />
                </Field>
                <Field label="Perda %">
                  <input value={sheetMetaForm.wastePercent} onChange={(event) => setSheetMetaForm((current) => ({ ...current, wastePercent: event.target.value }))} className={foodInputClassName} inputMode="decimal" />
                </Field>
              </div>
              <Field
                label="Ingredientes"
                hint="Uma linha por ingrediente: Nome do estoque | quantidade | unidade. Ex: Pao brioche | 1 | unidade"
              >
                <textarea value={recipeDraft} onChange={(event) => setRecipeDraft(event.target.value)} className="min-h-44 rounded-lg border bg-background px-3 py-2 text-sm font-semibold outline-none ring-primary focus:ring-2" />
              </Field>
              <Field label="Observacoes">
                <textarea value={sheetMetaForm.notes} onChange={(event) => setSheetMetaForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-20 rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-primary focus:ring-2" />
              </Field>
            </div>
            <button type="submit" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-black text-primary-foreground">
              <ClipboardList className="h-4 w-4" />
              Salvar ficha
            </button>
          </form>

          <div className="space-y-5">
            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <h4 className="text-xl font-black">Insumos disponiveis</h4>
              <div className="mt-4 flex flex-wrap gap-2">
                {inventoryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRecipeDraft((current) => `${current}${current ? "\n" : ""}${item.name} | 1 | ${item.unit}`)}
                    className="rounded-full border bg-background px-3 py-1.5 text-xs font-black text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    + {item.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <h4 className="text-xl font-black">Fichas cadastradas</h4>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {technicalSheets.map((sheet) => {
                  const product = products.find((item) => item.id === sheet.productId);
                  const ingredientCost = sheet.ingredients.reduce((sum, ingredient) => {
                    const inventoryItem = inventoryItems.find((item) => item.id === ingredient.inventoryItemId);
                    return sum + (inventoryItem?.averageCost || 0) * ingredient.quantity;
                  }, 0);
                  const estimatedCost = ingredientCost + sheet.packagingCost;
                  const margin = product ? product.price - estimatedCost : 0;
                  return (
                    <article key={sheet.id} className="rounded-lg border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black">{sheet.productName}</p>
                          <p className="text-xs font-bold text-muted-foreground">{sheet.ingredients.length} ingrediente(s)</p>
                        </div>
                        <span className="text-sm font-black text-primary">{currency.format(estimatedCost)}</span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs font-bold text-muted-foreground">
                        {sheet.ingredients.map((ingredient) => (
                          <p key={`${sheet.id}-${ingredient.inventoryItemId}`}>
                            {ingredient.quantity} {ingredient.unit} - {ingredient.inventoryItemName}
                          </p>
                        ))}
                      </div>
                      <p className="mt-3 rounded-lg bg-muted p-2 text-xs font-black text-muted-foreground">
                        Margem estimada: {currency.format(margin)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === "relatorios" && (
        <div className="space-y-5">
          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Administrador</p>
                <h4 className="text-xl font-black">Relatorios semanal, mensal e anual</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Baseado nos fechamentos ja concluidos no HappyCashFood.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {reportPeriods.map((period) => (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => setReportPeriod(period.id)}
                    className={`rounded-lg border px-4 py-2 text-sm font-black transition ${
                      reportPeriod === period.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:border-primary hover:text-foreground"
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarRange className="h-4 w-4 text-primary" />
              {reportPeriods.find((period) => period.id === reportPeriod)?.hint}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <article className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted-foreground">Faturamento</p>
              <p className="mt-2 text-3xl font-black">{currency.format(reportRevenue)}</p>
            </article>
            <article className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted-foreground">Fechamentos</p>
              <p className="mt-2 text-3xl font-black">{reportOrderCount}</p>
            </article>
            <article className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted-foreground">Ticket medio</p>
              <p className="mt-2 text-3xl font-black">{currency.format(averageTicket)}</p>
            </article>
            <article className="rounded-lg border bg-card p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-muted-foreground">Itens vendidos</p>
              <p className="mt-2 text-3xl font-black">{reportItemCount}</p>
            </article>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-primary" />
                <h4 className="text-xl font-black">Formas de pagamento</h4>
              </div>
              <div className="space-y-3">
                {reportTopMethods.length > 0 ? (
                  reportTopMethods.map((entry) => (
                    <article key={entry.method} className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-black">{paymentMethodLabel[entry.method]}</p>
                          <p className="text-xs text-muted-foreground">{entry.count} fechamento(s)</p>
                        </div>
                        <p className="font-black">{currency.format(entry.total)}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                    Nenhum fechamento no periodo selecionado.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-primary" />
                <h4 className="text-xl font-black">Produtos mais vendidos</h4>
              </div>
              <div className="space-y-3">
                {reportTopProducts.length > 0 ? (
                  reportTopProducts.map((product, index) => (
                    <article key={product.productId} className="rounded-lg border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase text-muted-foreground">#{index + 1}</p>
                          <p className="font-black">{product.productName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black">{product.quantity} item(ns)</p>
                          <p className="text-xs text-muted-foreground">{currency.format(product.revenue)}</p>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                    Ainda nao existe produto vendido nesse periodo.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <UsersRound className="h-5 w-5 text-primary" />
                <h4 className="text-xl font-black">Equipe em destaque</h4>
              </div>
              <div className="space-y-3">
                {highlightedWaiter ? (
                  <article className="rounded-lg border bg-background p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">Garcom destaque</p>
                    <p className="mt-1 text-xl font-black">{highlightedWaiter.waiterName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {highlightedWaiter.count} fechamento(s) no periodo
                    </p>
                    <p className="mt-3 text-2xl font-black text-primary">{currency.format(highlightedWaiter.total)}</p>
                  </article>
                ) : (
                  <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                    Ainda nao ha destaque de equipe nesse periodo.
                  </p>
                )}

                {reportWaiters.slice(0, 4).map((waiter) => (
                  <article key={waiter.waiterName} className="rounded-lg border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black">{waiter.waiterName}</p>
                        <p className="text-xs text-muted-foreground">{waiter.count} fechamento(s)</p>
                      </div>
                      <p className="font-black">{currency.format(waiter.total)}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">Historico do periodo</p>
                <h4 className="text-xl font-black">Ultimos fechamentos</h4>
              </div>
              <ChartNoAxesCombined className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-3">
              {receiptsInPeriod.length > 0 ? (
                receiptsInPeriod.slice(0, 8).map((receipt) => (
                  <article key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3">
                    <div>
                      <p className="font-black">Mesa {receipt.tableNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(receipt.paidAt))} • {paymentMethodLabel[receipt.method]} • {receipt.waiterName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black">{currency.format(receipt.total)}</p>
                      <p className="text-xs text-muted-foreground">{receipt.paidBy}</p>
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                  Nenhum fechamento encontrado no periodo selecionado.
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
              <Field label="Numero da mesa" hint="Identificacao exibida no mapa, como 01, 02, Balcao 1 ou Deck 4.">
                <input value={tableForm.number} onChange={(event) => setTableForm((current) => ({ ...current, number: event.target.value }))} className={foodInputClassName} placeholder="Ex: 01" />
              </Field>
              <Field label="Ambiente da mesa" hint="Salao, varanda, balcao, deck ou outro setor do restaurante.">
                <input value={tableForm.area} onChange={(event) => setTableForm((current) => ({ ...current, area: event.target.value }))} className={foodInputClassName} placeholder="Ex: Salao" />
              </Field>
              <Field label="Quantidade de lugares" hint="Numero de pessoas que a mesa comporta.">
                <input value={tableForm.seats} onChange={(event) => setTableForm((current) => ({ ...current, seats: event.target.value }))} className={foodInputClassName} inputMode="numeric" placeholder="Ex: 4" />
              </Field>
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
              <Field label="Nome do garcom" hint="Nome mostrado nas comandas, relatorios e fechamento.">
                <input value={waiterForm.name} onChange={(event) => setWaiterForm((current) => ({ ...current, name: event.target.value }))} className={foodInputClassName} placeholder="Ex: Ana" />
              </Field>
              <Field label="Usuario de login" hint="Login curto para o garcom entrar no sistema.">
                <input value={waiterForm.username} onChange={(event) => setWaiterForm((current) => ({ ...current, username: event.target.value }))} className={foodInputClassName} placeholder="Ex: ana" />
              </Field>
              <Field label="PIN ou senha do garcom" hint="Credencial usada pelo garcom no login operacional.">
                <input value={waiterForm.pin} onChange={(event) => setWaiterForm((current) => ({ ...current, pin: event.target.value }))} className={foodInputClassName} placeholder="Ex: 1111" />
              </Field>
              <Field label="Valor da comissao" hint="Use percentual, como 6, ou valor fixo em reais, como 4.">
                <input value={waiterForm.commissionValue} onChange={(event) => setWaiterForm((current) => ({ ...current, commissionValue: event.target.value }))} className={foodInputClassName} placeholder="Ex: 5" />
              </Field>
              <Field label="Tipo de comissao">
                <select value={waiterForm.commissionMode} onChange={(event) => setWaiterForm((current) => ({ ...current, commissionMode: event.target.value as "percent" | "cash" }))} className={foodInputClassName}>
                  <option value="percent">% sobre vendas</option>
                  <option value="cash">Valor fixo por comanda</option>
                </select>
              </Field>
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
          <p className="mt-1 text-sm text-muted-foreground">Preencha os dados que aparecem no cardapio, no caixa, no estoque e na cozinha.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Field label="Codigo do produto" hint="Codigo interno usado na busca e no atendimento.">
              <input value={productForm.code} onChange={(event) => setProductForm((current) => ({ ...current, code: event.target.value }))} className={foodInputClassName} placeholder="Ex: 900" />
            </Field>
            <Field label="Nome do produto" hint="Nome exibido no cardapio, caixa e cozinha." className="md:col-span-2">
              <input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} className={foodInputClassName} placeholder="Ex: Pizza calabresa" />
            </Field>
            <Field label="Categoria do cardapio" hint="Grupo onde o produto aparece, como Pizza, Burger ou Bebidas.">
              <input value={productForm.category} onChange={(event) => setProductForm((current) => ({ ...current, category: event.target.value }))} className={foodInputClassName} placeholder="Ex: Pizza" />
            </Field>
            <Field label="Preco de venda" hint="Valor cobrado do cliente.">
              <input value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} className={foodInputClassName} placeholder="Ex: 49,90" />
            </Field>
            <Field label="Custo do produto" hint="Usado para margem e relatorios.">
              <input value={productForm.costPrice} onChange={(event) => setProductForm((current) => ({ ...current, costPrice: event.target.value }))} className={foodInputClassName} placeholder="Ex: 19,80" />
            </Field>
            <Field label="Setor de preparo" hint="Para onde o pedido sera enviado no KDS.">
              <select value={productForm.station} onChange={(event) => setProductForm((current) => ({ ...current, station: event.target.value as Station }))} className={foodInputClassName}>
                <option value="kitchen">Cozinha</option>
                <option value="bar">Bar</option>
                <option value="counter">Pizzaria / Balcao</option>
              </select>
            </Field>
            <Field label="Estoque atual" hint="Quantidade disponivel para venda.">
              <input value={productForm.stock} onChange={(event) => setProductForm((current) => ({ ...current, stock: event.target.value }))} className={foodInputClassName} placeholder="Ex: 32" />
            </Field>
            <Field label="Tempo de preparo" hint="Tempo medio em minutos.">
              <input value={productForm.prepMinutes} onChange={(event) => setProductForm((current) => ({ ...current, prepMinutes: event.target.value }))} className={foodInputClassName} placeholder="Ex: 18" />
            </Field>
            <Field label="Descricao do produto" hint="Texto curto para explicar o item ao cliente." className="md:col-span-3">
              <input value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} className={foodInputClassName} placeholder="Ex: Calabresa, mussarela, cebola e oregano." />
            </Field>
            <Field label="Ingredientes" hint="Separe por virgula. Ex: massa, molho, calabresa, cebola." className="md:col-span-3">
              <input value={productForm.ingredients} onChange={(event) => setProductForm((current) => ({ ...current, ingredients: event.target.value }))} className={foodInputClassName} placeholder="Ex: massa, molho, calabresa" />
            </Field>
            <Field label="Tamanhos e precos" hint="Opcional. Use P:39.90, M:49.90, G:64.90." className="md:col-span-2">
              <input value={productForm.sizes} onChange={(event) => setProductForm((current) => ({ ...current, sizes: event.target.value }))} className={foodInputClassName} placeholder="Ex: P:39.90, M:49.90" />
            </Field>
            <Field label="Tags do produto" hint="Opcional. Ex: mais vendido, sem lactose, promocao.">
              <input value={productForm.tags} onChange={(event) => setProductForm((current) => ({ ...current, tags: event.target.value }))} className={foodInputClassName} placeholder="Ex: mais vendido" />
            </Field>
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

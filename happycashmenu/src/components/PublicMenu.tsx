import {
  CheckCircle2,
  ChefHat,
  Clock,
  CreditCard,
  LogIn,
  MapPin,
  MessageSquareText,
  Minus,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  UserPlus,
  Utensils,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { BrandMark } from "@/components/BrandMark";
import { FoodImage } from "@/components/FoodImage";
import { Modal } from "@/components/Modal";
import { QuantityStepper } from "@/components/QuantityStepper";
import {
  getMenuCustomerSession,
  signInMenuCustomer,
  signOutMenuCustomer,
  signUpMenuCustomer,
  upsertMenuCustomerProfile,
} from "@/lib/customerAuth";
import { createPublicMenuAction, createPublicOrder, fetchPublicMenu } from "@/lib/menuApi";
import { currency } from "@/lib/format";
import type { CartItem, CartOptionSelection, CustomerInfo, MenuItem, MenuOptionGroup, PaymentTiming, PublicMenuPayload } from "@/types";
import { getPublicErrorMessage } from "../../../shared/security/redaction";

type PublicMenuProps = {
  slug: string;
  tableSlug?: string | null;
};

const emptyCustomer: CustomerInfo = {
  email: "",
  name: "",
  phone: "",
  address: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  paymentMethod: "pix",
  loyaltyOptIn: false,
};

const itemOptionsTotal = (options: CartOptionSelection[]) =>
  options.reduce((sum, option) => sum + option.priceDelta * option.quantity, 0);

const cartItemTotal = (item: CartItem) =>
  (item.unitPrice + itemOptionsTotal(item.options)) * item.quantity;

const optionKey = (groupId: string, valueId: string) => `${groupId}:${valueId}`;
const customerStorageKey = (storeId: string) => `happycash:menu:customer:${storeId}`;
const waiterReasons = [
  "Falar com o garcom",
  "Pedir talheres ou guardanapo",
  "Limpar a mesa",
  "Duvida sobre o pedido",
] as const;

const clearStoredCustomerProfile = (storeId: string) => {
  if (typeof window === "undefined" || !storeId) return;
  window.localStorage.removeItem(customerStorageKey(storeId));
  window.sessionStorage.removeItem(customerStorageKey(storeId));
};

const useRevealOnScroll = (watchKey: string) => {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!elements.length) return undefined;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    }, {
      threshold: 0.12,
      rootMargin: "0px 0px -8% 0px",
    });

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [watchKey]);
};

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="hc-label">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-[-0.05em] text-foreground sm:text-[2rem]">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function FeaturedMenuCard({
  item,
  index,
  onSelect,
}: {
  item: MenuItem;
  index: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-reveal
      style={{ transitionDelay: `${Math.min(index * 60, 260)}ms` }}
      className="reveal-on-scroll menu-surface group relative min-w-[284px] max-w-[320px] flex-1 overflow-hidden rounded-[32px] text-left transition duration-300 hover:-translate-y-1 hover:shadow-panel"
      onClick={onSelect}
    >
      <div className="relative">
        <FoodImage
          src={item.imageUrl}
          alt={item.imageAlt}
          className="aspect-[1.24] w-full transition duration-700 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1f1710]/78 via-[#1f1710]/8 to-transparent" />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          {item.promotion ? (
            <span className="menu-chip bg-white text-[#ff7a00] shadow-[0_10px_24px_rgba(24,16,8,0.18)]">
              {item.promotion.badgeLabel}
            </span>
          ) : (
            <span className="menu-chip bg-white/14 text-white backdrop-blur">
              <Clock size={14} /> {item.prepMinutes} min
            </span>
          )}
          {item.compareAtPrice ? (
            <span className="rounded-full bg-[#1c140f]/72 px-3 py-1 text-xs font-extrabold text-white/78 backdrop-blur">
              {currency(item.compareAtPrice)}
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="text-2xl font-extrabold tracking-[-0.04em]">{item.displayName}</p>
          <p className="mt-2 line-clamp-2 max-w-[22rem] text-sm font-semibold leading-6 text-white/78">{item.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 p-5">
        <div>
          {item.promotion ? <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[#ff7a00]">{item.promotion.title}</p> : null}
          <p className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-foreground">{currency(item.price)}</p>
        </div>
        <span className="inline-flex h-12 items-center rounded-full bg-[#fff1e3] px-4 text-sm font-extrabold text-[#ff7a00]">
          <ShoppingBag className="mr-2" size={17} />
          Ver
        </span>
      </div>
    </button>
  );
}

function MenuProductCard({
  item,
  index,
  onSelect,
}: {
  item: MenuItem;
  index: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      data-reveal
      style={{ transitionDelay: `${Math.min(index * 45, 260)}ms` }}
      className="reveal-on-scroll menu-surface group rounded-[30px] p-4 text-left transition duration-300 hover:-translate-y-1 hover:shadow-panel"
      onClick={onSelect}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.promotion ? (
              <span className="menu-chip bg-[#fff1e3] text-[#ff7a00]">
                {item.promotion.badgeLabel}
              </span>
            ) : null}
            <span className="menu-chip bg-[#fff7f0] text-muted-foreground">
              <Clock size={14} /> {item.prepMinutes} min
            </span>
          </div>

          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-xl font-extrabold tracking-[-0.04em] text-foreground">{item.displayName}</h3>
              {item.promotion ? <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.22em] text-[#ff7a00]">{item.promotion.title}</p> : null}
            </div>
            <div className="shrink-0 text-right">
              {item.compareAtPrice ? (
                <p className="text-xs font-extrabold text-muted-foreground line-through">{currency(item.compareAtPrice)}</p>
              ) : null}
              <p className="text-lg font-extrabold tracking-[-0.04em] text-foreground">{currency(item.price)}</p>
            </div>
          </div>

          <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-muted-foreground">{item.description}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {item.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-[#fff7f0] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7c6553]">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <FoodImage
          src={item.imageUrl}
          alt={item.imageAlt}
          className="h-28 w-24 rounded-[24px] shadow-[0_16px_32px_rgba(56,35,16,0.14)] transition duration-500 group-hover:scale-[1.03] sm:h-32 sm:w-28"
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-muted-foreground">
          {item.options.length > 0 ? `${item.options.length} personalizacao(oes)` : "Pronto para adicionar"}
        </span>
        <span className="inline-flex items-center rounded-full bg-[#17120d] px-4 py-2 text-sm font-extrabold text-white">
          <ShoppingBag className="mr-2" size={16} />
          Adicionar
        </span>
      </div>
    </button>
  );
}

function ProductModal({
  product,
  open,
  onClose,
  onAdd,
}: {
  product: MenuItem | null;
  open: boolean;
  onClose: () => void;
  onAdd: (item: CartItem) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Record<string, CartOptionSelection>>({});
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);

  useEffect(() => {
    setQuantity(1);
    setNotes("");
    setSelected({});
    setRemovedIngredients([]);
  }, [product?.id]);

  if (!product) return null;

  const selectedOptions = Object.values(selected);
  const optionTotal = itemOptionsTotal(selectedOptions);
  const total = (product.price + optionTotal) * quantity;

  const toggleOption = (group: MenuOptionGroup, valueId: string) => {
    const value = group.values.find((optionValue) => optionValue.id === valueId);
    if (!value) return;
    const key = optionKey(group.id, value.id);

    setSelected((current) => {
      const next = { ...current };
      if (group.optionType === "single") {
        Object.keys(next).forEach((selectedKey) => {
          if (selectedKey.startsWith(`${group.id}:`)) delete next[selectedKey];
        });
        next[key] = {
          groupId: group.id,
          groupName: group.name,
          valueId: value.id,
          valueName: value.name,
          priceDelta: value.priceDelta,
          quantity: 1,
        };
        return next;
      }

      if (next[key]) {
        delete next[key];
        return next;
      }

      const selectedInGroup = Object.values(next).filter((option) => option.groupId === group.id).length;
      if (group.maxSelected && selectedInGroup >= group.maxSelected) return next;

      next[key] = {
        groupId: group.id,
        groupName: group.name,
        valueId: value.id,
        valueName: value.name,
        priceDelta: value.priceDelta,
        quantity: 1,
      };
      return next;
    });
  };

  const missingRequired = product.options.some((group) => {
    if (!group.required) return false;
    return !Object.values(selected).some((option) => option.groupId === group.id);
  });
  const removableIngredients = (product.removableIngredients || []).map((ingredient) => ingredient.trim()).filter(Boolean);

  const toggleRemovedIngredient = (ingredient: string) => {
    setRemovedIngredients((current) => (
      current.includes(ingredient)
        ? current.filter((item) => item !== ingredient)
        : [...current, ingredient]
    ));
  };

  return (
    <Modal
      title={product.displayName}
      subtitle={product.promotion ? product.promotion.title : currency(product.price)}
      open={open}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <QuantityStepper value={quantity} onChange={setQuantity} />
          <button
            type="button"
            className="hc-button-primary flex-1 sm:min-w-[240px] sm:flex-none"
            disabled={missingRequired}
            onClick={() => {
              onAdd({
                cartId: crypto.randomUUID(),
                itemId: product.id,
                name: product.displayName,
                imageUrl: product.imageUrl,
                unitPrice: product.price,
                quantity,
                notes,
                removedIngredients,
                station: product.station,
                options: selectedOptions,
              });
              onClose();
            }}
          >
            <ShoppingBag size={18} />
            Adicionar {currency(total)}
          </button>
        </div>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="menu-surface overflow-hidden rounded-[32px] p-3">
          <FoodImage src={product.imageUrl} alt={product.imageAlt} className="aspect-[4/3] w-full rounded-[28px]" />
        </div>
        <div className="space-y-4">
          {product.promotion ? (
            <div className="menu-surface rounded-[28px] p-4">
              <p className="text-sm font-extrabold uppercase tracking-[0.22em] text-[#ff7a00]">
                {product.promotion.badgeLabel} | {product.promotion.title}
              </p>
              {product.promotion.description ? (
                <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">{product.promotion.description}</p>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3">
            <p className="text-sm font-semibold leading-6 text-muted-foreground">{product.description}</p>
            <div className="flex items-end gap-2">
              {product.compareAtPrice ? <span className="text-sm font-extrabold text-muted-foreground line-through">{currency(product.compareAtPrice)}</span> : null}
              <span className="text-3xl font-extrabold tracking-[-0.05em] text-foreground">{currency(product.price)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-[#fff7f0] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7c6553]">
                  {tag}
                </span>
              ))}
              <span className="rounded-full bg-[#ebfff4] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#188a4d]">
                {product.prepMinutes} min
              </span>
            </div>
          </div>

          {product.options.map((group) => (
            <div key={group.id} className="menu-surface rounded-[28px] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold">{group.name}</p>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{group.required ? "Obrigatorio" : "Opcional"}</p>
                </div>
                {group.maxSelected ? <span className="text-xs font-extrabold text-muted-foreground">ate {group.maxSelected}</span> : null}
              </div>
              <div className="space-y-2">
                {group.values.filter((value) => value.active).map((value) => {
                  const checked = Boolean(selected[optionKey(group.id, value.id)]);
                  return (
                    <label key={value.id} className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-[22px] border px-4 py-3 transition ${checked ? "border-[#ffb26b] bg-[#fff4e7]" : "border-white/70 bg-card hover:bg-[#fff9f4]"}`}>
                      <span className="flex items-center gap-3">
                        <input
                          type={group.optionType === "single" ? "radio" : "checkbox"}
                          checked={checked}
                          name={group.id}
                          onChange={() => toggleOption(group, value.id)}
                        />
                        <span className="text-sm font-bold">{value.name}</span>
                      </span>
                      <span className="text-sm font-extrabold">{value.priceDelta > 0 ? `+ ${currency(value.priceDelta)}` : ""}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {removableIngredients.length > 0 ? (
            <div className="menu-surface rounded-[28px] p-4">
              <div className="mb-3">
                <p className="text-sm font-extrabold">Tirar ingredientes</p>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Nao altera o valor do produto</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {removableIngredients.map((ingredient) => {
                  const checked = removedIngredients.includes(ingredient);
                  return (
                    <label key={ingredient} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[22px] border px-4 py-3 transition ${checked ? "border-[#ffb26b] bg-[#fff4e7]" : "border-white/70 bg-card hover:bg-[#fff9f4]"}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleRemovedIngredient(ingredient)} />
                      <span className="text-sm font-bold">Sem {ingredient}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          <label className="block">
            <span className="hc-label">Observacao</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="hc-textarea mt-2 min-h-24"
              placeholder="Ex: ponto da carne, pouco molho, talher descartavel"
            />
          </label>
        </div>
      </div>
    </Modal>
  );
}

export function PublicMenu({ slug, tableSlug }: PublicMenuProps) {
  const [menu, setMenu] = useState<PublicMenuPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [serviceType, setServiceType] = useState<"dine_in" | "delivery" | "takeaway">(tableSlug ? "dine_in" : "delivery");
  const [customer, setCustomer] = useState<CustomerInfo>(emptyCustomer);
  const [paymentTiming, setPaymentTiming] = useState<PaymentTiming>("cashier");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [receipt, setReceipt] = useState<{ number: string; title: string; brand: string; kind: "order" | "service" } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [customerMode, setCustomerMode] = useState<"signin" | "signup" | "profile">("signin");
  const [customerPassword, setCustomerPassword] = useState("");
  const [customerAuthLoading, setCustomerAuthLoading] = useState(false);
  const [customerAuthMessage, setCustomerAuthMessage] = useState<string | null>(null);
  const [customerAccountEmail, setCustomerAccountEmail] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<CartItem | null>(null);
  const [tableActionLoading, setTableActionLoading] = useState<"call_waiter" | "request_bill" | null>(null);
  const [waiterModalOpen, setWaiterModalOpen] = useState(false);
  const [waiterReason, setWaiterReason] = useState<(typeof waiterReasons)[number]>("Falar com o garcom");
  const [waiterNote, setWaiterNote] = useState("");
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let frame = 0;
    const handleScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => setScrollY(window.scrollY));
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    fetchPublicMenu(slug, tableSlug)
      .then((payload) => {
        if (!active) return;
        setMenu(payload);
        setLoading(false);
        setServiceType(tableSlug ? "dine_in" : payload.store.acceptsDelivery ? "delivery" : "takeaway");
        void getMenuCustomerSession(payload.store.id, {
          ...emptyCustomer,
          city: payload.store.city,
          state: payload.store.state,
        }).then((sessionCustomer) => {
          if (!active || !sessionCustomer) return;
          setCustomer(sessionCustomer.customer);
          setCustomerAccountEmail(sessionCustomer.email);
          setCustomerMode("profile");
        });
        clearStoredCustomerProfile(payload.store.id);
        setCustomer((current) => ({ ...current, city: current.city || payload.store.city, state: current.state || payload.store.state }));
      })
      .catch((nextError) => {
        if (!active) return;
        setMenu(null);
        setLoading(false);
        setLoadError(getPublicErrorMessage(nextError, "Cardapio indisponivel."));
      });
    return () => {
      active = false;
    };
  }, [slug, tableSlug]);

  const visibleItems = useMemo(() => {
    if (!menu) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return menu.items
      .filter((item) => item.active && item.qrVisible)
      .filter((item) => serviceType === "delivery" ? item.availableForDelivery : item.availableForDineIn)
      .filter((item) => activeCategory === "all" || item.categoryId === activeCategory)
      .filter((item) => {
        if (!normalizedQuery) return true;
        return `${item.displayName} ${item.description} ${item.tags.join(" ")}`.toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));
  }, [activeCategory, menu, query, serviceType]);

  const visibleCategories = useMemo(() => {
    if (!menu) return [];
    return menu.categories
      .filter((category) => category.active && category.qrVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [menu]);

  const featuredItems = useMemo(() => visibleItems.filter((item) => item.featured).slice(0, 6), [visibleItems]);
  const quickPicks = featuredItems.length > 0 ? featuredItems : visibleItems.slice(0, 6);
  const currentCategory = activeCategory === "all"
    ? null
    : visibleCategories.find((category) => category.id === activeCategory) || null;

  useRevealOnScroll(`${activeCategory}:${query}:${serviceType}:${visibleItems.map((item) => item.id).join(",")}`);

  const subtotal = cart.reduce((sum, item) => sum + cartItemTotal(item), 0);
  const deliveryFee = menu && serviceType === "delivery" ? menu.store.deliveryFee : 0;
  const total = subtotal + deliveryFee;
  const minimumGap = menu && serviceType === "delivery" ? Math.max(0, menu.store.minimumOrderAmount - subtotal) : 0;
  const canCheckout = cart.length > 0 && (!menu || subtotal >= menu.store.minimumOrderAmount || serviceType !== "delivery");
  const estimatedWaitLabel = serviceType === "delivery"
    ? `${menu?.store.estimatedDeliveryMinutes || 0} min para entrega`
    : `${menu?.store.estimatedDeliveryMinutes || 0} min de espera`;
  const isCustomerSignedIn = Boolean(customerAccountEmail.trim() && customer.loyaltyOptIn);
  const customerDisplayName = customer.name.trim() || customerAccountEmail;
  const serviceLabel = serviceType === "delivery" ? "Delivery" : serviceType === "dine_in" ? "Mesa" : "Retirada";
  const orderHelperText = serviceType === "delivery"
    ? minimumGap > 0
      ? `Faltam ${currency(minimumGap)} para liberar o envio.`
      : `Entrega confirmada em media ${menu?.store.estimatedDeliveryMinutes || 0} min.`
    : serviceType === "dine_in"
      ? "Seu pedido vai direto para a mesa."
      : "Retire no balcao quando estiver pronto.";
  const currentServiceDescription = serviceType === "delivery"
    ? "Envio para o endereco salvo no checkout."
    : serviceType === "dine_in"
      ? "Os itens saem para a mesa assim que forem preparados."
      : "Retirada no balcao com fila e status simplificados.";
  const paymentMethodLabels = {
    pix: "Pix",
    debit: "Debito",
    credit: "Credito",
    voucher: "Voucher",
    card: "Cartao",
    cash: "Dinheiro",
  } as const;
  const whatsappHref = menu?.store.whatsapp.trim()
    ? `https://wa.me/${menu.store.whatsapp.replace(/\D/g, "")}`
    : null;

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const saveCustomerProfile = async () => {
    setLoyaltyError(null);
    if (!menu || !customerAccountEmail.trim()) {
      setCustomerMode("signin");
      setLoyaltyError("Entre com email e senha antes de alterar seus dados.");
      return;
    }

    if (!customer.name.trim() || !customer.phone.trim()) {
      setLoyaltyError("Informe nome e telefone para salvar o cadastro.");
      return;
    }

    setCustomerAuthLoading(true);
    try {
      await upsertMenuCustomerProfile(menu.store.id, customerAccountEmail, {
        ...customer,
        loyaltyOptIn: true,
      });
      const profile = { ...customer, email: customerAccountEmail, loyaltyOptIn: true };
      clearStoredCustomerProfile(menu.store.id);
      setCustomer(profile);
      setCustomerAuthMessage("Cadastro salvo.");
      setLoyaltyOpen(false);
    } catch (nextError) {
      setLoyaltyError(getPublicErrorMessage(nextError, "Nao foi possivel salvar o cadastro."));
    } finally {
      setCustomerAuthLoading(false);
    }
  };

  const submitCustomerAuth = async () => {
    if (!menu || customerAuthLoading) return;
    setLoyaltyError(null);
    setCustomerAuthMessage(null);

    if (!customer.email.trim()) {
      setLoyaltyError("Informe o email para entrar.");
      return;
    }

    if (!customerPassword.trim()) {
      setLoyaltyError("Digite a senha para entrar.");
      return;
    }

    if (customerMode === "signup" && (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim() || !customer.number.trim())) {
      setLoyaltyError("Para criar cadastro, informe nome, telefone, endereco e numero.");
      return;
    }

    setCustomerAuthLoading(true);
    try {
      const result = customerMode === "signup"
        ? await signUpMenuCustomer(menu.store.id, customer.email, customerPassword, {
            ...customer,
            city: customer.city || menu.store.city,
            state: customer.state || menu.store.state,
            loyaltyOptIn: true,
          })
        : await signInMenuCustomer(menu.store.id, customer.email, customerPassword, {
            ...customer,
            city: customer.city || menu.store.city,
            state: customer.state || menu.store.state,
          });

      if (result?.customer) {
        const nextCustomer = {
          ...result.customer,
          email: result.email,
          city: result.customer.city || menu.store.city,
          state: result.customer.state || menu.store.state,
        };
        setCustomer(nextCustomer);
        setCustomerAccountEmail(result.email);
        clearStoredCustomerProfile(menu.store.id);
        setCustomerMode("profile");
        setCustomerPassword("");
      }

      if ((result as { needsEmailConfirmation?: boolean } | null)?.needsEmailConfirmation) {
        setCustomerAuthMessage("Conta criada. Confirme o email para entrar com senha depois.");
      } else {
        setCustomerAuthMessage("Voce entrou no cardapio.");
        setLoyaltyOpen(false);
      }
    } catch (nextError) {
      setLoyaltyError(getPublicErrorMessage(nextError, "Nao foi possivel entrar agora."));
    } finally {
      setCustomerAuthLoading(false);
    }
  };

  const logoutLoyaltyProfile = async () => {
    if (!menu) return;
    await signOutMenuCustomer();
    clearStoredCustomerProfile(menu.store.id);
    setCustomer((current) => ({
      ...emptyCustomer,
      city: current.city || menu.store.city,
      state: current.state || menu.store.state,
      paymentMethod: current.paymentMethod,
    }));
    setCustomerAccountEmail("");
    setCustomerPassword("");
    setCustomerMode("signin");
    setLoyaltyError(null);
  };

  const removeCartItem = (cartId: string) => {
    const item = cart.find((cartItem) => cartItem.cartId === cartId) || null;
    setPendingRemoval(item);
  };

  const confirmRemoveCartItem = () => {
    if (!pendingRemoval) return;
    setCart((current) => current.filter((item) => item.cartId !== pendingRemoval.cartId));
    setPendingRemoval(null);
  };

  const editCartItem = (item: CartItem) => {
    const product = menu?.items.find((menuItem) => menuItem.id === item.itemId) || null;
    if (!product) return;
    setCart((current) => current.filter((cartItem) => cartItem.cartId !== item.cartId));
    setSelectedProduct(product);
  };

  const submitTableAction = async (actionType: "call_waiter" | "request_bill", note?: string) => {
    if (!menu?.table || tableActionLoading) return;
    setError(null);
    setTableActionLoading(actionType);
    const fallbackName = customer.name.trim() || menu.table.name || `Mesa ${menu.table.code}`;
    const result = await createPublicMenuAction({
      slug: menu.store.slug,
      tableSlug: menu.table.qrSlug || tableSlug || "",
      actionType,
      note,
      customer: { ...customer, name: fallbackName },
    });
    setTableActionLoading(null);

    if (!result.success) {
      setError(result.error || "Nao foi possivel avisar a equipe.");
      return;
    }

    setReceipt({
      number: result.receiptNumber || (actionType === "call_waiter" ? "garcom chamado" : "conta solicitada"),
      title: result.receiptTitle || (actionType === "call_waiter" ? "Garcom chamado" : "Fechar conta"),
      brand: result.brandLine || `${menu.store.receiptName} | HappyCashFood`,
      kind: "service",
    });
    if (actionType === "call_waiter") {
      setWaiterModalOpen(false);
      setWaiterReason("Falar com o garcom");
      setWaiterNote("");
    }
  };

  const submitOrder = async () => {
    if (!menu) return;
    setError(null);
    if (!isCustomerSignedIn) {
      setError("Entre com email e senha para enviar o pedido.");
      setCustomerMode("signin");
      setLoyaltyOpen(true);
      return;
    }
    if (serviceType === "delivery" && (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim() || !customer.number.trim())) {
      setError("Preencha nome, telefone e endereco para entrega.");
      return;
    }
    if (serviceType !== "delivery" && !customer.name.trim()) {
      setError("Informe o nome para identificar o pedido.");
      return;
    }

    setSubmitting(true);
    const result = await createPublicOrder({
      slug: menu.store.slug,
      tableSlug: menu.table?.qrSlug || tableSlug || null,
      serviceType,
      paymentTiming,
      actionType: "order",
      customer,
      items: cart,
    });
    setSubmitting(false);

    if (!result.success) {
      setError(result.error || "Nao foi possivel enviar o pedido.");
      return;
    }

    setCheckoutOpen(false);
    setReceipt({
      number: result.receiptNumber || "pedido enviado",
      title: result.receiptTitle || menu.store.receiptName,
      brand: result.brandLine || `Emitido por ${menu.store.receiptName} com HappyCashFood`,
      kind: "order",
    });
    setCart([]);
  };

  if (loading) {
    return (
      <main className="app-shell grid min-h-dvh place-items-center p-4">
        <div className="menu-surface w-full max-w-sm rounded-[34px] p-8 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-[24px] bg-[#fff0df] text-primary shadow-[0_18px_36px_rgba(255,124,32,0.16)]">
            <ChefHat size={30} />
          </div>
          <p className="mt-5 text-sm font-extrabold uppercase tracking-[0.24em] text-[#ff7a00]">HappyCashFood</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-[-0.05em]">Carregando cardapio</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">Preparando o menu, categorias e checkout rapido.</p>
        </div>
      </main>
    );
  }

  if (loadError || !menu) {
    return (
      <main className="app-shell grid min-h-dvh place-items-center p-4">
        <div className="menu-surface w-full max-w-md rounded-[34px] p-8 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-[24px] bg-[#fff0df] text-primary shadow-[0_18px_36px_rgba(255,124,32,0.16)]">
            <ChefHat size={30} />
          </div>
          <h1 className="mt-5 text-3xl font-extrabold tracking-[-0.05em]">Cardapio indisponivel</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-muted-foreground">{loadError || "Nao foi possivel abrir este cardapio."}</p>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.24em] text-[#ff7a00]">HappyCashFood</p>
        </div>
      </main>
    );
  }

  const serviceOptions = [
    menu.store.acceptsDineIn && menu.table ? {
      key: "dine_in" as const,
      label: "Mesa",
      detail: menu.table.name || `Mesa ${menu.table.code}`,
      icon: <Utensils size={18} />,
    } : null,
    menu.store.acceptsDelivery ? {
      key: "delivery" as const,
      label: "Delivery",
      detail: `${menu.store.estimatedDeliveryMinutes} min para entrega`,
      icon: <ShoppingBag size={18} />,
    } : null,
    {
      key: "takeaway" as const,
      label: "Retirada",
      detail: "Buscar no balcao",
      icon: <ChefHat size={18} />,
    },
  ].filter(Boolean) as Array<{
    key: "dine_in" | "delivery" | "takeaway";
    label: string;
    detail: string;
    icon: ReactNode;
  }>;

  return (
    <main className="app-shell pb-[11rem] sm:pb-36" id="menu-top">
      <section className="relative overflow-hidden px-4 pt-4 sm:px-6 lg:px-8">
        <div className="absolute left-4 top-8 h-24 w-24 rounded-full bg-[#ffb15d]/18 blur-3xl" />
        <div className="absolute right-6 top-32 h-20 w-20 rounded-full bg-[#ffd999]/22 blur-3xl" />

        <div className="container relative">
          <div className="menu-surface overflow-hidden rounded-[36px]">
            <div className="relative min-h-[340px] sm:min-h-[400px]">
              <FoodImage
                src={menu.store.coverUrl}
                alt={menu.store.displayName}
                className="absolute inset-0 h-[118%] w-full"
                style={{ transform: `translate3d(0, ${Math.min(scrollY * 0.16, 84)}px, 0) scale(1.04)` }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,11,8,0.22),rgba(14,11,8,0.84)),radial-gradient(circle_at_top_left,rgba(255,179,100,0.26),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.14),transparent_38%)]" />

              <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
                <div className="rounded-[22px] bg-white/14 px-3 py-2 text-white backdrop-blur-md">
                  <BrandMark name={menu.store.displayName} logoUrl={menu.store.logoUrl} compact />
                </div>
                <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className="menu-chip max-w-[14rem] bg-white/16 text-white backdrop-blur-md"
                    onClick={() => setLoyaltyOpen(true)}
                  >
                    <ShieldCheck size={15} />
                    <span className="truncate">{isCustomerSignedIn ? customerDisplayName : "Entrar"}</span>
                  </button>
                  <span className={`menu-chip ${menu.store.isOpen ? "bg-[#ebfff4] text-[#177f48]" : "bg-white text-[#2f2419]"}`}>
                    {menu.store.isOpen ? "Aberto" : "Fechado"}
                  </span>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.32em] text-white/72">HappyCashFood menu</p>
                  <h1 className="mt-2 text-[2.3rem] font-extrabold leading-none tracking-[-0.07em] text-white sm:text-[4rem]">
                    {menu.store.displayName}
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/78 sm:text-base">
                    {menu.store.description}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="menu-chip bg-white/14 text-white backdrop-blur">
                    <Clock size={15} /> {estimatedWaitLabel}
                  </span>
                  <span className="menu-chip bg-white/14 text-white backdrop-blur">
                    <MapPin size={15} /> {menu.store.addressLine || `${menu.store.city} - ${menu.store.state}`}
                  </span>
                  {serviceType === "delivery" ? (
                    <span className="menu-chip bg-white/14 text-white backdrop-blur">
                      <CreditCard size={15} /> Taxa {currency(menu.store.deliveryFee)}
                    </span>
                  ) : null}
                  {menu.table ? (
                    <span className="menu-chip bg-white text-[#23160d]">
                      <Utensils size={15} /> {menu.table.name || `Mesa ${menu.table.code}`}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-t border-[#f3e6d7] bg-white/92 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="hc-label">Fluxo do pedido</p>
                    <p className="mt-2 text-2xl font-extrabold tracking-[-0.05em] text-foreground">Peça do seu jeito</p>
                  </div>
                  <span className="menu-chip bg-[#fff4e7] text-[#ff7a00]">{serviceLabel}</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {serviceOptions.map((option) => {
                    const activeOption = serviceType === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`rounded-[28px] border p-4 text-left transition duration-200 ${activeOption ? "border-[#ffb26b] bg-[#fff4e7] shadow-[0_18px_40px_rgba(255,124,32,0.14)]" : "border-white/70 bg-[#fffaf5] hover:-translate-y-0.5 hover:bg-white"}`}
                        onClick={() => setServiceType(option.key)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={`${activeOption ? "text-[#ff7a00]" : "text-foreground"}`}>{option.icon}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] ${activeOption ? "bg-white text-[#ff7a00]" : "bg-[#fff0df] text-[#7c6553]"}`}>
                            {activeOption ? "Ativo" : "Trocar"}
                          </span>
                        </div>
                        <p className="mt-4 text-lg font-extrabold tracking-[-0.04em] text-foreground">{option.label}</p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">{option.detail}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {menu.table ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <button
                    type="button"
                    className="menu-glass rounded-[28px] p-4 text-left transition duration-200 hover:-translate-y-0.5"
                    onClick={() => {
                      setError(null);
                      setWaiterModalOpen(true);
                    }}
                    disabled={Boolean(tableActionLoading)}
                  >
                    <span className="menu-chip bg-white text-[#ff7a00]">
                      <MessageSquareText size={15} /> Atendimento
                    </span>
                    <p className="mt-4 text-lg font-extrabold tracking-[-0.04em] text-foreground">
                      {tableActionLoading === "call_waiter" ? "Chamando..." : "Chamar garcom"}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">Avise a equipe sem criar pedido na cozinha.</p>
                  </button>

                  <button
                    type="button"
                    className="menu-glass rounded-[28px] p-4 text-left transition duration-200 hover:-translate-y-0.5"
                    onClick={() => void submitTableAction("request_bill")}
                    disabled={Boolean(tableActionLoading)}
                  >
                    <span className="menu-chip bg-white text-[#ff7a00]">
                      <ReceiptText size={15} /> Conta
                    </span>
                    <p className="mt-4 text-lg font-extrabold tracking-[-0.04em] text-foreground">
                      {tableActionLoading === "request_bill" ? "Solicitando..." : "Fechar conta"}
                    </p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">Peça o fechamento quando terminar a refeicao.</p>
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="menu-glass rounded-[28px] p-4">
                    <span className="menu-chip bg-white text-[#ff7a00]">
                      <ShoppingBag size={15} /> Pedido minimo
                    </span>
                    <p className="mt-4 text-3xl font-extrabold tracking-[-0.06em] text-foreground">{currency(menu.store.minimumOrderAmount)}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">Valor minimo para liberar delivery no checkout.</p>
                  </div>

                  {whatsappHref ? (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      className="menu-glass rounded-[28px] p-4 transition duration-200 hover:-translate-y-0.5"
                    >
                      <span className="menu-chip bg-white text-[#ff7a00]">
                        <MessageSquareText size={15} /> Suporte
                      </span>
                      <p className="mt-4 text-lg font-extrabold tracking-[-0.04em] text-foreground">Falar no WhatsApp</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">{menu.store.phone || menu.store.whatsapp}</p>
                    </a>
                  ) : (
                    <div className="menu-glass rounded-[28px] p-4">
                      <span className="menu-chip bg-white text-[#ff7a00]">
                        <CreditCard size={15} /> Pagamento
                      </span>
                      <p className="mt-4 text-lg font-extrabold tracking-[-0.04em] text-foreground">Pix, cartao e dinheiro</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">Escolha como pagar no final do pedido.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-3 z-30 px-4 pt-4 sm:px-6 lg:px-8" id="menu-filters">
        <div className="container">
          <div className="menu-glass rounded-[30px] p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-extrabold tracking-[-0.04em] text-foreground">
                  {currentCategory ? currentCategory.name : "Encontre seu proximo pedido"}
                </p>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  {visibleItems.length} item(ns) ativos em {serviceLabel.toLowerCase()}.
                </p>
              </div>
              {(query || activeCategory !== "all") ? (
                <button
                  type="button"
                  className="menu-chip bg-[#fff4e7] text-[#ff7a00]"
                  onClick={() => {
                    setQuery("");
                    setActiveCategory("all");
                  }}
                >
                  Limpar filtros
                </button>
              ) : (
                <span className="menu-chip bg-white text-[#7c6553]">{orderHelperText}</span>
              )}
            </div>

            <label className="relative mt-4 block">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="hc-input pl-11"
                placeholder={serviceType === "delivery" ? "Buscar pratos, combos e sobremesas" : "Buscar itens do cardapio"}
              />
            </label>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                className={activeCategory === "all" ? "hc-button-primary whitespace-nowrap" : "hc-button-soft whitespace-nowrap"}
                onClick={() => setActiveCategory("all")}
              >
                Todos
              </button>
              {visibleCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={activeCategory === category.id ? "hc-button-accent whitespace-nowrap" : "hc-button-soft whitespace-nowrap"}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {quickPicks.length > 0 ? (
        <section className="container py-6" id="menu-highlights">
          <SectionHeading
            eyebrow="Destaques"
            title="Escolhas em foco"
            description="Uma faixa mais visual para os itens com mais apelo, no mesmo clima de app food mobile."
            action={(
              <button type="button" className="menu-chip bg-white text-[#ff7a00]" onClick={() => scrollToSection("menu-list")}>
                Ver menu
              </button>
            )}
          />

          <div className="mt-5 flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
            {quickPicks.map((item, index) => (
              <FeaturedMenuCard
                key={item.id}
                item={item}
                index={index}
                onSelect={() => setSelectedProduct(item)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="container pb-10" id="menu-list">
        <SectionHeading
          eyebrow={currentCategory ? "Categoria ativa" : "Cardapio"}
          title={currentCategory ? currentCategory.name : "Explore o menu"}
          description={currentCategory?.description || currentServiceDescription}
        />

        {visibleItems.length === 0 ? (
          <div className="menu-surface mt-5 rounded-[32px] p-8 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-[24px] bg-[#fff0df] text-primary shadow-[0_18px_36px_rgba(255,124,32,0.16)]">
              <Search size={28} />
            </div>
            <h3 className="mt-5 text-2xl font-extrabold tracking-[-0.05em]">Nenhum item encontrado</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">
              Ajuste a busca ou troque a categoria para ver mais opcoes desse cardapio.
            </p>
            <button
              type="button"
              className="hc-button-primary mt-5"
              onClick={() => {
                setQuery("");
                setActiveCategory("all");
              }}
            >
              Limpar busca
            </button>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {visibleItems.map((item, index) => (
              <MenuProductCard
                key={item.id}
                item={item}
                index={index}
                onSelect={() => setSelectedProduct(item)}
              />
            ))}
          </div>
        )}
      </section>

      {cart.length > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[5.9rem] z-40 px-4 sm:bottom-6 sm:px-6">
          <div className="container">
            <div className="pointer-events-auto ml-auto flex w-full max-w-xl items-center gap-3 rounded-[30px] bg-[#17120d] p-3 text-white shadow-[0_30px_70px_rgba(23,18,13,0.34)]">
              <div className="grid size-12 shrink-0 place-items-center rounded-[18px] bg-primary text-white shadow-[0_18px_36px_rgba(255,124,32,0.28)]">
                <ShoppingBag size={20} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{cart.length} item(ns) no pedido</p>
                <p className="truncate text-xs font-semibold text-white/68">
                  {serviceType === "delivery" && minimumGap > 0 ? `Faltam ${currency(minimumGap)} para o minimo.` : orderHelperText}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xl font-extrabold tracking-[-0.04em]">{currency(total)}</p>
                <button
                  type="button"
                  className="mt-2 inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-extrabold text-[#17120d] transition hover:bg-[#fff3e7]"
                  disabled={!canCheckout}
                  onClick={() => setCheckoutOpen(true)}
                >
                  Ver pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-3 sm:hidden safe-bottom">
        <div className="menu-mobile-nav mx-auto flex max-w-md items-center justify-between rounded-[28px] px-3 py-2">
          <button
            type="button"
            className="flex min-w-[72px] flex-col items-center gap-1 rounded-[20px] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7c6553]"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <ChefHat size={18} />
            Menu
          </button>
          <button
            type="button"
            className="flex min-w-[72px] flex-col items-center gap-1 rounded-[20px] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7c6553]"
            onClick={() => scrollToSection("menu-filters")}
          >
            <Search size={18} />
            Buscar
          </button>
          <button
            type="button"
            className={`flex min-w-[72px] flex-col items-center gap-1 rounded-[20px] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] ${cart.length > 0 ? "bg-[#fff1e3] text-[#ff7a00]" : "text-[#7c6553]"}`}
            onClick={() => {
              if (cart.length > 0) {
                setCheckoutOpen(true);
                return;
              }
              scrollToSection("menu-list");
            }}
          >
            <ShoppingBag size={18} />
            Pedido
          </button>
          <button
            type="button"
            className={`flex min-w-[72px] flex-col items-center gap-1 rounded-[20px] px-3 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] ${isCustomerSignedIn ? "bg-[#ebfff4] text-[#177f48]" : "text-[#7c6553]"}`}
            onClick={() => setLoyaltyOpen(true)}
          >
            <ShieldCheck size={18} />
            Conta
          </button>
        </div>
      </div>

      <ProductModal
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onAdd={(item) => setCart((current) => [...current, item])}
      />

      <Modal
        title="Finalizar pedido"
        subtitle={`${menu.store.receiptName} | HappyCashFood`}
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        size="lg"
        disableEscape={loyaltyOpen || Boolean(pendingRemoval)}
        footer={(
          <div className="space-y-3">
            {error ? <p className="rounded-[22px] bg-[#fff1ef] p-3 text-sm font-bold text-red-700">{error}</p> : null}
            <button className="hc-button-primary w-full" disabled={submitting || !canCheckout} onClick={submitOrder}>
              <CreditCard size={18} />
              {submitting ? "Enviando..." : paymentTiming === "now" ? `Pagar agora ${currency(total)}` : `Enviar pedido ${currency(total)}`}
            </button>
          </div>
        )}
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="menu-surface rounded-[30px] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="hc-label">Conta</p>
                  <p className="mt-2 text-xl font-extrabold tracking-[-0.04em] text-foreground">
                    {isCustomerSignedIn ? customerDisplayName : "Entre para enviar o pedido"}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">{currentServiceDescription}</p>
                </div>
                <button type="button" className="hc-button-soft" onClick={() => setLoyaltyOpen(true)}>
                  <ShieldCheck size={17} />
                  {isCustomerSignedIn ? "Editar dados" : "Entrar"}
                </button>
              </div>
            </div>

            <div className="menu-surface rounded-[30px] p-4">
              <p className="hc-label">Momento do pagamento</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {([
                  ["cashier", "Pagar no caixa/balcao", "Fluxo mais simples para fechar o pedido."],
                  ["now", "Pagar agora", "Use Pix ou cartao assim que confirmar."],
                ] as Array<[PaymentTiming, string, string]>).map(([mode, label, description]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`rounded-[26px] border p-4 text-left transition duration-200 ${paymentTiming === mode ? "border-[#ffb26b] bg-[#fff4e7] shadow-[0_18px_40px_rgba(255,124,32,0.14)]" : "border-white/70 bg-card hover:-translate-y-0.5 hover:bg-[#fff9f4]"}`}
                    onClick={() => setPaymentTiming(mode)}
                  >
                    <p className="text-base font-extrabold tracking-[-0.03em] text-foreground">{label}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-muted-foreground">{description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="menu-surface rounded-[30px] p-4">
              <p className="hc-label">Seus dados</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="hc-label">Email</span>
                  <input value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} className="hc-input mt-2" type="email" autoComplete="email" />
                </label>
                <label>
                  <span className="hc-label">Nome</span>
                  <input value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} className="hc-input mt-2" autoComplete="name" />
                </label>
                <label className="sm:col-span-2">
                  <span className="hc-label">Telefone</span>
                  <input value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} className="hc-input mt-2" inputMode="tel" autoComplete="tel" />
                </label>
              </div>
            </div>

            {serviceType === "delivery" ? (
              <div className="menu-surface rounded-[30px] p-4">
                <p className="hc-label">Endereco de entrega</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_120px]">
                  <label>
                    <span className="hc-label">Endereco</span>
                    <input value={customer.address} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} className="hc-input mt-2" autoComplete="street-address" />
                  </label>
                  <label>
                    <span className="hc-label">Numero</span>
                    <input value={customer.number} onChange={(event) => setCustomer((current) => ({ ...current, number: event.target.value }))} className="hc-input mt-2" />
                  </label>
                  <label>
                    <span className="hc-label">Bairro</span>
                    <input value={customer.neighborhood} onChange={(event) => setCustomer((current) => ({ ...current, neighborhood: event.target.value }))} className="hc-input mt-2" />
                  </label>
                  <label>
                    <span className="hc-label">Complemento</span>
                    <input value={customer.complement} onChange={(event) => setCustomer((current) => ({ ...current, complement: event.target.value }))} className="hc-input mt-2" />
                  </label>
                </div>
              </div>
            ) : null}

            <div className="menu-surface rounded-[30px] p-4">
              <p className="hc-label">Forma de pagamento</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(Object.keys(paymentMethodLabels) as Array<keyof typeof paymentMethodLabels>).map((method) => (
                  <button
                    type="button"
                    key={method}
                    className={customer.paymentMethod === method ? "hc-button-primary" : "hc-button-soft"}
                    onClick={() => setCustomer((current) => ({ ...current, paymentMethod: method }))}
                  >
                    {paymentMethodLabels[method]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="menu-surface rounded-[30px] p-4">
            <div className="rounded-[28px] bg-[#17120d] p-5 text-white">
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-white/62">Resumo do pedido</p>
              <p className="mt-3 text-4xl font-extrabold tracking-[-0.06em]">{currency(total)}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-white/68">
                {serviceType === "delivery" ? `Inclui taxa de entrega de ${currency(deliveryFee)}.` : estimatedWaitLabel}
              </p>
            </div>

            <p className="mt-5 text-sm font-extrabold uppercase tracking-[0.2em] text-muted-foreground">Itens</p>
            <div className="mt-3 max-h-80 space-y-3 overflow-auto pr-1 scrollbar-thin">
              {cart.map((item) => (
                <div key={item.cartId} className="rounded-[24px] bg-[#fff8f2] p-3">
                  <div className="flex gap-3">
                    <FoodImage src={item.imageUrl} alt={item.name} className="size-16 rounded-[20px]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold">{item.quantity}x {item.name}</p>
                          {item.options.map((option) => (
                            <p key={`${item.cartId}-${option.valueId}`} className="text-xs font-bold text-muted-foreground">{option.valueName}</p>
                          ))}
                          {(item.removedIngredients || []).length > 0 ? <p className="text-xs font-extrabold text-[#ff7a00]">Sem: {item.removedIngredients.join(", ")}</p> : null}
                          {item.notes ? <p className="text-xs font-bold text-muted-foreground">Obs: {item.notes}</p> : null}
                        </div>
                        <p className="shrink-0 text-sm font-extrabold">{currency(cartItemTotal(item))}</p>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <button type="button" className="text-xs font-extrabold text-[#ff7a00]" onClick={() => editCartItem(item)}>
                          Editar
                        </button>
                        <button type="button" className="inline-flex items-center gap-1 text-xs font-extrabold text-red-600" onClick={() => removeCartItem(item.cartId)}>
                          <Trash2 size={14} />
                          Tirar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2 border-t border-border/70 pt-4 text-sm font-bold">
              <div className="flex justify-between"><span>Subtotal</span><span>{currency(subtotal)}</span></div>
              {serviceType === "delivery" ? <div className="flex justify-between"><span>Entrega</span><span>{currency(deliveryFee)}</span></div> : null}
              <div className="flex justify-between text-base font-extrabold"><span>Total</span><span>{currency(total)}</span></div>
            </div>
          </aside>
        </div>
      </Modal>

      <Modal
        title="Chamar garcom"
        subtitle={menu.table ? `${menu.table.name || `Mesa ${menu.table.code}`} | HappyCashFood` : "HappyCashFood"}
        open={waiterModalOpen}
        onClose={() => {
          if (tableActionLoading !== "call_waiter") setWaiterModalOpen(false);
        }}
        size="sm"
        disableEscape={tableActionLoading === "call_waiter"}
        footer={(
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className="hc-button-soft"
              disabled={tableActionLoading === "call_waiter"}
              onClick={() => setWaiterModalOpen(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="hc-button-primary"
              disabled={tableActionLoading === "call_waiter"}
              onClick={() => {
                const note = [waiterReason, waiterNote.trim()].filter(Boolean).join(" - ");
                void submitTableAction("call_waiter", note);
              }}
            >
              <MessageSquareText size={18} />
              {tableActionLoading === "call_waiter" ? "Chamando..." : "Chamar garcom"}
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-[24px] bg-[#fff8f2] p-4">
            <p className="text-sm font-semibold leading-6 text-muted-foreground">
              Confirme para avisar a equipe da mesa. Essa acao nao cria pedido na cozinha.
            </p>
          </div>
          <div className="grid gap-2">
            {waiterReasons.map((reason) => (
              <button
                key={reason}
                type="button"
                className={waiterReason === reason ? "hc-button-primary justify-start" : "hc-button-soft justify-start"}
                onClick={() => setWaiterReason(reason)}
              >
                {reason}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="hc-label">Observacao para o atendente</span>
            <textarea
              value={waiterNote}
              onChange={(event) => setWaiterNote(event.target.value)}
              className="hc-textarea mt-2 min-h-24"
              maxLength={180}
              placeholder="Ex: estou na area externa, preciso falar sobre a conta"
            />
          </label>
          {error ? <p className="rounded-[22px] bg-[#fff1ef] p-3 text-sm font-bold text-red-700">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        title="Entrar no cardapio"
        subtitle="Cliente usa email e senha para salvar dados e pedidos."
        open={loyaltyOpen}
        onClose={() => setLoyaltyOpen(false)}
        size="sm"
      >
        <div className="space-y-4">
          <div className={`grid rounded-[24px] bg-[#fff7f0] p-1 ${isCustomerSignedIn ? "grid-cols-3" : "grid-cols-2"}`}>
            {([
              ["signin", "Entrar"],
              ["signup", "Criar"],
              ...(isCustomerSignedIn ? [["profile", "Dados"] as const] : []),
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`min-h-11 rounded-[18px] text-sm font-extrabold transition ${customerMode === mode ? "bg-card text-[#ff7a00] shadow-[0_12px_24px_rgba(56,35,16,0.08)]" : "text-muted-foreground"}`}
                onClick={() => {
                  setCustomerMode(mode);
                  setLoyaltyError(null);
                  setCustomerAuthMessage(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {customerMode !== "profile" ? (
            <form
              id="menu-customer-auth-form"
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitCustomerAuth();
              }}
            >
              <label className="block">
                <span className="hc-label">Email</span>
                <input
                  value={customer.email}
                  onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))}
                  className="hc-input mt-2"
                  type="email"
                  autoComplete="email"
                />
              </label>
              <label className="block">
                <span className="hc-label">Senha</span>
                <input
                  value={customerPassword}
                  onChange={(event) => setCustomerPassword(event.target.value)}
                  className="hc-input mt-2"
                  type="password"
                  autoComplete={customerMode === "signin" ? "current-password" : "new-password"}
                />
              </label>
            </form>
          ) : null}

          {customerMode !== "signin" ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="hc-label">Nome</span>
                  <input value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} className="hc-input mt-2" autoComplete="name" />
                </label>
                <label>
                  <span className="hc-label">Telefone</span>
                  <input value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} className="hc-input mt-2" inputMode="tel" autoComplete="tel" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
                <label>
                  <span className="hc-label">Endereco</span>
                  <input value={customer.address} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} className="hc-input mt-2" autoComplete="street-address" />
                </label>
                <label>
                  <span className="hc-label">Numero</span>
                  <input value={customer.number} onChange={(event) => setCustomer((current) => ({ ...current, number: event.target.value }))} className="hc-input mt-2" />
                </label>
                <label>
                  <span className="hc-label">Bairro</span>
                  <input value={customer.neighborhood} onChange={(event) => setCustomer((current) => ({ ...current, neighborhood: event.target.value }))} className="hc-input mt-2" />
                </label>
                <label>
                  <span className="hc-label">Complemento</span>
                  <input value={customer.complement} onChange={(event) => setCustomer((current) => ({ ...current, complement: event.target.value }))} className="hc-input mt-2" />
                </label>
              </div>
            </div>
          ) : null}

          {customerAuthMessage ? <p className="rounded-[22px] bg-[#fff8f2] p-3 text-sm font-bold text-muted-foreground">{customerAuthMessage}</p> : null}
          {loyaltyError ? <p className="rounded-[22px] bg-[#fff1ef] p-3 text-sm font-bold text-red-700">{loyaltyError}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            {customerMode === "signin" ? (
              <button type="submit" form="menu-customer-auth-form" className="hc-button-primary flex-1" disabled={customerAuthLoading}>
                <LogIn size={18} /> {customerAuthLoading ? "Entrando..." : "Entrar"}
              </button>
            ) : null}
            {customerMode === "signup" ? (
              <button type="submit" form="menu-customer-auth-form" className="hc-button-primary flex-1" disabled={customerAuthLoading}>
                <UserPlus size={18} /> {customerAuthLoading ? "Criando..." : "Criar conta"}
              </button>
            ) : null}
            {customerMode === "profile" ? (
              <button type="button" className="hc-button-primary flex-1" onClick={saveCustomerProfile} disabled={customerAuthLoading}>
                <ShieldCheck size={18} /> {customerAuthLoading ? "Salvando..." : "Salvar dados"}
              </button>
            ) : null}
            {isCustomerSignedIn ? (
              <button type="button" className="hc-button-soft" onClick={() => void logoutLoyaltyProfile()}>
                <Minus size={18} /> Sair
              </button>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        title="Tirar item"
        subtitle="Confirmacao do carrinho"
        open={Boolean(pendingRemoval)}
        onClose={() => setPendingRemoval(null)}
        size="sm"
      >
        {pendingRemoval ? (
          <div className="space-y-4">
            <p className="rounded-[22px] bg-[#fff8f2] p-4 text-sm font-bold text-muted-foreground">
              Quer realmente tirar {pendingRemoval.quantity}x {pendingRemoval.name} do carrinho?
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className="hc-button-soft" onClick={() => setPendingRemoval(null)}>Cancelar</button>
              <button type="button" className="hc-button-primary" onClick={confirmRemoveCartItem}>
                <Trash2 size={18} /> Tirar item
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title="Pedido enviado" open={Boolean(receipt)} onClose={() => setReceipt(null)} size="sm">
        {receipt ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-[24px] bg-[#ebfff4] text-accent">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <p className="text-2xl font-extrabold tracking-[-0.05em]">{receipt.title}</p>
              <p className="mt-1 text-sm font-bold text-muted-foreground">{receipt.brand}</p>
            </div>
            <div className="rounded-[24px] bg-[#fff8f2] p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-muted-foreground">Comprovante</p>
              <p className="mt-2 text-xl font-extrabold tracking-[-0.04em]">{receipt.number}</p>
            </div>
            <p className="inline-flex items-center justify-center gap-2 text-sm font-bold text-muted-foreground">
              <MessageSquareText size={16} /> {receipt.kind === "service" ? "A equipe foi avisada." : "A loja recebeu seu pedido."}
            </p>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}

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
  ShieldCheck,
  Search,
  ShoppingBag,
  Trash2,
  Utensils,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
            className="hc-button-primary flex-1 sm:flex-none"
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
        <FoodImage src={product.imageUrl} alt={product.imageAlt} className="aspect-[4/3] w-full rounded-lg" />
        <div className="space-y-4">
          {product.promotion ? (
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
              <p className="text-sm font-black text-primary">{product.promotion.badgeLabel} - {product.promotion.title}</p>
              {product.promotion.description ? <p className="mt-1 text-xs font-bold text-muted-foreground">{product.promotion.description}</p> : null}
            </div>
          ) : null}
          <p className="text-sm font-semibold leading-6 text-muted-foreground">{product.description}</p>
          <div className="flex items-end gap-2">
            {product.compareAtPrice ? <span className="text-sm font-black text-muted-foreground line-through">{currency(product.compareAtPrice)}</span> : null}
            <span className="text-2xl font-black text-primary">{currency(product.price)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground">
                {tag}
              </span>
            ))}
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{product.prepMinutes} min</span>
          </div>

          {product.options.map((group) => (
            <div key={group.id} className="rounded-lg border bg-background p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black">{group.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">{group.required ? "Obrigatorio" : "Opcional"}</p>
                </div>
                {group.maxSelected ? <span className="text-xs font-black text-muted-foreground">ate {group.maxSelected}</span> : null}
              </div>
              <div className="space-y-2">
                {group.values.filter((value) => value.active).map((value) => {
                  const checked = Boolean(selected[optionKey(group.id, value.id)]);
                  return (
                    <label key={value.id} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
                      <span className="flex items-center gap-3">
                        <input
                          type={group.optionType === "single" ? "radio" : "checkbox"}
                          checked={checked}
                          name={group.id}
                          onChange={() => toggleOption(group, value.id)}
                        />
                        <span className="text-sm font-bold">{value.name}</span>
                      </span>
                      <span className="text-sm font-black">{value.priceDelta > 0 ? `+ ${currency(value.priceDelta)}` : ""}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {removableIngredients.length > 0 ? (
            <div className="rounded-lg border bg-background p-3">
              <div className="mb-3">
                <p className="text-sm font-black">Tirar ingredientes</p>
                <p className="text-xs font-bold text-muted-foreground">Nao altera o valor do produto.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {removableIngredients.map((ingredient) => {
                  const checked = removedIngredients.includes(ingredient);
                  return (
                    <label key={ingredient} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3 py-2">
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
        const savedProfile = window.localStorage.getItem(customerStorageKey(payload.store.id));
        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile) as Partial<CustomerInfo>;
            setCustomer((current) => ({
              ...current,
              ...parsed,
              email: parsed.email || current.email,
              city: parsed.city || current.city || payload.store.city,
              state: parsed.state || current.state || payload.store.state,
              loyaltyOptIn: true,
            }));
          } catch {
            setCustomer((current) => ({ ...current, city: current.city || payload.store.city, state: current.state || payload.store.state }));
          }
        } else {
          setCustomer((current) => ({ ...current, city: current.city || payload.store.city, state: current.state || payload.store.state }));
        }
      })
      .catch((error) => {
        if (!active) return;
        setMenu(null);
        setLoading(false);
        setLoadError(getPublicErrorMessage(error, "Cardapio indisponivel."));
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
  useRevealOnScroll(`${activeCategory}:${query}:${serviceType}:${visibleItems.map((item) => item.id).join(",")}`);

  const subtotal = cart.reduce((sum, item) => sum + cartItemTotal(item), 0);
  const deliveryFee = menu && serviceType === "delivery" ? menu.store.deliveryFee : 0;
  const total = subtotal + deliveryFee;
  const canCheckout = cart.length > 0 && (!menu || subtotal >= menu.store.minimumOrderAmount || serviceType !== "delivery");
  const estimatedWaitLabel = serviceType === "delivery"
    ? `${menu?.store.estimatedDeliveryMinutes || 0} min para entrega`
    : `${menu?.store.estimatedDeliveryMinutes || 0} min de espera`;
  const isCustomerSignedIn = Boolean(customerAccountEmail.trim() && customer.loyaltyOptIn);
  const customerDisplayName = customer.name.trim() || customerAccountEmail;

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
      window.localStorage.setItem(customerStorageKey(menu.store.id), JSON.stringify(profile));
      setCustomer(profile);
      setCustomerAuthMessage("Cadastro salvo.");
      setLoyaltyOpen(false);
    } catch (error) {
      setLoyaltyError(getPublicErrorMessage(error, "Nao foi possivel salvar o cadastro."));
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
        window.localStorage.setItem(customerStorageKey(menu.store.id), JSON.stringify(nextCustomer));
        setCustomerMode("profile");
        setCustomerPassword("");
      }

      if ((result as { needsEmailConfirmation?: boolean } | null)?.needsEmailConfirmation) {
        setCustomerAuthMessage("Conta criada. Confirme o email para entrar com senha depois.");
      } else {
        setCustomerAuthMessage("Voce entrou no cardapio.");
        setLoyaltyOpen(false);
      }
    } catch (error) {
      setLoyaltyError(getPublicErrorMessage(error, "Nao foi possivel entrar agora."));
    } finally {
      setCustomerAuthLoading(false);
    }
  };

  const logoutLoyaltyProfile = async () => {
    if (!menu) return;
    await signOutMenuCustomer();
    window.localStorage.removeItem(customerStorageKey(menu.store.id));
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
        <div className="rounded-lg border bg-card p-6 text-center shadow-panel">
          <ChefHat className="mx-auto text-primary" size={34} />
          <p className="mt-3 text-sm font-black">Carregando cardapio</p>
        </div>
      </main>
    );
  }

  if (loadError || !menu) {
    return (
      <main className="app-shell grid min-h-dvh place-items-center p-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-panel">
          <ChefHat className="mx-auto text-primary" size={34} />
          <h1 className="mt-3 text-xl font-black">Cardapio indisponivel</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">{loadError || "Nao foi possivel abrir este cardapio."}</p>
          <p className="mt-4 text-xs font-black text-muted-foreground">HappyCashFood</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell pb-28">
      <header className="relative overflow-hidden bg-zinc-950 text-white">
        <FoodImage
          src={menu.store.coverUrl}
          alt={menu.store.displayName}
          className="absolute inset-x-0 top-0 h-[125%] w-full opacity-50 will-change-transform"
          style={{ transform: `translate3d(0, ${Math.min(scrollY * 0.18, 90)}px, 0) scale(1.04)` }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,12,0.18),rgba(6,8,12,0.86)),radial-gradient(circle_at_top_left,rgba(250,204,21,0.24),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.16),transparent_42%)]" />
        <div className="container relative z-10 flex min-h-[310px] flex-col justify-end gap-5 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <BrandMark name={menu.store.displayName} logoUrl={menu.store.logoUrl} />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button className="rounded-full bg-white/12 px-3 py-2 text-xs font-black text-white backdrop-blur" onClick={() => setLoyaltyOpen(true)}>
                <ShieldCheck className="mr-1 inline" size={14} />
                {isCustomerSignedIn ? customerDisplayName : "Entrar"}
              </button>
            <span className={`rounded-full px-3 py-2 text-xs font-black ${menu.store.isOpen ? "bg-success text-success-foreground" : "bg-slate-200 text-slate-900"}`}>
                {menu.store.isOpen ? "Aberto" : "Fechado"}
              </span>
            </div>
          </div>
          <div className="max-w-3xl">
            <h1 className="text-3xl font-black leading-tight sm:text-5xl">{menu.store.displayName}</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-200 sm:text-base">{menu.store.description}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-black text-slate-100">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-2 backdrop-blur">
              <Clock size={15} /> {estimatedWaitLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-2 backdrop-blur">
              <MapPin size={15} /> {menu.store.addressLine || `${menu.store.city} - ${menu.store.state}`}
            </span>
            {menu.table ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-2 text-primary-foreground">
                <Utensils size={15} /> {menu.table.name || `Mesa ${menu.table.code}`}
              </span>
            ) : null}
          </div>
          {menu.table ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setWaiterModalOpen(true);
                  }}
                  disabled={Boolean(tableActionLoading)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-black text-zinc-950 shadow-sm transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-70"
                >
                  <MessageSquareText size={17} />
                  {tableActionLoading === "call_waiter" ? "Chamando..." : "Chamar garcom"}
                </button>
                <button
                  type="button"
                  onClick={() => void submitTableAction("request_bill")}
                  disabled={Boolean(tableActionLoading)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/25 bg-white/12 px-4 py-2 text-sm font-black text-white backdrop-blur transition hover:border-primary disabled:cursor-wait disabled:opacity-70"
                >
                  <ReceiptText size={17} />
                  {tableActionLoading === "request_bill" ? "Chamando..." : "Fechar conta"}
                </button>
              </div>
              {error && !checkoutOpen ? <p className="rounded-lg bg-red-500/20 px-3 py-2 text-sm font-black text-red-100">{error}</p> : null}
            </div>
          ) : null}
        </div>
      </header>

      <section className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="container py-3">
          <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {menu.store.acceptsDineIn && menu.table ? (
                <button className={serviceType === "dine_in" ? "hc-button-primary whitespace-nowrap" : "hc-button-soft whitespace-nowrap"} onClick={() => setServiceType("dine_in")}>
                  <Utensils size={17} /> Mesa
                </button>
              ) : null}
              {menu.store.acceptsDelivery ? (
                <button className={serviceType === "delivery" ? "hc-button-primary whitespace-nowrap" : "hc-button-soft whitespace-nowrap"} onClick={() => setServiceType("delivery")}>
                  <ShoppingBag size={17} /> Delivery
                </button>
              ) : null}
              <button className={serviceType === "takeaway" ? "hc-button-primary whitespace-nowrap" : "hc-button-soft whitespace-nowrap"} onClick={() => setServiceType("takeaway")}>
                <ChefHat size={17} /> No local
              </button>
            </div>
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="hc-input pl-10" placeholder="Buscar produto" />
            </label>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button className={activeCategory === "all" ? "hc-button-accent whitespace-nowrap" : "hc-button-soft whitespace-nowrap"} onClick={() => setActiveCategory("all")}>
              Todos
            </button>
            {menu.categories.filter((category) => category.active && category.qrVisible).map((category) => (
              <button key={category.id} className={activeCategory === category.id ? "hc-button-accent whitespace-nowrap" : "hc-button-soft whitespace-nowrap"} onClick={() => setActiveCategory(category.id)}>
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-5">
        {visibleItems.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center">
            <p className="text-sm font-black">Nenhum item encontrado</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item, index) => (
              <button
                key={item.id}
                data-reveal
                style={{ transitionDelay: `${Math.min(index * 45, 260)}ms` }}
                className="reveal-on-scroll group overflow-hidden rounded-lg border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-panel"
                onClick={() => setSelectedProduct(item)}
              >
                <div className="relative overflow-hidden">
                  <FoodImage src={item.imageUrl} alt={item.imageAlt} className="aspect-[16/10] w-full transition duration-500 group-hover:scale-[1.04]" />
                  {item.promotion ? (
                    <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground shadow-sm">
                      {item.promotion.badgeLabel}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-black leading-tight">{item.displayName}</h2>
                    <span className="shrink-0 text-right">
                      {item.compareAtPrice ? <span className="block text-xs font-black text-muted-foreground line-through">{currency(item.compareAtPrice)}</span> : null}
                      <span className="block text-sm font-black text-primary">{currency(item.price)}</span>
                    </span>
                  </div>
                  {item.promotion ? <p className="text-xs font-black text-accent">{item.promotion.title}</p> : null}
                  <p className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-muted-foreground">{item.description}</p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1 text-xs font-black text-muted-foreground">
                      <Clock size={14} /> {item.prepMinutes} min
                    </span>
                    <span className="text-xs font-black text-primary">Adicionar</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {cart.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 p-3 shadow-panel backdrop-blur safe-bottom">
          <div className="container flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black">{cart.length} item(ns) no carrinho</p>
              <p className="text-xs font-bold text-muted-foreground">Total {currency(total)}</p>
            </div>
            <button className="hc-button-primary" disabled={!canCheckout} onClick={() => setCheckoutOpen(true)}>
              <ShoppingBag size={18} />
              Ver pedido
            </button>
          </div>
        </div>
      ) : null}

      <ProductModal
        product={selectedProduct}
        open={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        onAdd={(item) => setCart((current) => [...current, item])}
      />

      <Modal
        title="Finalizar pedido"
        subtitle={`${menu.store.receiptName} + HappyCashFood`}
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        size="lg"
        disableEscape={loyaltyOpen || Boolean(pendingRemoval)}
        footer={
          <div className="space-y-3">
            {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
            <button className="hc-button-primary w-full" disabled={submitting || !canCheckout} onClick={submitOrder}>
              <CreditCard size={18} />
              {submitting ? "Enviando..." : paymentTiming === "now" ? `Pagar agora ${currency(total)}` : `Pedir e pagar no caixa ${currency(total)}`}
            </button>
          </div>
        }
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="rounded-lg border bg-background p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black">{isCustomerSignedIn ? `Cliente: ${customerDisplayName}` : "Entre para enviar o pedido"}</p>
                  <p className="text-xs font-bold text-muted-foreground">{estimatedWaitLabel}</p>
                </div>
                <button className="hc-button-soft" onClick={() => setLoyaltyOpen(true)}>
                  <ShieldCheck size={17} />
                  {isCustomerSignedIn ? "Editar dados" : "Entrar"}
                </button>
              </div>
            </div>

            <div>
              <span className="hc-label">Como deseja pagar</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {([
                  ["cashier", "Pagar no caixa/balcao"],
                  ["now", "Pagar agora"],
                ] as Array<[PaymentTiming, string]>).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    className={paymentTiming === mode ? "hc-button-primary" : "hc-button-soft"}
                    onClick={() => setPaymentTiming(mode)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="hc-label">Email</span>
                <input value={customer.email} onChange={(event) => setCustomer((current) => ({ ...current, email: event.target.value }))} className="hc-input mt-2" type="email" autoComplete="email" />
              </label>
              <label>
                <span className="hc-label">Nome</span>
                <input value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} className="hc-input mt-2" />
              </label>
              <label>
                <span className="hc-label">Telefone</span>
                <input value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} className="hc-input mt-2" inputMode="tel" />
              </label>
            </div>

            {serviceType === "delivery" ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <label>
                  <span className="hc-label">Endereco</span>
                  <input value={customer.address} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} className="hc-input mt-2" />
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
            ) : null}

            <div>
              <span className="hc-label">Pagamento</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(["pix", "debit", "credit", "voucher", "card", "cash"] as const).map((method) => (
                  <button
                    type="button"
                    key={method}
                    className={customer.paymentMethod === method ? "hc-button-primary" : "hc-button-soft"}
                    onClick={() => setCustomer((current) => ({ ...current, paymentMethod: method }))}
                  >
                    {method === "pix" ? "Pix" : method === "debit" ? "Debito" : method === "credit" ? "Credito" : method === "voucher" ? "Voucher" : method === "card" ? "Cartao" : "Dinheiro"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-lg border bg-background p-3">
            <p className="mb-3 text-sm font-black">Resumo</p>
            <div className="max-h-72 space-y-3 overflow-auto pr-1 scrollbar-thin">
              {cart.map((item) => (
                <div key={item.cartId} className="flex gap-3">
                  <FoodImage src={item.imageUrl} alt={item.name} className="size-14 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">{item.quantity}x {item.name}</p>
                    {item.options.map((option) => (
                      <p key={`${item.cartId}-${option.valueId}`} className="text-xs font-bold text-muted-foreground">{option.valueName}</p>
                    ))}
                    {(item.removedIngredients || []).length > 0 ? <p className="text-xs font-black text-primary">Sem: {item.removedIngredients.join(", ")}</p> : null}
                    {item.notes ? <p className="text-xs font-bold text-muted-foreground">Obs: {item.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="text-sm font-black">{currency(cartItemTotal(item))}</p>
                    <button className="inline-flex items-center gap-1 text-xs font-black text-primary" onClick={() => editCartItem(item)}>
                      Editar
                    </button>
                    <button className="inline-flex items-center gap-1 text-xs font-black text-red-600" onClick={() => removeCartItem(item.cartId)}>
                      <Trash2 size={14} /> Tirar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2 border-t pt-3 text-sm font-bold">
              <div className="flex justify-between"><span>Subtotal</span><span>{currency(subtotal)}</span></div>
              {serviceType === "delivery" ? <div className="flex justify-between"><span>Entrega</span><span>{currency(deliveryFee)}</span></div> : null}
              <div className="flex justify-between text-base font-black"><span>Total</span><span>{currency(total)}</span></div>
            </div>
          </aside>
        </div>
      </Modal>

      <Modal
        title="Chamar garcom"
        subtitle={menu.table ? `${menu.table.name || "Mesa " + menu.table.code} | HappyCashFood` : "HappyCashFood"}
        open={waiterModalOpen}
        onClose={() => {
          if (tableActionLoading !== "call_waiter") setWaiterModalOpen(false);
        }}
        size="sm"
        disableEscape={tableActionLoading === "call_waiter"}
        footer={
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
        }
      >
        <div className="space-y-4">
          <p className="text-sm font-semibold leading-6 text-muted-foreground">
            Confirme para avisar a equipe da mesa. Essa acao nao cria pedido na cozinha.
          </p>
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
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
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
          <div className={`grid rounded-lg bg-muted p-1 ${isCustomerSignedIn ? "grid-cols-3" : "grid-cols-2"}`}>
            {([
              ["signin", "Entrar"],
              ["signup", "Criar"],
              ...(isCustomerSignedIn ? [["profile", "Dados"] as const] : []),
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`min-h-10 rounded-md text-sm font-black transition ${customerMode === mode ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}
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
            <div className="space-y-3">
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
            </div>
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

          {customerAuthMessage ? <p className="rounded-lg bg-muted p-3 text-sm font-bold text-muted-foreground">{customerAuthMessage}</p> : null}
          {loyaltyError ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{loyaltyError}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            {customerMode === "signin" ? (
              <button className="hc-button-primary flex-1" onClick={submitCustomerAuth} disabled={customerAuthLoading}>
                <LogIn size={18} /> {customerAuthLoading ? "Entrando..." : "Entrar"}
              </button>
            ) : null}
            {customerMode === "signup" ? (
              <button className="hc-button-primary flex-1" onClick={submitCustomerAuth} disabled={customerAuthLoading}>
                <UserPlus size={18} /> {customerAuthLoading ? "Criando..." : "Criar conta"}
              </button>
            ) : null}
            {customerMode === "profile" ? (
              <button className="hc-button-primary flex-1" onClick={saveCustomerProfile} disabled={customerAuthLoading}>
                <ShieldCheck size={18} /> {customerAuthLoading ? "Salvando..." : "Salvar dados"}
              </button>
            ) : null}
            {isCustomerSignedIn ? (
              <button className="hc-button-soft" onClick={() => void logoutLoyaltyProfile()}>
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
            <p className="text-sm font-bold text-muted-foreground">
              Quer realmente tirar {pendingRemoval.quantity}x {pendingRemoval.name} do carrinho?
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="hc-button-soft" onClick={() => setPendingRemoval(null)}>Cancelar</button>
              <button className="hc-button-primary" onClick={confirmRemoveCartItem}>
                <Trash2 size={18} /> Tirar item
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal title="Pedido enviado" open={Boolean(receipt)} onClose={() => setReceipt(null)} size="sm">
        {receipt ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto text-accent" size={42} />
            <div>
              <p className="text-xl font-black">{receipt.title}</p>
              <p className="mt-1 text-sm font-bold text-muted-foreground">{receipt.brand}</p>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Comprovante</p>
              <p className="mt-1 text-lg font-black">{receipt.number}</p>
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

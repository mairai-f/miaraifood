import {
  Eye,
  EyeOff,
  ExternalLink,
  ImagePlus,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Percent,
  Plus,
  QrCode,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { BrandMark } from "@/components/BrandMark";
import { FoodImage } from "@/components/FoodImage";
import { Modal } from "@/components/Modal";
import { requestMenuAdminPasswordReset, signInMenuAdmin } from "@/lib/menuAdminAuth";
import {
  loadAdminBootstrap,
  replaceMenuItemOptions,
  savePublicProfile,
  uploadMenuImage,
  upsertCategory,
  upsertMenuItem,
  upsertPromotion,
  upsertTable,
} from "@/lib/menuApi";
import { currency, deliveryMenuUrl, normalizeSlug, tableMenuUrl } from "@/lib/format";
import { menuAdminSupabase } from "@/lib/supabase";
import type { AdminPublicProfile, AdminStoreAccount, MenuCategory, MenuItem, MenuOptionGroup, MenuPromotion, MenuTable, OptionType, Station } from "@/types";
import { getPublicErrorMessage } from "../../../shared/security/redaction";

type AdminState = {
  account: AdminStoreAccount;
  profile: AdminPublicProfile;
  categories: MenuCategory[];
  items: MenuItem[];
  tables: MenuTable[];
  promotions: MenuPromotion[];
};

type AdminTab = "vitrine" | "imagens" | "produtos" | "promocoes" | "mesas";

const emptyProduct = (categoryId?: string): Partial<MenuItem> & { displayName: string; price: number } => ({
  displayName: "",
  description: "",
  price: 0,
  compareAtPrice: null,
  imageUrl: null,
  imageAlt: "",
  categoryId: categoryId || null,
  station: "kitchen",
  prepMinutes: 12,
  tags: [],
  removableIngredients: [],
  sortOrder: 0,
  featured: false,
  active: true,
  qrVisible: true,
  availableForDineIn: true,
  availableForDelivery: true,
});

const emptyCategory = (): Partial<MenuCategory> & { name: string } => ({
  name: "",
  description: "",
  sortOrder: 0,
  active: true,
  qrVisible: true,
});

const emptyTable = (): Partial<MenuTable> & { code: string } => ({
  code: "",
  name: "",
  area: "Salao",
  seats: 4,
  active: true,
});

const today = () => new Date().toISOString().slice(0, 10);

const emptyPromotion = (menuItemId?: string): Partial<MenuPromotion> & { menuItemId: string; title: string; discountValue: number } => ({
  menuItemId: menuItemId || "",
  title: "",
  description: "",
  badgeLabel: "Oferta",
  discountType: "amount",
  discountValue: 0,
  startsAt: today(),
  endsAt: null,
  active: true,
  showOnMenu: true,
  sortOrder: 0,
});

const stationLabel: Record<Station, string> = {
  kitchen: "Cozinha",
  bar: "Bar",
  counter: "Pizzaria / Balcao",
};

const optionTextFromGroups = (groups?: MenuOptionGroup[]) =>
  (groups || [])
    .map((group) => {
      const required = group.required ? "obrigatorio" : "opcional";
      const values = group.values.map((value) => `${value.name}:${value.priceDelta}`).join(", ");
      return `${group.name} | ${group.optionType} | ${required} | ${values}`;
    })
    .join("\n");

const parseOptionText = (text: string): MenuOptionGroup[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name = "", type = "single", required = "opcional", values = ""] = line.split("|").map((part) => part.trim());
      const optionType = (["single", "multiple", "quantity"].includes(type) ? type : "single") as OptionType;
      const parsedValues = values
        .split(",")
        .map((value, valueIndex) => {
          const [valueName = "", price = "0"] = value.split(":").map((part) => part.trim());
          return {
            id: `option-value-${index}-${valueIndex}`,
            name: valueName,
            priceDelta: Number(price.replace(",", ".")) || 0,
            active: true,
          };
        })
        .filter((value) => value.name);

      return {
        id: `option-group-${index}`,
        name,
        optionType,
        minSelected: required.toLowerCase().startsWith("obrig") ? 1 : 0,
        maxSelected: optionType === "single" ? 1 : null,
        required: required.toLowerCase().startsWith("obrig"),
        active: true,
        values: parsedValues,
      };
    })
    .filter((group) => group.name && group.values.length);

type MenuAdminLoginPreferences = {
  rememberAccount: boolean;
  email: string;
};

const menuAdminLoginStorageKeys = {
  rememberAccount: "happycash:menu-admin:remember-account",
  email: "happycash:menu-admin:remembered-email",
} as const;

const isBrowser = () => typeof window !== "undefined";
const normalizeEmail = (value: string) => value.trim().toLowerCase();

const readMenuAdminStorage = (key: string) => {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(key);
};

const getMenuAdminLoginPreferences = (): MenuAdminLoginPreferences => ({
  rememberAccount: readMenuAdminStorage(menuAdminLoginStorageKeys.rememberAccount) === "1",
  email: readMenuAdminStorage(menuAdminLoginStorageKeys.email) ?? "",
});

const saveMenuAdminLoginPreferences = ({ rememberAccount, email }: MenuAdminLoginPreferences) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(menuAdminLoginStorageKeys.rememberAccount, rememberAccount ? "1" : "0");

  const normalizedEmail = normalizeEmail(email);
  if (rememberAccount && normalizedEmail) {
    window.localStorage.setItem(menuAdminLoginStorageKeys.email, normalizedEmail);
    return;
  }

  window.localStorage.removeItem(menuAdminLoginStorageKeys.email);
};

const useAdminRevealOnScroll = (watchKey: string) => {
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

function LoginPanel({ onLogin }: { onLogin: () => void | Promise<void> }) {
  const [initialPreferences] = useState(getMenuAdminLoginPreferences);
  const [email, setEmail] = useState(initialPreferences.email);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberAccount, setRememberAccount] = useState(initialPreferences.rememberAccount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetFeedback, setResetFeedback] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (!resetOpen) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setResetOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [resetOpen]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInMenuAdmin(email, password);
      saveMenuAdminLoginPreferences({ rememberAccount, email });
      await onLogin();
    } catch (loginError) {
      setError(getPublicErrorMessage(loginError, "Nao foi possivel entrar."));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim() || resettingPassword) return;
    setResettingPassword(true);
    setResetFeedback("");

    try {
      await requestMenuAdminPasswordReset(resetEmail);
      setResetFeedback("Enviamos o link para redefinir sua senha no email informado.");
    } catch (resetError) {
      setResetFeedback(getPublicErrorMessage(resetError, "Nao foi possivel enviar o email agora."));
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <main className="relative h-[100svh] overflow-hidden bg-[#050505] px-3 py-2 text-foreground sm:px-4 sm:py-3">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(250,204,21,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_42%)]" />
      <section className="relative mx-auto flex h-full w-full max-w-[23rem] items-center justify-center sm:max-w-sm">
        <div className="splash-card-enter w-full">
          <div className="mb-3 text-center">
            <img
              src="/happycashfood.webp"
              alt="HappyCashFood"
              className="splash-logo-float mx-auto h-auto w-[clamp(9.25rem,34vw,14.5rem)] max-w-full object-contain"
              width={1536}
              height={1024}
              loading="eager"
              decoding="async"
            />
          </div>

          <form onSubmit={submit} className="rounded-lg border border-yellow-400/15 bg-black/45 p-4 shadow-panel backdrop-blur-md sm:p-5">
            <div className="space-y-1 text-center">
              <h1 className="text-base font-bold tracking-wide text-yellow-300 sm:text-lg">Entrar no cardapio</h1>
              <p className="text-[11px] text-muted-foreground">Use seu email e senha HappyCashFood.</p>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-border bg-zinc-950/70 px-3 text-sm font-semibold outline-none ring-primary transition focus:ring-2"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </label>
              <label className="block">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Senha</span>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email.trim());
                      setResetFeedback("");
                      setResetOpen(true);
                    }}
                    className="text-xs font-semibold text-muted-foreground transition hover:text-primary"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <span className="relative mt-2 block">
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-zinc-950/70 px-3 pr-11 text-sm font-semibold outline-none ring-primary transition focus:ring-2"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition hover:text-primary"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>

              <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-muted-foreground sm:text-sm">
                <input
                  type="checkbox"
                  checked={rememberAccount}
                  onChange={(event) => setRememberAccount(event.target.checked)}
                  className="h-4 w-4 rounded border-border bg-zinc-950 accent-yellow-400"
                />
                <span>Lembrar minha conta</span>
              </label>
            </div>

            {error ? <p className="mt-4 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm font-bold text-destructive">{error}</p> : null}

            <button
              type="submit"
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-black text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Entrar
            </button>
          </form>
        </div>
      </section>

      <Modal title="Redefinir senha" subtitle="Conta HappyCashFood" open={resetOpen} onClose={() => setResetOpen(false)} size="sm">
        <div className="space-y-4">
          <label className="block">
            <span className="hc-label">Email</span>
            <input value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} className="hc-input mt-2" type="email" autoComplete="email" />
          </label>
          {resetFeedback ? <p className="rounded-lg bg-muted p-3 text-sm font-bold text-muted-foreground">{resetFeedback}</p> : null}
          <button type="button" onClick={() => void handleResetPassword()} disabled={resettingPassword || !resetEmail.trim()} className="hc-button-primary w-full">
            {resettingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Enviar link
          </button>
        </div>
      </Modal>
    </main>
  );
}

function ProfilePanel({
  state,
  onUpdate,
}: {
  state: AdminState;
  onUpdate: (profile: AdminPublicProfile) => void;
}) {
  const [profile, setProfile] = useState(state.profile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setProfile(state.profile), [state.profile]);

  const publicUrl = deliveryMenuUrl(profile.slug);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await savePublicProfile(profile);
      onUpdate(saved);
      setMessage("Vitrine salva.");
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Nao foi possivel salvar."));
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (file: File | null) => {
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadMenuImage(state.account.id, file);
      setProfile((current) => ({ ...current, coverUrl: url }));
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Imagem nao enviada."));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File | null) => {
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadMenuImage(state.account.id, file);
      setProfile((current) => ({ ...current, logoUrl: url }));
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Imagem nao enviada."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Vitrine da empresa</h2>
            <p className="text-sm font-semibold text-muted-foreground">Nome vindo da empresa assinante, com marca HappyCashFood no rodape e cupom.</p>
          </div>
          <button className="hc-button-primary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="hc-label">Nome publico</span>
            <input value={profile.displayName} onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} className="hc-input mt-2" />
          </label>
          <label>
            <span className="hc-label">Nome no cupom</span>
            <input value={profile.receiptName} onChange={(event) => setProfile((current) => ({ ...current, receiptName: event.target.value }))} className="hc-input mt-2" />
          </label>
          <label>
            <span className="hc-label">Slug</span>
            <input value={profile.slug} onChange={(event) => setProfile((current) => ({ ...current, slug: normalizeSlug(event.target.value) }))} className="hc-input mt-2" />
          </label>
          <label>
            <span className="hc-label">WhatsApp</span>
            <input value={profile.whatsapp} onChange={(event) => setProfile((current) => ({ ...current, whatsapp: event.target.value }))} className="hc-input mt-2" inputMode="tel" />
          </label>
          <label className="md:col-span-2">
            <span className="hc-label">Descricao</span>
            <textarea value={profile.description} onChange={(event) => setProfile((current) => ({ ...current, description: event.target.value }))} className="hc-textarea mt-2 min-h-24" />
          </label>
          <label>
            <span className="hc-label">Endereco</span>
            <input value={profile.addressLine} onChange={(event) => setProfile((current) => ({ ...current, addressLine: event.target.value }))} className="hc-input mt-2" />
          </label>
          <label>
            <span className="hc-label">Cidade / UF</span>
            <input value={`${profile.city}${profile.state ? ` - ${profile.state}` : ""}`} onChange={(event) => {
              const [city, stateValue] = event.target.value.split("-").map((part) => part.trim());
              setProfile((current) => ({ ...current, city: city || "", state: (stateValue || current.state).slice(0, 2).toUpperCase() }));
            }} className="hc-input mt-2" />
          </label>
          <label>
            <span className="hc-label">Taxa de entrega</span>
            <input value={profile.deliveryFee} onChange={(event) => setProfile((current) => ({ ...current, deliveryFee: Number(event.target.value) || 0 }))} className="hc-input mt-2" type="number" min="0" step="0.01" />
          </label>
          <label>
            <span className="hc-label">Pedido minimo</span>
            <input value={profile.minimumOrderAmount} onChange={(event) => setProfile((current) => ({ ...current, minimumOrderAmount: Number(event.target.value) || 0 }))} className="hc-input mt-2" type="number" min="0" step="0.01" />
          </label>
          <label>
            <span className="hc-label">Tempo de espera</span>
            <input value={profile.estimatedDeliveryMinutes} onChange={(event) => setProfile((current) => ({ ...current, estimatedDeliveryMinutes: Number(event.target.value) || 45 }))} className="hc-input mt-2" type="number" min="1" />
          </label>
          <div>
            <span className="hc-label">Logo</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-[72px_1fr]">
              <FoodImage src={profile.logoUrl} alt={profile.displayName} className="aspect-square w-full rounded-lg" />
              <div className="space-y-2">
                <input className="hidden" id="logo-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadLogo(event.target.files?.[0] || null)} />
                <label htmlFor="logo-upload" className="hc-button-soft w-full cursor-pointer">
                  <Upload size={18} /> Enviar logo
                </label>
                <input value={profile.logoUrl || ""} onChange={(event) => setProfile((current) => ({ ...current, logoUrl: event.target.value || null }))} className="hc-input" placeholder="URL do logo" />
                <button className="hc-button-soft w-full" onClick={() => setProfile((current) => ({ ...current, logoUrl: null }))}>
                  <Trash2 size={18} /> Remover logo
                </button>
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <span className="hc-label">Capa</span>
            <div className="mt-2 grid gap-3 md:grid-cols-[180px_1fr]">
              <FoodImage src={profile.coverUrl} alt={profile.displayName} className="aspect-[16/9] w-full rounded-lg" />
              <div className="space-y-2">
                <input className="hidden" id="cover-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadCover(event.target.files?.[0] || null)} />
                <label htmlFor="cover-upload" className="hc-button-soft cursor-pointer">
                  <Upload size={18} /> Enviar capa
                </label>
                <input value={profile.coverUrl || ""} onChange={(event) => setProfile((current) => ({ ...current, coverUrl: event.target.value || null }))} className="hc-input" placeholder="URL da capa" />
                <button className="hc-button-soft" onClick={() => setProfile((current) => ({ ...current, coverUrl: null }))}>
                  <Trash2 size={18} /> Remover capa
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="hc-button-soft"
            onClick={() => setProfile((current) => ({
              ...current,
              addressLine: state.account.addressLine,
              city: state.account.city,
              state: state.account.state,
              phone: state.account.phone,
              whatsapp: state.account.phone,
            }))}
          >
            <MapPin size={18} /> Usar cadastro
          </button>
          <button className={profile.isOpen ? "hc-button-accent" : "hc-button-soft"} onClick={() => setProfile((current) => ({ ...current, isOpen: !current.isOpen }))}>
            {profile.isOpen ? "Loja aberta" : "Loja fechada"}
          </button>
          <button className={profile.acceptsDelivery ? "hc-button-accent" : "hc-button-soft"} onClick={() => setProfile((current) => ({ ...current, acceptsDelivery: !current.acceptsDelivery }))}>
            Delivery
          </button>
          <button className={profile.acceptsDineIn ? "hc-button-accent" : "hc-button-soft"} onClick={() => setProfile((current) => ({ ...current, acceptsDineIn: !current.acceptsDineIn }))}>
            QR de mesa
          </button>
        </div>

        {message ? <p className="mt-4 rounded-lg bg-muted p-3 text-sm font-bold text-muted-foreground">{message}</p> : null}
      </div>

      <aside className="rounded-lg border bg-card p-4">
        <p className="text-sm font-black">Preview publico</p>
        <div className="mt-3 overflow-hidden rounded-lg border bg-background">
          <FoodImage src={profile.coverUrl} alt={profile.displayName} className="aspect-[16/9] w-full" />
          <div className="p-4">
            <BrandMark name={profile.displayName} logoUrl={profile.logoUrl} />
            <p className="mt-3 text-sm font-semibold text-muted-foreground">{profile.description}</p>
            <a href={publicUrl} target="_blank" rel="noreferrer" className="hc-button-primary mt-4 w-full">
              <ExternalLink size={18} /> Abrir cardapio
            </a>
          </div>
        </div>
      </aside>
    </section>
  );
}

function ProductsPanel({
  state,
  setState,
}: {
  state: AdminState;
  setState: React.Dispatch<React.SetStateAction<AdminState | null>>;
}) {
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [productForm, setProductForm] = useState(emptyProduct(state.categories[0]?.id));
  const [optionText, setOptionText] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoSavingId, setPhotoSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const categoriesById = useMemo(() => new Map(state.categories.map((category) => [category.id, category])), [state.categories]);
  useAdminRevealOnScroll(state.items.map((item) => item.id).join(","));

  const saveCategory = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await upsertCategory(state.account, categoryForm);
      setState((current) => current ? {
        ...current,
        categories: [...current.categories.filter((category) => category.id !== saved.id), saved].sort((a, b) => a.sortOrder - b.sortOrder),
      } : current);
      setCategoryForm(emptyCategory());
      setMessage("Categoria salva.");
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Nao foi possivel salvar."));
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const savedItem = await upsertMenuItem(state.account, productForm);
      const savedOptions = await replaceMenuItemOptions(state.account, savedItem.id, parseOptionText(optionText));
      const saved = { ...savedItem, options: savedOptions };
      setState((current) => current ? {
        ...current,
        items: [...current.items.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.sortOrder - b.sortOrder),
      } : current);
      setProductForm(emptyProduct(state.categories[0]?.id));
      setOptionText("");
      setMessage("Produto salvo.");
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Nao foi possivel salvar."));
    } finally {
      setSaving(false);
    }
  };

  const uploadProductImage = async (file: File | null) => {
    if (!file) return;
    setSaving(true);
    try {
      const url = await uploadMenuImage(state.account.id, file);
      setProductForm((current) => ({ ...current, imageUrl: url }));
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Imagem nao enviada."));
    } finally {
      setSaving(false);
    }
  };

  const saveExistingProductImage = async (item: MenuItem, file: File | null) => {
    if (!file) return;
    setPhotoSavingId(item.id);
    setMessage(null);
    try {
      const url = await uploadMenuImage(state.account.id, file);
      const savedItem = await upsertMenuItem(state.account, { ...item, imageUrl: url });
      const saved = { ...savedItem, options: item.options };
      setState((current) => current ? {
        ...current,
        items: current.items.map((currentItem) => currentItem.id === item.id ? saved : currentItem),
      } : current);
      setProductForm((current) => current.id === saved.id ? { ...current, imageUrl: saved.imageUrl } : current);
      setMessage(`Foto de ${item.displayName} atualizada.`);
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Imagem nao enviada."));
    } finally {
      setPhotoSavingId(null);
    }
  };

  const clearExistingProductImage = async (item: MenuItem) => {
    setPhotoSavingId(item.id);
    setMessage(null);
    try {
      const savedItem = await upsertMenuItem(state.account, { ...item, imageUrl: null });
      const saved = { ...savedItem, options: item.options };
      setState((current) => current ? {
        ...current,
        items: current.items.map((currentItem) => currentItem.id === item.id ? saved : currentItem),
      } : current);
      setProductForm((current) => current.id === saved.id ? { ...current, imageUrl: null } : current);
      setMessage(`Foto de ${item.displayName} removida.`);
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Nao foi possivel remover a foto."));
    } finally {
      setPhotoSavingId(null);
    }
  };

  const startEditingProduct = (item: MenuItem) => {
    setProductForm(item);
    setOptionText(optionTextFromGroups(item.options));
    window.requestAnimationFrame(() => {
      document.getElementById("menu-product-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-lg font-black">Categoria</h2>
          <div className="mt-4 space-y-3">
            <input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} className="hc-input" placeholder="Ex: Pizzas" />
            <input value={categoryForm.description || ""} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} className="hc-input" placeholder="Descricao curta" />
            <button className="hc-button-primary w-full" disabled={saving || !categoryForm.name.trim()} onClick={saveCategory}>
              <Plus size={18} /> Salvar categoria
            </button>
          </div>
        </div>

        <div id="menu-product-form" className="scroll-mt-24 rounded-lg border bg-card p-4">
          <h2 className="text-lg font-black">Produto</h2>
          <div className="mt-4 space-y-3">
            <input value={productForm.displayName} onChange={(event) => setProductForm((current) => ({ ...current, displayName: event.target.value }))} className="hc-input" placeholder="Nome do produto" />
            <select value={productForm.categoryId || ""} onChange={(event) => setProductForm((current) => ({ ...current, categoryId: event.target.value || null }))} className="hc-input">
              <option value="">Sem categoria</option>
              {state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <textarea value={productForm.description || ""} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} className="hc-textarea min-h-20" placeholder="Descricao" />
            <div className="grid grid-cols-2 gap-3">
              <input value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: Number(event.target.value) || 0 }))} className="hc-input" type="number" min="0" step="0.01" placeholder="Preco" />
              <input value={productForm.prepMinutes || 0} onChange={(event) => setProductForm((current) => ({ ...current, prepMinutes: Number(event.target.value) || 0 }))} className="hc-input" type="number" min="0" placeholder="Minutos" />
            </div>
            <select value={productForm.station || "kitchen"} onChange={(event) => setProductForm((current) => ({ ...current, station: event.target.value as Station }))} className="hc-input">
              <option value="kitchen">Cozinha</option>
              <option value="bar">Bar</option>
              <option value="counter">Pizzaria / Balcao</option>
            </select>
            <input value={(productForm.tags || []).join(", ")} onChange={(event) => setProductForm((current) => ({ ...current, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) }))} className="hc-input" placeholder="Tags separadas por virgula" />
            <textarea
              value={(productForm.removableIngredients || []).join(", ")}
              onChange={(event) => setProductForm((current) => ({
                ...current,
                removableIngredients: event.target.value.split(",").map((ingredient) => ingredient.trim()).filter(Boolean),
              }))}
              className="hc-textarea min-h-20"
              placeholder="Ingredientes que o cliente pode tirar: pao, hamburguer, queijo, cebola"
            />
            <textarea
              value={optionText}
              onChange={(event) => setOptionText(event.target.value)}
              className="hc-textarea min-h-28"
              placeholder="Adicionais: Borda | single | opcional | Sem borda:0, Catupiry:8"
            />
            <div className="grid gap-3 sm:grid-cols-[96px_1fr]">
              <FoodImage src={productForm.imageUrl || null} alt={productForm.displayName || "Produto"} className="aspect-square w-full rounded-lg" />
              <div>
                <input
                  className="hidden"
                  id="product-image-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    void uploadProductImage(event.target.files?.[0] || null);
                    event.currentTarget.value = "";
                  }}
                />
                <label htmlFor="product-image-upload" className="hc-button-soft w-full cursor-pointer">
                  <ImagePlus size={18} /> Foto do produto
                </label>
                <input value={productForm.imageUrl || ""} onChange={(event) => setProductForm((current) => ({ ...current, imageUrl: event.target.value }))} className="hc-input mt-2" placeholder="Ou cole uma URL" />
                <button className="hc-button-soft mt-2 w-full" onClick={() => setProductForm((current) => ({ ...current, imageUrl: null }))}>
                  <Trash2 size={18} /> Remover foto
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className={productForm.featured ? "hc-button-accent" : "hc-button-soft"} onClick={() => setProductForm((current) => ({ ...current, featured: !current.featured }))}>Destaque</button>
              <button className={productForm.active ? "hc-button-accent" : "hc-button-soft"} onClick={() => setProductForm((current) => ({ ...current, active: !current.active }))}>Ativo</button>
              <button className={productForm.availableForDineIn ? "hc-button-accent" : "hc-button-soft"} onClick={() => setProductForm((current) => ({ ...current, availableForDineIn: !current.availableForDineIn }))}>Mesa</button>
              <button className={productForm.availableForDelivery ? "hc-button-accent" : "hc-button-soft"} onClick={() => setProductForm((current) => ({ ...current, availableForDelivery: !current.availableForDelivery }))}>Delivery</button>
            </div>
            <button className="hc-button-primary w-full" disabled={saving || !productForm.displayName.trim()} onClick={saveProduct}>
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar produto
            </button>
          </div>
          {message ? <p className="mt-3 rounded-lg bg-muted p-3 text-sm font-bold text-muted-foreground">{message}</p> : null}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Cardapio publicado</h2>
            <p className="text-sm font-semibold text-muted-foreground">{state.items.length} produto(s)</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {state.items.map((item, index) => (
            <div
              key={item.id}
              data-reveal
              style={{ transitionDelay: `${Math.min(index * 45, 260)}ms` }}
              className="reveal-on-scroll flex gap-3 rounded-lg border bg-background p-3"
            >
              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg">
                <FoodImage src={item.imageUrl} alt={item.imageAlt} className="size-full rounded-lg" />
                <input
                  className="hidden"
                  id={`product-card-image-${item.id}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    void saveExistingProductImage(item, event.target.files?.[0] || null);
                    event.currentTarget.value = "";
                  }}
                />
                <label
                  htmlFor={`product-card-image-${item.id}`}
                  className="absolute bottom-1 right-1 grid size-8 cursor-pointer place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm transition hover:brightness-95"
                  title="Trocar foto"
                >
                  {photoSavingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                </label>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{item.displayName}</p>
                    <p className="text-xs font-bold text-muted-foreground">{categoriesById.get(item.categoryId || "")?.name || "Sem categoria"}</p>
                    <p className="text-xs font-bold text-muted-foreground">
                      {stationLabel[item.station]} - {item.options.length} adicional(is) - {item.removableIngredients.length} removivel(is)
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-primary">{currency(item.price)}</p>
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-semibold text-muted-foreground">{item.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button className="inline-flex items-center gap-2 text-xs font-black text-primary" onClick={() => startEditingProduct(item)}>
                    Editar
                  </button>
                  {item.imageUrl ? (
                    <button className="inline-flex items-center gap-1 text-xs font-black text-muted-foreground" onClick={() => void clearExistingProductImage(item)} disabled={photoSavingId === item.id}>
                      <Trash2 size={13} /> Remover foto
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {state.items.length === 0 ? <p className="rounded-lg border bg-background p-6 text-center text-sm font-bold text-muted-foreground">Cadastre o primeiro produto com foto e preco.</p> : null}
        </div>
      </div>
    </section>
  );
}

function ImagesPanel({
  state,
  setState,
}: {
  state: AdminState;
  setState: React.Dispatch<React.SetStateAction<AdminState | null>>;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const updateProfileImage = async (field: "logoUrl" | "coverUrl", file: File | null) => {
    if (!file) return;
    setSavingId(field);
    setMessage(null);
    try {
      const url = await uploadMenuImage(state.account.id, file);
      const saved = await savePublicProfile({ ...state.profile, [field]: url });
      setState((current) => current ? { ...current, profile: saved } : current);
      setMessage(field === "logoUrl" ? "Logo atualizado." : "Capa atualizada.");
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Nao foi possivel enviar a imagem."));
    } finally {
      setSavingId(null);
    }
  };

  const clearProfileImage = async (field: "logoUrl" | "coverUrl") => {
    setSavingId(field);
    setMessage(null);
    try {
      const saved = await savePublicProfile({ ...state.profile, [field]: null });
      setState((current) => current ? { ...current, profile: saved } : current);
      setMessage(field === "logoUrl" ? "Logo removido." : "Capa removida.");
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Nao foi possivel remover a imagem."));
    } finally {
      setSavingId(null);
    }
  };

  const updateProductImage = async (item: MenuItem, file: File | null) => {
    if (!file) return;
    setSavingId(item.id);
    setMessage(null);
    try {
      const url = await uploadMenuImage(state.account.id, file);
      const savedItem = await upsertMenuItem(state.account, { ...item, imageUrl: url });
      const saved = { ...savedItem, options: item.options };
      setState((current) => current ? {
        ...current,
        items: current.items.map((currentItem) => currentItem.id === saved.id ? saved : currentItem),
      } : current);
      setMessage(`Foto de ${item.displayName} atualizada.`);
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Nao foi possivel enviar a foto."));
    } finally {
      setSavingId(null);
    }
  };

  const clearProductImage = async (item: MenuItem) => {
    setSavingId(item.id);
    setMessage(null);
    try {
      const savedItem = await upsertMenuItem(state.account, { ...item, imageUrl: null });
      const saved = { ...savedItem, options: item.options };
      setState((current) => current ? {
        ...current,
        items: current.items.map((currentItem) => currentItem.id === saved.id ? saved : currentItem),
      } : current);
      setMessage(`Foto de ${item.displayName} removida.`);
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Nao foi possivel remover a foto."));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black">Imagens do cardapio</h2>
            <p className="text-sm font-semibold text-muted-foreground">Altere logo, capa e fotos dos produtos direto por upload. Salvamento automatico.</p>
          </div>
          {message ? <p className="rounded-lg bg-muted px-3 py-2 text-sm font-bold text-muted-foreground">{message}</p> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-black">Logo da empresa</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]">
            <FoodImage src={state.profile.logoUrl} alt={state.profile.displayName} className="aspect-square w-full rounded-lg" />
            <div className="space-y-2">
              <input className="hidden" id="images-logo-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void updateProfileImage("logoUrl", event.target.files?.[0] || null)} />
              <label htmlFor="images-logo-upload" className="hc-button-primary w-full cursor-pointer">
                {savingId === "logoUrl" ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                Enviar logo
              </label>
              <button className="hc-button-soft w-full" onClick={() => void clearProfileImage("logoUrl")} disabled={savingId === "logoUrl"}>
                <Trash2 size={18} /> Remover logo
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm font-black">Capa do cardapio</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
            <FoodImage src={state.profile.coverUrl} alt={state.profile.displayName} className="aspect-[16/9] w-full rounded-lg" />
            <div className="space-y-2">
              <input className="hidden" id="images-cover-upload" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void updateProfileImage("coverUrl", event.target.files?.[0] || null)} />
              <label htmlFor="images-cover-upload" className="hc-button-primary w-full cursor-pointer">
                {savingId === "coverUrl" ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                Enviar capa
              </label>
              <button className="hc-button-soft w-full" onClick={() => void clearProfileImage("coverUrl")} disabled={savingId === "coverUrl"}>
                <Trash2 size={18} /> Remover capa
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-lg font-black">Fotos dos produtos</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.items.map((item) => (
            <div key={item.id} className="rounded-lg border bg-background p-3">
              <FoodImage src={item.imageUrl} alt={item.imageAlt || item.displayName} className="aspect-[4/3] w-full rounded-lg" />
              <div className="mt-3">
                <p className="font-black">{item.displayName}</p>
                <p className="text-xs font-bold text-muted-foreground">{stationLabel[item.station]}</p>
              </div>
              <div className="mt-3 grid gap-2">
                <input className="hidden" id={`images-product-${item.id}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void updateProductImage(item, event.target.files?.[0] || null)} />
                <label htmlFor={`images-product-${item.id}`} className="hc-button-primary w-full cursor-pointer">
                  {savingId === item.id ? <Loader2 className="animate-spin" size={18} /> : <ImagePlus size={18} />}
                  Trocar foto
                </label>
                <button className="hc-button-soft w-full" onClick={() => void clearProductImage(item)} disabled={savingId === item.id}>
                  <Trash2 size={18} /> Remover foto
                </button>
              </div>
            </div>
          ))}
          {state.items.length === 0 ? (
            <p className="rounded-lg border bg-background p-6 text-center text-sm font-bold text-muted-foreground">Cadastre produtos antes de enviar fotos.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PromotionsPanel({
  state,
  setState,
}: {
  state: AdminState;
  setState: React.Dispatch<React.SetStateAction<AdminState | null>>;
}) {
  const [promotionForm, setPromotionForm] = useState(emptyPromotion(state.items[0]?.id));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const itemsById = useMemo(() => new Map(state.items.map((item) => [item.id, item])), [state.items]);

  const savePromotion = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await upsertPromotion(state.account, promotionForm);
      setState((current) => current ? {
        ...current,
        promotions: [...current.promotions.filter((promotion) => promotion.id !== saved.id), saved].sort((a, b) => a.sortOrder - b.sortOrder),
      } : current);
      setPromotionForm(emptyPromotion(state.items[0]?.id));
      setMessage("Promocao salva.");
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Nao foi possivel salvar."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="flex items-center gap-2 text-lg font-black"><Percent size={19} /> Promocao</h2>
        <div className="mt-4 space-y-3">
          <select value={promotionForm.menuItemId} onChange={(event) => setPromotionForm((current) => ({ ...current, menuItemId: event.target.value }))} className="hc-input">
            <option value="">Escolha o produto</option>
            {state.items.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
          </select>
          <input value={promotionForm.title} onChange={(event) => setPromotionForm((current) => ({ ...current, title: event.target.value }))} className="hc-input" placeholder="Nome da promocao" />
          <input value={promotionForm.badgeLabel || ""} onChange={(event) => setPromotionForm((current) => ({ ...current, badgeLabel: event.target.value }))} className="hc-input" placeholder="Selo: Oferta, Combo, Hoje" />
          <textarea value={promotionForm.description || ""} onChange={(event) => setPromotionForm((current) => ({ ...current, description: event.target.value }))} className="hc-textarea min-h-20" placeholder="Descricao curta" />
          <div className="grid grid-cols-2 gap-3">
            <select value={promotionForm.discountType || "amount"} onChange={(event) => setPromotionForm((current) => ({ ...current, discountType: event.target.value as MenuPromotion["discountType"] }))} className="hc-input">
              <option value="amount">Desconto R$</option>
              <option value="percent">Desconto %</option>
              <option value="fixed_price">Preco fixo</option>
            </select>
            <input value={promotionForm.discountValue} onChange={(event) => setPromotionForm((current) => ({ ...current, discountValue: Number(event.target.value) || 0 }))} className="hc-input" type="number" min="0" step="0.01" placeholder="Valor" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={promotionForm.startsAt || today()} onChange={(event) => setPromotionForm((current) => ({ ...current, startsAt: event.target.value }))} className="hc-input" type="date" />
            <input value={promotionForm.endsAt || ""} onChange={(event) => setPromotionForm((current) => ({ ...current, endsAt: event.target.value || null }))} className="hc-input" type="date" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className={promotionForm.active ? "hc-button-accent" : "hc-button-soft"} onClick={() => setPromotionForm((current) => ({ ...current, active: !current.active }))}>Ativa</button>
            <button className={promotionForm.showOnMenu ? "hc-button-accent" : "hc-button-soft"} onClick={() => setPromotionForm((current) => ({ ...current, showOnMenu: !current.showOnMenu }))}>Mostrar</button>
          </div>
          <button className="hc-button-primary w-full" disabled={saving || !promotionForm.menuItemId || !promotionForm.title.trim()} onClick={savePromotion}>
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar promocao
          </button>
          {message ? <p className="rounded-lg bg-muted p-3 text-sm font-bold text-muted-foreground">{message}</p> : null}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Promocoes do cardapio</h2>
            <p className="text-sm font-semibold text-muted-foreground">{state.promotions.length} promocao(oes)</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {state.promotions.map((promotion) => {
            const item = itemsById.get(promotion.menuItemId);
            return (
              <div key={promotion.id} className="rounded-lg border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{promotion.title}</p>
                    <p className="text-xs font-bold text-muted-foreground">{item?.displayName || "Produto removido"}</p>
                  </div>
                  <span className={promotion.active ? "rounded-full bg-success px-3 py-1 text-xs font-black text-success-foreground" : "rounded-full bg-muted px-3 py-1 text-xs font-black text-muted-foreground"}>
                    {promotion.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <p className="mt-2 text-sm font-bold">
                  {promotion.discountType === "percent" ? `${promotion.discountValue}%` : currency(promotion.discountValue)}
                  {promotion.discountType === "fixed_price" ? " preco final" : " de desconto"}
                </p>
                {promotion.description ? <p className="mt-2 text-xs font-semibold text-muted-foreground">{promotion.description}</p> : null}
                <button className="mt-3 inline-flex items-center gap-2 text-xs font-black text-primary" onClick={() => setPromotionForm(promotion)}>
                  Editar
                </button>
              </div>
            );
          })}
          {state.promotions.length === 0 ? <p className="rounded-lg border bg-background p-6 text-center text-sm font-bold text-muted-foreground">Crie promocoes para destacar produtos no cardapio.</p> : null}
        </div>
      </div>
    </section>
  );
}

function TablesPanel({
  state,
  setState,
}: {
  state: AdminState;
  setState: React.Dispatch<React.SetStateAction<AdminState | null>>;
}) {
  const [tableForm, setTableForm] = useState(emptyTable);
  const [saving, setSaving] = useState(false);
  const [qrTable, setQrTable] = useState<MenuTable | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const saveTable = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const saved = await upsertTable(state.account, tableForm);
      setState((current) => current ? {
        ...current,
        tables: [...current.tables.filter((table) => table.id !== saved.id), saved].sort((a, b) => a.code.localeCompare(b.code)),
      } : current);
      setTableForm(emptyTable());
      setMessage("Mesa salva.");
    } catch (error) {
      setMessage(getPublicErrorMessage(error, "Nao foi possivel salvar."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-black">Mesa</h2>
        <div className="mt-4 space-y-3">
          <input value={tableForm.code} onChange={(event) => setTableForm((current) => ({ ...current, code: event.target.value }))} className="hc-input" placeholder="Numero ou codigo" />
          <input value={tableForm.name || ""} onChange={(event) => setTableForm((current) => ({ ...current, name: event.target.value }))} className="hc-input" placeholder="Nome da mesa" />
          <input value={tableForm.area || ""} onChange={(event) => setTableForm((current) => ({ ...current, area: event.target.value }))} className="hc-input" placeholder="Area" />
          <input value={tableForm.seats || 4} onChange={(event) => setTableForm((current) => ({ ...current, seats: Number(event.target.value) || 4 }))} className="hc-input" type="number" min="1" />
          <button className="hc-button-primary w-full" disabled={saving || !tableForm.code.trim()} onClick={saveTable}>
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Salvar mesa
          </button>
          {message ? <p className="rounded-lg bg-muted p-3 text-sm font-bold text-muted-foreground">{message}</p> : null}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-xl font-black">QR Codes das mesas</h2>
        <p className="mt-1 text-sm font-bold text-muted-foreground">
          O QR Code apenas abre o cardapio digital. Pedidos, chamada do garcom e fechamento de conta acontecem pelos botoes dentro do cardapio.
        </p>
        <div className="mt-4 rounded-lg border border-primary/25 bg-primary/10 p-3">
          <div className="grid gap-3 md:grid-cols-[132px_1fr] md:items-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(deliveryMenuUrl(state.profile.slug))}`}
              alt="QR delivery"
              className="mx-auto size-32 rounded-lg border bg-white p-2"
            />
            <div>
              <p className="font-black">QR geral do delivery</p>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">Use este QR em redes sociais, balcão e embalagem. As mesas usam QR proprio abaixo.</p>
              <input className="hc-input mt-3 text-xs" readOnly value={deliveryMenuUrl(state.profile.slug)} onFocus={(event) => event.currentTarget.select()} />
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.tables.map((table) => {
            const url = tableMenuUrl(state.profile.slug, table.qrSlug);
            return (
              <div key={table.id} className="rounded-lg border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{table.name || `Mesa ${table.code}`}</p>
                    <p className="text-xs font-bold text-muted-foreground">{table.area} - {table.seats} lugares</p>
                  </div>
                  <button className="hc-icon-button" onClick={() => setQrTable(table)} aria-label="Abrir QR">
                    <QrCode size={18} />
                  </button>
                </div>
                <input className="hc-input mt-3 text-xs" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
              </div>
            );
          })}
          {state.tables.length === 0 ? <p className="rounded-lg border bg-background p-6 text-center text-sm font-bold text-muted-foreground">Cadastre mesas para gerar links de QR.</p> : null}
        </div>
      </div>

      <Modal title={qrTable ? (qrTable.name || `Mesa ${qrTable.code}`) : "QR"} open={Boolean(qrTable)} onClose={() => setQrTable(null)} size="sm">
        {qrTable ? (
          <div className="space-y-4 text-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(tableMenuUrl(state.profile.slug, qrTable.qrSlug))}`}
              alt={`QR ${qrTable.name || qrTable.code}`}
              className="mx-auto size-64 rounded-lg border bg-white p-3"
            />
            <p className="break-all text-sm font-bold text-muted-foreground">{tableMenuUrl(state.profile.slug, qrTable.qrSlug)}</p>
            <a href={tableMenuUrl(state.profile.slug, qrTable.qrSlug)} target="_blank" rel="noreferrer" className="hc-button-primary w-full">
              <ExternalLink size={18} /> Abrir link
            </a>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [state, setState] = useState<AdminState | null>(null);
  const [loadingState, setLoadingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<AdminTab>("vitrine");

  const reload = async () => {
    setLoadingState(true);
    setError(null);
    try {
      setState(await loadAdminBootstrap());
    } catch (loadError) {
      setState(null);
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar o cardapio.");
    } finally {
      setLoadingState(false);
    }
  };

  const finishLogin = async () => {
    const { data } = await menuAdminSupabase.auth.getSession();
    setSession(data.session);
    if (data.session) await reload();
  };

  useEffect(() => {
    menuAdminSupabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
      if (data.session) void reload();
    });

    const { data: listener } = menuAdminSupabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void reload();
      else setState(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <main className="app-shell grid min-h-dvh place-items-center">
        <Loader2 className="animate-spin text-primary" size={34} />
      </main>
    );
  }

  if (!session) return <LoginPanel onLogin={finishLogin} />;

  return (
    <main className="app-shell min-h-dvh">
      <header className="border-b bg-card/95 backdrop-blur">
        <div className="container flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <BrandMark name={state?.profile.displayName || "HappyCashMenu Admin"} logoUrl={state?.profile.logoUrl} />
          <div className="flex flex-wrap items-center gap-2">
            <a className="hc-button-soft" href={state ? deliveryMenuUrl(state.profile.slug) : "#"} target="_blank" rel="noreferrer">
              <ExternalLink size={18} /> Publico
            </a>
            <button className="hc-button-soft" onClick={() => menuAdminSupabase.auth.signOut()}>
              <LogOut size={18} /> Sair
            </button>
          </div>
        </div>
      </header>

      <section className="container py-5">
        {state && !loadingState && !error ? (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {([
              ["vitrine", "Vitrine"],
              ["imagens", "Imagens"],
              ["produtos", "Produtos"],
              ["promocoes", "Promocoes"],
              ["mesas", "Mesas e QR"],
            ] as Array<[AdminTab, string]>).map(([id, label]) => (
              <button key={id} className={tab === id ? "hc-button-primary whitespace-nowrap" : "hc-button-soft whitespace-nowrap"} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {loadingState ? (
          <div className="grid min-h-72 place-items-center rounded-lg border bg-card">
            <div className="text-center">
              <Loader2 className="mx-auto animate-spin text-primary" size={34} />
              <p className="mt-3 text-sm font-black text-muted-foreground">Carregando administracao do cardapio</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg border bg-card p-6">
            <p className="font-black text-red-700">{error}</p>
            <button className="hc-button-primary mt-4" onClick={reload}>Tentar novamente</button>
          </div>
        ) : state ? (
          <>
            {tab === "vitrine" ? <ProfilePanel state={state} onUpdate={(profile) => setState((current) => current ? { ...current, profile } : current)} /> : null}
            {tab === "imagens" ? <ImagesPanel state={state} setState={setState} /> : null}
            {tab === "produtos" ? <ProductsPanel state={state} setState={setState} /> : null}
            {tab === "promocoes" ? <PromotionsPanel state={state} setState={setState} /> : null}
            {tab === "mesas" ? <TablesPanel state={state} setState={setState} /> : null}
          </>
        ) : null}
      </section>
    </main>
  );
}

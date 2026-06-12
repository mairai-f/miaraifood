import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  CreditCard,
  Crown,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  QrCode,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearSiteLocalSession, enforceSiteSessionPreference, startSiteLogout } from "@/lib/authSessionPreferences";
import { downloads } from "@/lib/desktopDownloads";
import { getFreshSiteSession } from "@/lib/siteSession";
import { getSubscriptionCountdown, getSubscriptionEndAt, getSubscriptionStatusLabel, isCurrentSubscription } from "@/lib/subscriptionStatus";
import { publicPlanContent, publicPlanList, isPaidPlanId, isPublicPlanId, type PaidPlanId, type PublicPlanId } from "@/lib/subscriptionPlans";
import { HAPPYCASH_AGENDA_SYSTEM_APP_URL, HAPPYCASH_SYSTEM_APP_URL } from "@/lib/systemUrls";
import {
  getPublicPlanIdsForProductContext,
  isCurrentSubscriptionPlanAllowedForProductContext,
  isPaidPlanAllowedForProductContext,
  normalizeProductContext,
  resolveProductContextFromPlanId,
  type ProductContext,
} from "../../../shared/productContext";
import { retryAsync } from "../../../shared/network/retry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo-happycash.webp";

type AuthUser = {
  id: string;
  email?: string | null;
};

type StoreAccountRow = {
  id: string;
  nome_cliente: string | null;
  nome_estabelecimento: string | null;
  email: string | null;
  product_context: ProductContext | null;
};

type SubscriptionPlanRow = {
  id: PublicPlanId;
  name: string;
  description: string | null;
  price: number | null;
  annual_price: number | null;
  duration_days: number | null;
  sort_order: number | null;
};

type StoreSubscriptionRow = {
  id: string;
  plan_id: PublicPlanId;
  status: string;
  billing_type: "PIX" | "CREDIT_CARD" | null;
  provider: string | null;
  provider_payment_id: string | null;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type BillingCustomerRow = {
  provider: string | null;
  provider_customer_id: string | null;
};

type DashboardQueryError = { message: string } | null;

type StoreAccountQueryBuilder = {
  eq(column: string, value: string): StoreAccountQueryBuilder;
  order(column: string, options: { ascending: boolean }): StoreAccountQueryBuilder;
  limit(count: number): StoreAccountQueryBuilder;
  maybeSingle(): Promise<{
    data: StoreAccountRow | null;
    error: DashboardQueryError;
  }>;
};

type DashboardQueryClient = {
  from(table: "store_accounts"): {
    select(columns: string): StoreAccountQueryBuilder;
  };
  from(table: "subscription_plans"): {
    select(columns: string): {
      eq(column: string, value: boolean): {
        eq(column: string, value: boolean): {
          order(column: string, options: { ascending: boolean }): Promise<{
            data: SubscriptionPlanRow[] | null;
            error: DashboardQueryError;
          }>;
        };
      };
    };
  };
  from(table: "store_subscriptions"): {
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string, options: { ascending: boolean }): Promise<{
          data: StoreSubscriptionRow[] | null;
          error: DashboardQueryError;
        }>;
      };
    };
  };
  from(table: "billing_customers"): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{
          data: BillingCustomerRow | null;
          error: DashboardQueryError;
        }>;
      };
    };
  };
};

type CreatePlanChargeResponse = {
  success?: boolean;
  reusedPending?: boolean;
  error?: string;
  code?: string;
  checkout?: {
    paymentMethod: "pix" | "card";
    billingPeriod?: "monthly" | "annual";
    subscriptionId: string;
    planId: PaidPlanId;
    paymentId: string;
    paymentStatus: string;
    value: number;
    dueDate: string;
    invoiceUrl?: string | null;
    copyPasteCode?: string;
    qrCodeBase64?: string;
    qrCodeExpirationDate?: string;
    pixQrCodeUnavailable?: boolean;
    pixQrCodeMessage?: string;
  };
};

type CheckoutPaymentMethod = NonNullable<NonNullable<CreatePlanChargeResponse["checkout"]>["paymentMethod"]>;
type CheckoutBillingPeriod = "monthly" | "annual";
type PlanCheckoutState = NonNullable<CreatePlanChargeResponse["checkout"]>;

type FinalizeSiteRegistrationResponse = {
  success?: boolean;
  alreadyReady?: boolean;
  error?: string;
};

type DeleteAccountResponse = {
  success?: boolean;
  error?: string;
};

type DesktopLicenseKeyResponse = {
  success?: boolean;
  licenseKey?: string;
  storeAccountId?: string;
  companyName?: string;
  planId?: string | null;
  status?: string | null;
  validUntil?: string | null;
  offlineEnabled?: boolean;
  productContext?: ProductContext;
  error?: string;
  code?: string;
};

const SITE_SESSION_EXPIRED_MESSAGE = "Sua sessao expirou. Entre novamente para continuar.";
const DELETE_ACCOUNT_CONFIRM_TEXT = "APAGAR";
const SITE_REGISTRATION_FUNCTION_MISSING_MESSAGE =
  "A funcao finalize-site-registration nao esta publicada ou acessivel neste projeto. Publique a function para abrir o dashboard.";
const SITE_REGISTRATION_FETCH_MESSAGE =
  "Nao foi possivel conectar ao bootstrap da conta. Se o navegador mostrar CORS em localhost, confira se a function finalize-site-registration foi publicada no projeto.";

const formatDateTime = (value?: string | null) => {
  if (!value) return "Sem data";

  const resolvedDate = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);

  return resolvedDate.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));

const resolveSubscriptionPaymentMethod = (billingType?: StoreSubscriptionRow["billing_type"]): CheckoutPaymentMethod =>
  billingType === "CREDIT_CARD" ? "card" : "pix";

const getPaymentMethodLabel = (paymentMethod: CheckoutPaymentMethod) =>
  paymentMethod === "card" ? "Debito / Credito" : "Pix";

const getPlanChargeActionKey = (planId: PaidPlanId, paymentMethod: CheckoutPaymentMethod, billingPeriod: CheckoutBillingPeriod) =>
  `${planId}:${paymentMethod}:${billingPeriod}`;

const getSystemUrlForProductContext = (productContext: ProductContext) => {
  if (productContext === "happycashagenda") return HAPPYCASH_AGENDA_SYSTEM_APP_URL;
  return HAPPYCASH_SYSTEM_APP_URL;
};

const getSystemLabelForProductContext = (productContext: ProductContext) => {
  if (productContext === "happycashagenda") return "Abrir HappyCash Agenda";
  return "Abrir sistema HappyCash";
};

const Dashboard = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [storeAccount, setStoreAccount] = useState<StoreAccountRow | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<StoreSubscriptionRow[]>([]);
  const [billingCustomer, setBillingCustomer] = useState<BillingCustomerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activatingCheckout, setActivatingCheckout] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [planCheckout, setPlanCheckout] = useState<PlanCheckoutState | null>(null);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [deleteAccountEmail, setDeleteAccountEmail] = useState("");
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [desktopLicenseKey, setDesktopLicenseKey] = useState<string | null>(null);
  const [desktopLicenseKeyVisible, setDesktopLicenseKeyVisible] = useState(false);
  const [desktopLicenseKeyLoading, setDesktopLicenseKeyLoading] = useState(false);
  const [desktopLicenseKeyError, setDesktopLicenseKeyError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const selectedPlanId = (() => {
    const value = searchParams.get("plan");
    return isPublicPlanId(value) ? value : null;
  })();
  const selectedBillingPeriod: CheckoutBillingPeriod = searchParams.get("period") === "annual" ? "annual" : "monthly";

  const querySuffix = selectedPlanId
    ? `?plan=${selectedPlanId}${selectedBillingPeriod === "annual" ? "&period=annual" : ""}`
    : selectedBillingPeriod === "annual"
    ? "?period=annual"
    : "";
  const loginHref = `/login${querySuffix}`;

  useEffect(() => {
    if (loading || location.hash !== "#planos") return;

    window.requestAnimationFrame(() => {
      document.getElementById("planos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [loading, location.hash]);

  const clearInvalidSiteSession = async () => {
    await clearSiteLocalSession(supabase);
    setUser(null);
    setStoreAccount(null);
    setPlans([]);
    setSubscriptions([]);
    setBillingCustomer(null);
    setPlanCheckout(null);
    setCheckoutDialogOpen(false);
    setDesktopLicenseKey(null);
    setDesktopLicenseKeyVisible(false);
    setDesktopLicenseKeyError(null);
  };

  const ensureSiteRegistrationReady = async (accessToken: string) => {
    const { data, error } = await retryAsync(
      async () => {
        const response = await supabase.functions.invoke<FinalizeSiteRegistrationResponse>("finalize-site-registration", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: {},
        });

        if (response.error) throw response.error;
        if (!response.data?.success) throw new Error(response.data?.error || "Nao foi possivel finalizar sua conta agora.");
        return response;
      },
      { attempts: 3, delayMs: 800 },
    ).catch((error) => ({ data: null, error }));

    if (error || !data?.success) {
      let functionErrorMessage = data?.error || "Nao foi possivel finalizar sua conta agora.";

      if (error instanceof FunctionsHttpError) {
        if (error.context.status === 404) {
          functionErrorMessage = SITE_REGISTRATION_FUNCTION_MISSING_MESSAGE;
        } else if (error.context.status === 401) {
          functionErrorMessage = SITE_SESSION_EXPIRED_MESSAGE;
        }
        try {
          const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
          functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
        } catch {
          // Keep the status-based fallback defined above.
        }
      } else if (error instanceof FunctionsFetchError) {
        functionErrorMessage = SITE_REGISTRATION_FETCH_MESSAGE;
      } else if (error instanceof FunctionsRelayError) {
        functionErrorMessage = "Nao foi possivel encaminhar a solicitacao de bootstrap da conta.";
      } else if (error instanceof Error && error.message.trim()) {
        functionErrorMessage = error.message;
      }

      throw new Error(functionErrorMessage);
    }
  };

  const loadDashboard = async (userId: string) => {
    const db = supabase as unknown as DashboardQueryClient;
    const selectedProductContext = selectedPlanId ? resolveProductContextFromPlanId(selectedPlanId) : null;
    setRefreshing(true);
    setLoadError(null);

    const [
      { data: storeAccountData, error: storeAccountError },
      { data: plansData, error: plansError },
      { data: subscriptionsData, error: subscriptionsError },
      { data: billingCustomerData, error: billingCustomerError },
    ] = await retryAsync(
      async () => {
        let storeAccountQuery = db
          .from("store_accounts")
          .select("id, nome_cliente, nome_estabelecimento, email, product_context")
          .eq("owner_user_id", userId);

        if (selectedProductContext) {
          storeAccountQuery = storeAccountQuery.eq("product_context", selectedProductContext);
        }

        const responses = await Promise.all([
          storeAccountQuery.order("created_at", { ascending: false }).limit(1).maybeSingle(),
          db.from("subscription_plans").select("id, name, description, price, annual_price, duration_days, sort_order").eq("is_public", true).eq("is_active", true).order("sort_order", { ascending: true }),
          db.from("store_subscriptions").select("id, plan_id, status, billing_type, provider, provider_payment_id, current_period_starts_at, current_period_ends_at, trial_started_at, trial_ends_at, metadata, created_at").eq("owner_user_id", userId).order("created_at", { ascending: false }),
          db.from("billing_customers").select("provider, provider_customer_id").eq("owner_user_id", userId).maybeSingle(),
        ] as const);

        const queryError = responses.find((response) => response.error)?.error;
        if (queryError) throw new Error(queryError.message);
        return responses;
      },
      { attempts: 3, delayMs: 800 },
    ).catch((error) => [
      { data: null, error },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ] as const);

    if (storeAccountError || plansError || subscriptionsError || billingCustomerError) {
      const message =
        storeAccountError?.message ||
        plansError?.message ||
        subscriptionsError?.message ||
        billingCustomerError?.message ||
        "Nao foi possivel carregar sua conta agora.";

      setLoadError(message);
      setRefreshing(false);
      setLoading(false);
      return;
    }

    setStoreAccount((storeAccountData as StoreAccountRow | null) || null);
    setPlans((plansData as SubscriptionPlanRow[] | null) || []);
    setSubscriptions((subscriptionsData as StoreSubscriptionRow[] | null) || []);
    setBillingCustomer((billingCustomerData as BillingCustomerRow | null) || null);
    setRefreshing(false);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      await enforceSiteSessionPreference(supabase);
      const session = await getFreshSiteSession();

      if (!mounted) return;

      if (!session?.user) {
        await clearInvalidSiteSession();
        if (!mounted) return;
        navigate(`/login${querySuffix}`, { replace: true });
        return;
      }

      const authUser: AuthUser = {
        id: session.user.id,
        email: session.user.email,
      };

      setUser(authUser);
      try {
        await ensureSiteRegistrationReady(session.access_token);
      } catch (error) {
        if (error instanceof Error && error.message === SITE_SESSION_EXPIRED_MESSAGE) {
          await clearInvalidSiteSession();
          if (!mounted) return;
          navigate(`/login${querySuffix}`, { replace: true });
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Nao foi possivel preparar sua conta agora.");
        setRefreshing(false);
        setLoading(false);
        return;
      }
      await loadDashboard(authUser.id);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        void (async () => {
          await clearInvalidSiteSession();
          navigate(loginHref, { replace: true });
        })();
        return;
      }

      const authUser: AuthUser = {
        id: session.user.id,
        email: session.user.email,
      };

      setUser(authUser);
      void (async () => {
        try {
          await ensureSiteRegistrationReady(session.access_token);
          await loadDashboard(authUser.id);
        } catch (error) {
          if (error instanceof Error && error.message === SITE_SESSION_EXPIRED_MESSAGE) {
            await clearInvalidSiteSession();
            navigate(`/login${querySuffix}`, { replace: true });
            return;
          }
          setLoadError(error instanceof Error ? error.message : "Nao foi possivel preparar sua conta agora.");
          setRefreshing(false);
          setLoading(false);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loginHref, navigate, querySuffix]);

  const accountProductContext = normalizeProductContext(storeAccount?.product_context);
  const siteProductContext: ProductContext = accountProductContext === "happycashagenda" ? "happycashagenda" : "happycash";
  const productLabel = siteProductContext === "happycashagenda" ? "HappyCash Agenda" : "HappyCash";
  const compatibleSubscriptions = subscriptions.filter((subscription) =>
    isCurrentSubscriptionPlanAllowedForProductContext(siteProductContext, subscription.plan_id),
  );
  const currentSubscription = compatibleSubscriptions.find(isCurrentSubscription) || compatibleSubscriptions[0] || null;
  const currentPlanId = currentSubscription?.plan_id || null;
  const currentPlanContent = currentPlanId ? publicPlanContent[currentPlanId] : null;
  const countdown = getSubscriptionCountdown(currentSubscription);
  const currentDeadline = getSubscriptionEndAt(currentSubscription);
  const isCurrentProPlan = currentPlanId === "pro" && isCurrentSubscription(currentSubscription);
  const hasOfflineDownloads = isCurrentProPlan;
  const pendingSubscription = compatibleSubscriptions.find((subscription) => subscription.status === "pending") || null;
  const pendingPlanId = pendingSubscription && isPaidPlanId(pendingSubscription.plan_id) ? pendingSubscription.plan_id : null;
  const pendingPlanContent = pendingPlanId ? publicPlanContent[pendingPlanId] : null;
  const pendingPaymentMethod = pendingSubscription
    ? resolveSubscriptionPaymentMethod(pendingSubscription.billing_type)
    : null;
  const pendingBillingPeriod: CheckoutBillingPeriod =
    pendingSubscription?.metadata?.checkout_billing_period === "annual" ? "annual" : "monthly";
  const paidPlanIdForSystemTarget = planCheckout?.planId
    ?? pendingPlanId
    ?? (currentPlanId && currentPlanId !== "demo" ? currentPlanId : null);
  const systemProductContext = paidPlanIdForSystemTarget
    ? resolveProductContextFromPlanId(paidPlanIdForSystemTarget)
    : siteProductContext;
  const activeSystemUrl = getSystemUrlForProductContext(systemProductContext);
  const activeSystemLabel = getSystemLabelForProductContext(systemProductContext);
  const offlineAccessLabel = isCurrentProPlan ? "PRO liberado" : "Somente PRO";
  const desktopDownloadsTitle = "Downloads do desktop";
  const desktopDownloadsCtaWindows = "Baixar Windows (.exe)";
  const desktopDownloadsCtaDeb = "Baixar Linux (.deb)";
  const desktopDownloadsCtaAppImage = "Baixar Linux AppImage";
  const mobileDownloadsTitle = "Downloads do mobile";
  const mobileDownloadsCtaAndroid = "Baixar APK Android";
  const mobileDownloadsDescription = "O app mobile do HappyCash fica liberado somente para contas com plano PRO ativo.";

  useEffect(() => {
    setDesktopLicenseKey(null);
    setDesktopLicenseKeyVisible(false);
    setDesktopLicenseKeyLoading(false);
    setDesktopLicenseKeyError(null);
  }, [storeAccount?.id, currentPlanId, hasOfflineDownloads]);

  const allowedPlanIds = new Set(getPublicPlanIdsForProductContext(siteProductContext));
  const sortedPlans = publicPlanList
    .filter((fallbackPlan) => allowedPlanIds.has(fallbackPlan.id))
    .map((fallbackPlan) => {
      const dbPlan = plans.find((plan) => plan.id === fallbackPlan.id);
      return {
        ...fallbackPlan,
        name: dbPlan?.name || fallbackPlan.name,
        description: dbPlan?.description || fallbackPlan.description,
        price: Number(dbPlan?.price ?? fallbackPlan.price),
        annual_price: Number(dbPlan?.annual_price ?? fallbackPlan.price * 10),
        duration_days: Number(dbPlan?.duration_days ?? (fallbackPlan.id === "demo" ? 0 : 30)),
      };
    });

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    startSiteLogout(supabase, loginHref);
  };

  const handleDeleteAccountDialogOpenChange = (open: boolean) => {
    setDeleteAccountDialogOpen(open);

    if (open) {
      setDeleteAccountEmail("");
      setDeleteAccountPassword("");
      setDeleteAccountConfirmation("");
      setDeleteAccountError("");
    } else {
      setDeleteAccountEmail("");
      setDeleteAccountPassword("");
      setDeleteAccountConfirmation("");
      setDeleteAccountError("");
    }
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;

    if (!deleteAccountEmail.trim() || !deleteAccountPassword.trim()) {
      setDeleteAccountError("Informe email e senha da sua conta.");
      return;
    }

    if (deleteAccountConfirmation.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRM_TEXT) {
      setDeleteAccountError("Digite APAGAR para confirmar a exclusao da conta.");
      return;
    }

    setDeletingAccount(true);
    setDeleteAccountError("");

    try {
      const session = await getFreshSiteSession();

      if (!session?.access_token) {
        await clearInvalidSiteSession();
        navigate(`/login${querySuffix}`, { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke<DeleteAccountResponse>("manage-operators", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          action: "delete_account",
          adminEmail: deleteAccountEmail.trim(),
          adminPassword: deleteAccountPassword.trim(),
        },
      });

      if (error || !data?.success) {
        let functionErrorMessage = data?.error || "Nao foi possivel apagar sua conta.";

        if (error instanceof FunctionsHttpError) {
          try {
            const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
            functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
          } catch {
            functionErrorMessage = error.context.status === 401
              ? SITE_SESSION_EXPIRED_MESSAGE
              : functionErrorMessage;
          }
        } else if (error instanceof FunctionsFetchError) {
          functionErrorMessage = "Nao foi possivel conectar ao servico de exclusao da conta.";
        } else if (error instanceof FunctionsRelayError) {
          functionErrorMessage = "Nao foi possivel encaminhar a solicitacao de exclusao da conta.";
        } else if (error instanceof Error && error.message.trim()) {
          functionErrorMessage = error.message;
        }

        throw new Error(functionErrorMessage);
      }

      toast({
        title: "Cadastro apagado",
        description: "Sua conta HappyCash foi removida com sucesso.",
      });
      await clearInvalidSiteSession();
      navigate("/paginainicial", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel apagar sua conta agora.";
      setDeleteAccountError(message);
      toast({
        title: "Erro ao apagar cadastro",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLoadDesktopLicenseKey = async () => {
    if (desktopLicenseKey) {
      setDesktopLicenseKeyVisible((current) => !current);
      return;
    }

    if (desktopLicenseKeyLoading) return;

    setDesktopLicenseKeyLoading(true);
    setDesktopLicenseKeyError(null);

    try {
      const session = await getFreshSiteSession();

      if (!session?.access_token) {
        await clearInvalidSiteSession();
        navigate(`/login${querySuffix}`, { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke<DesktopLicenseKeyResponse>("desktop-license-key", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          productContext: accountProductContext,
        },
      });

      if (error || !data?.success || !data.licenseKey) {
        let functionErrorMessage = data?.error || "Nao foi possivel carregar a chave da empresa agora.";

        if (error instanceof FunctionsHttpError) {
          try {
            const errorPayload = await error.context.clone().json() as DesktopLicenseKeyResponse;
            functionErrorMessage = errorPayload.error || functionErrorMessage;
          } catch {
            functionErrorMessage = error.context.status === 401
              ? SITE_SESSION_EXPIRED_MESSAGE
              : functionErrorMessage;
          }
        } else if (error instanceof FunctionsFetchError) {
          functionErrorMessage = "Nao foi possivel conectar ao servico da chave desktop.";
        } else if (error instanceof FunctionsRelayError) {
          functionErrorMessage = "Nao foi possivel encaminhar a solicitacao da chave desktop.";
        } else if (error instanceof Error && error.message.trim()) {
          functionErrorMessage = error.message;
        }

        throw new Error(functionErrorMessage);
      }

      setDesktopLicenseKey(data.licenseKey);
      setDesktopLicenseKeyVisible(true);
      toast({
        title: "Chave validada",
        description: "A chave da empresa foi liberada para esta conta.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel carregar a chave da empresa agora.";
      setDesktopLicenseKeyError(message);
      toast({
        title: "Erro ao carregar chave",
        description: message,
        variant: "destructive",
      });
      if (error instanceof Error && error.message === SITE_SESSION_EXPIRED_MESSAGE) {
        await clearInvalidSiteSession();
        navigate(`/login${querySuffix}`, { replace: true });
      }
    } finally {
      setDesktopLicenseKeyLoading(false);
    }
  };

  const handleCopyDesktopLicenseKey = async () => {
    if (!desktopLicenseKey) return;

    try {
      await navigator.clipboard.writeText(desktopLicenseKey);
      toast({
        title: "Chave copiada",
        description: "Cole esta chave na ativacao do aplicativo desktop.",
      });
    } catch {
      toast({
        title: "Nao foi possivel copiar",
        description: "Copie a chave manualmente.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!checkoutDialogOpen || !planCheckout || !user?.id) return;

    const intervalId = window.setInterval(() => {
      void loadDashboard(user.id);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checkoutDialogOpen, planCheckout, user?.id]);

  useEffect(() => {
    if (!checkoutDialogOpen || !planCheckout) return;

    if (currentSubscription?.plan_id === planCheckout.planId && isCurrentSubscription(currentSubscription)) {
      const checkoutProductContext = resolveProductContextFromPlanId(planCheckout.planId);
      const checkoutSystemUrl = getSystemUrlForProductContext(checkoutProductContext);
      const checkoutProductLabel = getProductContextLabel(checkoutProductContext);
      const shouldOpenSystemAfterPayment = checkoutProductContext !== "happycash";

      setCheckoutDialogOpen(false);
      setPlanCheckout(null);
      toast({
        title: `${publicPlanContent[planCheckout.planId].name} liberado`,
        description: shouldOpenSystemAfterPayment
          ? `Pagamento confirmado. Vamos abrir o ${checkoutProductLabel}.`
          : "Pagamento confirmado. Seu plano ja esta ativo por 30 dias.",
      });

      if (shouldOpenSystemAfterPayment) {
        window.setTimeout(() => {
          window.location.assign(checkoutSystemUrl);
        }, 600);
      }
    }
  }, [checkoutDialogOpen, currentSubscription, planCheckout, toast]);

  const handleCreatePlanCharge = async (
    planId: PaidPlanId,
    paymentMethod: CheckoutPaymentMethod,
    billingPeriod: CheckoutBillingPeriod = selectedBillingPeriod,
  ) => {
    if (!isPaidPlanAllowedForProductContext(accountProductContext, planId)) {
      toast({
        title: "Plano bloqueado",
        description: `Esta conta foi designada para o ${productLabel} e aceita apenas os planos ${productLabel}.`,
        variant: "destructive",
      });
      return;
    }

    const actionKey = getPlanChargeActionKey(planId, paymentMethod, billingPeriod);
    const paymentMethodLabel = getPaymentMethodLabel(paymentMethod);
    setActivatingCheckout(actionKey);

    try {
      const session = await getFreshSiteSession();

      if (!session?.access_token) {
        await clearInvalidSiteSession();
        navigate(`/login?plan=${planId}`, { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke<CreatePlanChargeResponse>("create-plan-charge", {
        body: { planId, paymentMethod, billingPeriod },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error || !data?.success || !data.checkout) {
        let functionErrorMessage = data?.error || `Nao foi possivel gerar a cobranca de ${paymentMethodLabel}.`;

        if (error instanceof FunctionsHttpError) {
          try {
            const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
            console.error("create-plan-charge returned HTTP error", {
              status: error.context.status,
              errorPayload,
              planId,
              paymentMethod,
            });
            functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
          } catch {
            console.error("create-plan-charge returned HTTP error without JSON payload", {
              status: error.context.status,
              planId,
              paymentMethod,
            });
            functionErrorMessage = error.context.status === 401
              ? SITE_SESSION_EXPIRED_MESSAGE
              : functionErrorMessage;
          }
        } else if (error instanceof FunctionsFetchError) {
          console.error("create-plan-charge fetch error", { error, planId, paymentMethod });
          functionErrorMessage = `Nao foi possivel conectar ao servico de cobranca de ${paymentMethodLabel}.`;
        } else if (error instanceof FunctionsRelayError) {
          console.error("create-plan-charge relay error", { error, planId, paymentMethod });
          functionErrorMessage = `Nao foi possivel encaminhar a solicitacao de cobranca de ${paymentMethodLabel}.`;
        } else if (error instanceof Error && error.message.trim()) {
          console.error("create-plan-charge generic error", { error, planId, paymentMethod });
          functionErrorMessage = error.message;
        }

        throw new Error(functionErrorMessage);
      }

      await loadDashboard(session.user.id);
      setPlanCheckout(data.checkout);
      setCheckoutDialogOpen(true);
      navigate(`/dashboard?plan=${planId}${billingPeriod === "annual" ? "&period=annual" : ""}`, { replace: true });
      toast({
        title: data.reusedPending ? `${paymentMethodLabel} pendente reaberto` : `${paymentMethodLabel} preparado com sucesso`,
        description: paymentMethod === "pix"
          ? data.reusedPending
            ? "Use o mesmo QR Code ou copie o codigo Pix para concluir o pagamento."
            : "Pague o Pix para liberar o plano automaticamente."
          : data.reusedPending
          ? "Abra novamente a fatura para concluir no debito ou credito."
          : "Abra a fatura do Asaas para concluir no debito ou credito.",
      });
    } catch (error) {
      toast({
        title: `Erro ao gerar cobranca de ${paymentMethodLabel}`,
        description: error instanceof Error ? error.message : "Nao foi possivel preparar o pagamento agora.",
        variant: "destructive",
      });
      if (error instanceof Error && error.message === SITE_SESSION_EXPIRED_MESSAGE) {
        await clearInvalidSiteSession();
        navigate(`/login?plan=${planId}`, { replace: true });
      }
    } finally {
      setActivatingCheckout(null);
    }
  };

  const handleCopyPixCode = async () => {
    if (!planCheckout?.copyPasteCode) return;

    try {
      await navigator.clipboard.writeText(planCheckout.copyPasteCode);
      toast({
        title: "Codigo Pix copiado",
        description: "Agora voce pode colar o codigo no app do banco.",
      });
    } catch {
      toast({
        title: "Nao foi possivel copiar",
        description: "Copie o codigo Pix manualmente.",
        variant: "destructive",
      });
    }
  };

  const checkoutContent = planCheckout ? (
    planCheckout.paymentMethod === "pix" ? (
      planCheckout.qrCodeBase64 && planCheckout.copyPasteCode ? (
        <div className="space-y-4 sm:space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:items-start">
            <div className="flex justify-center">
              <div className="w-full max-w-[18rem] space-y-3 rounded-3xl border border-border bg-white p-3 shadow-sm">
                <img
                  src={`data:image/png;base64,${planCheckout.qrCodeBase64}`}
                  alt="QR Code Pix do plano"
                  className="mx-auto aspect-square w-full max-w-[14rem] rounded-2xl object-contain sm:max-w-[15rem]"
                />
                <p className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600 sm:text-xs">
                  Escaneie no banco
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                <p className="text-sm font-semibold">
                  {publicPlanContent[planCheckout.planId].name}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">Valor</p>
                    <p className="mt-1 font-semibold">{formatCurrency(planCheckout.value)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">Forma</p>
                    <p className="mt-1 font-semibold">{getPaymentMethodLabel(planCheckout.paymentMethod)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">Vencimento</p>
                    <p className="mt-1 font-semibold leading-snug">{formatDateTime(planCheckout.dueDate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">Status</p>
                    <p className="mt-1 font-semibold">{planCheckout.paymentStatus}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Depois do pagamento, o plano ativa automaticamente e o painel atualiza sozinho.
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Codigo Pix copia e cola</p>
                <Textarea
                  value={planCheckout.copyPasteCode}
                  readOnly
                  className="min-h-[120px] resize-none break-all bg-muted/30 font-mono text-[11px] sm:text-xs"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="h-11 flex-1 font-semibold" onClick={handleCopyPixCode}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar codigo Pix
                  </Button>
                  {planCheckout.invoiceUrl && (
                    <Button asChild variant="outline" className="h-11 flex-1 font-semibold">
                      <a href={planCheckout.invoiceUrl} target="_blank" rel="noreferrer">
                        Abrir fatura
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Alert className="border-secondary/40 bg-secondary/10">
            <Clock3 className="h-4 w-4" />
            <AlertTitle>Pagamento monitorado automaticamente</AlertTitle>
            <AlertDescription>
              Enquanto este modal estiver aberto, a conta sera atualizada periodicamente para liberar o plano assim que o pagamento for confirmado.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="space-y-4">
          <Alert className="border-primary/30 bg-primary/10">
            <AlertTitle>Pix criado pelo Asaas</AlertTitle>
            <AlertDescription>
              {planCheckout.pixQrCodeMessage
                ? `O QR Code ainda nao ficou disponivel: ${planCheckout.pixQrCodeMessage}`
                : "O QR Code ainda nao ficou disponivel, mas a fatura Pix ja foi criada."}
            </AlertDescription>
          </Alert>
          {planCheckout.invoiceUrl ? (
            <Button asChild className="h-11 w-full font-semibold">
              <a href={planCheckout.invoiceUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir fatura Pix
              </a>
            </Button>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Fatura indisponivel</AlertTitle>
              <AlertDescription>
                O Asaas criou a cobranca, mas nao devolveu a fatura. Tente abrir a cobranca novamente em alguns instantes.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )
    ) : (
      <div className="space-y-5">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
          <p className="text-sm font-semibold">
            {publicPlanContent[planCheckout.planId].name}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">Valor</p>
              <p className="mt-1 font-semibold">{formatCurrency(planCheckout.value)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">Forma</p>
              <p className="mt-1 font-semibold">{getPaymentMethodLabel(planCheckout.paymentMethod)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">Vencimento</p>
              <p className="mt-1 font-semibold leading-snug">{formatDateTime(planCheckout.dueDate)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">Status</p>
              <p className="mt-1 font-semibold">{planCheckout.paymentStatus}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Abra a fatura do Asaas para concluir no debito ou credito. Depois da confirmacao, o plano ativa automaticamente.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-background/70 p-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Fatura hospedada do Asaas</p>
            <p className="text-sm text-muted-foreground">
              A fatura abre em ambiente seguro do Asaas e permite concluir a cobranca no credito ou no debito.
            </p>
          </div>

          {planCheckout.invoiceUrl ? (
            <Button asChild className="h-11 w-full font-semibold">
              <a href={planCheckout.invoiceUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir fatura do cartao
              </a>
            </Button>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Fatura indisponivel</AlertTitle>
              <AlertDescription>
                O Asaas nao devolveu a URL da fatura. Gere a cobranca novamente em alguns instantes.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Alert className="border-secondary/40 bg-secondary/10">
          <Clock3 className="h-4 w-4" />
          <AlertTitle>Pagamento monitorado automaticamente</AlertTitle>
          <AlertDescription>
            Enquanto este modal estiver aberto, a conta sera atualizada periodicamente para liberar o plano assim que o pagamento for confirmado.
          </AlertDescription>
        </Alert>
      </div>
    )
  ) : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando sua conta...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card/80 p-6 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <img src={logo} alt="HappyCash" className="h-12" />
            <div>
              <h1 className="font-heading text-2xl font-bold sm:text-3xl">Central da conta HappyCash</h1>
              <p className="text-sm text-muted-foreground">
                A mesma conta serve no site e no HappyCash. Demo com 3 dias e planos pagos com ciclo de 30 dias.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <a href={activeSystemUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                {activeSystemLabel}
              </a>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/paginainicial">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao site
              </Link>
            </Button>
            <Button variant="outline" onClick={handleLogout} className="gap-2" disabled={loggingOut}>
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              {loggingOut ? "Saindo..." : "Sair"}
            </Button>
          </div>
        </div>

        {selectedPlanId && selectedPlanId !== currentPlanId && (
          <Alert className="border-primary/30 bg-primary/5">
            <Sparkles className="h-4 w-4" />
            <AlertTitle>{publicPlanContent[selectedPlanId].name} selecionado</AlertTitle>
            <AlertDescription>
              {selectedPlanId === "demo"
                ? "Sua demo de 3 dias ja comeca no cadastro."
                : "Esse plano fica liberado por 30 dias. Escolha Pix ou debito / credito logo abaixo."}
            </AlertDescription>
          </Alert>
        )}

        {loadError && (
          <Alert variant="destructive">
            <AlertTitle>Falha ao carregar sua conta</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {!billingCustomer?.provider_customer_id && (
          <Alert className="border-secondary/40 bg-secondary/10">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Cliente de cobranca sera criado na primeira cobranca</AlertTitle>
            <AlertDescription>
              Se esta conta foi criada antes da configuracao do Asaas, o cliente de cobranca sera vinculado automaticamente quando voce gerar a primeira cobranca do plano.
            </AlertDescription>
          </Alert>
        )}

        {pendingSubscription && pendingPlanContent && pendingPaymentMethod && (
          <Alert className="border-primary/30 bg-primary/5">
            {pendingPaymentMethod === "pix" ? <QrCode className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            <AlertTitle>
              Existe uma cobranca de {pendingPaymentMethod === "pix" ? "Pix" : "debito / credito"} pendente para {pendingPlanContent.name}
            </AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                {pendingPaymentMethod === "pix"
                  ? "Abra novamente a cobranca para copiar o codigo Pix, exibir o QR Code ou acompanhar a liberacao automatica do plano."
                  : "Abra novamente a fatura do Asaas para pagar no debito ou credito e acompanhar a liberacao automatica do plano."}
              </p>
              <div>
                <Button
                  className="h-10"
                  onClick={() => handleCreatePlanCharge(pendingPlanId!, pendingPaymentMethod, pendingBillingPeriod)}
                  disabled={activatingCheckout === getPlanChargeActionKey(pendingPlanId!, pendingPaymentMethod, pendingBillingPeriod)}
                >
                  {activatingCheckout === getPlanChargeActionKey(pendingPlanId!, pendingPaymentMethod, pendingBillingPeriod) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {pendingPaymentMethod === "pix" ? "Abrindo Pix..." : "Abrindo fatura..."}
                    </>
                  ) : (
                    pendingPaymentMethod === "pix" ? "Abrir cobranca Pix" : "Abrir fatura do cartao"
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-3xl border-border/70">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={countdown.badgeVariant}>
                  {getSubscriptionStatusLabel(currentSubscription)}
                </Badge>
                {currentPlanContent && (
                  <Badge variant="outline">
                    {currentPlanContent.name}
                  </Badge>
                )}
              </div>
              <div>
                <CardTitle className="text-2xl">Sua conta esta pronta</CardTitle>
                <CardDescription className="mt-2 text-sm">
                  {storeAccount?.nome_estabelecimento || "Estabelecimento"} com acesso pelo email {user.email || storeAccount?.email || "sem email"}.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Responsavel</p>
                  <p className="mt-2 font-semibold">{storeAccount?.nome_cliente || "Nao informado"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Plano atual</p>
                  <p className="mt-2 font-semibold">{currentPlanContent?.name || "Sem plano ativo"}</p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Validade</p>
                  <p className="mt-2 font-semibold">
                    {currentSubscription?.status === "trialing"
                      ? "3 dias"
                      : currentPlanContent?.id
                      ? "30 dias"
                      : "Sem ciclo"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-primary">
                  <Clock3 className="h-4 w-4" />
                  {currentDeadline
                    ? `Valido ate ${formatDateTime(currentDeadline)}`
                    : "Sem vencimento definido"}
                  {countdown.markerLabel && (
                    <Badge variant={countdown.badgeVariant}>{countdown.markerLabel}</Badge>
                  )}
                </div>
                {countdown.remainingLabel && (
                  <p className="mt-2 text-sm text-muted-foreground">{countdown.remainingLabel}</p>
                )}
                <p className="mt-3 text-sm text-muted-foreground">
                  {currentPlanContent?.summary || "Escolha um plano abaixo para liberar seu acesso."}
                </p>
              </div>

              {currentSubscription?.status === "trialing" && (
                <Alert className="border-primary/30 bg-background">
                  <Crown className="h-4 w-4" />
                  <AlertTitle>Depois da demo, escolha um plano pago</AlertTitle>
                  <AlertDescription>
                    Fiado, Completo e PRO ficam ativos por 30 dias cada. Esta conta mostra apenas os planos do ecossistema HappyCash.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-border/70">
            <CardHeader>
              <CardTitle className="text-2xl">Proximo passo</CardTitle>
              <CardDescription>
                Crie a conta, volte ao site quando quiser e escolha o plano e a forma de pagamento no momento da ativacao.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold">Como esta funcionando agora</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>1. O cadastro cria uma conta separada para o {productLabel}.</li>
                  <li>2. A demo libera o ambiente escolhido por 3 dias.</li>
                  <li>3. Os planos pagos exibidos aqui pertencem somente ao {productLabel} e valem 30 dias.</li>
                  <li>4. Assim que o pagamento for confirmado no Asaas, o plano ativa automaticamente.</li>
                </ul>
              </div>

              <>
                  <div className="rounded-2xl border border-border bg-background/70 p-4">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">{desktopDownloadsTitle}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          O executavel fica liberado para contas com plano PRO ativo. Cada nova instalacao pede a chave da empresa, valida o primeiro acesso online, prepara o banco local da loja e os links abaixo sempre consultam a release mais recente para Windows, Linux (.deb) e Linux AppImage.
                        </p>
                      </div>
                      <Badge variant={hasOfflineDownloads ? "default" : "outline"}>
                        {offlineAccessLabel}
                      </Badge>
                    </div>

                    {hasOfflineDownloads ? (
                      <div className="mt-4 grid gap-3">
                        <div className="rounded-2xl border border-border bg-background/70 p-4">
                          <p className="text-sm font-semibold">Como funciona no desktop</p>
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            <li>1. Instale a release mais recente na maquina.</li>
                            <li>2. Valide a chave da empresa no primeiro acesso dessa maquina.</li>
                            <li>3. No primeiro acesso online, entre como administrador, configure usuario/PIN e aguarde o download dos dados locais.</li>
                            <li>4. Depois disso, admin e operadores preparados podem seguir offline por ate 5 dias sem internet.</li>
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex gap-3">
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <KeyRound className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">Chave da empresa</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Disponivel somente para o dono da conta com {offlineAccessLabel.toLowerCase()}.
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 shrink-0 font-semibold"
                              onClick={handleLoadDesktopLicenseKey}
                              disabled={desktopLicenseKeyLoading}
                            >
                              {desktopLicenseKeyLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : desktopLicenseKeyVisible ? (
                                <EyeOff className="mr-2 h-4 w-4" />
                              ) : (
                                <Eye className="mr-2 h-4 w-4" />
                              )}
                              {desktopLicenseKeyVisible ? "Ocultar" : "Mostrar chave"}
                            </Button>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                            <div className="min-h-11 rounded-xl border border-border bg-background px-3 py-3 font-mono text-sm font-semibold text-foreground">
                              {desktopLicenseKey && desktopLicenseKeyVisible ? desktopLicenseKey : "HC-****-****-****"}
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              className="h-11 font-semibold"
                              onClick={handleCopyDesktopLicenseKey}
                              disabled={!desktopLicenseKey}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copiar
                            </Button>
                          </div>

                          {desktopLicenseKeyError ? (
                            <Alert variant="destructive" className="mt-4">
                              <AlertTitle>Nao foi possivel mostrar a chave</AlertTitle>
                              <AlertDescription>{desktopLicenseKeyError}</AlertDescription>
                            </Alert>
                          ) : null}
                        </div>
                        <Button asChild className="h-11 font-semibold">
                          <Link to={downloads.windows.route}>
                            <Download className="mr-2 h-4 w-4" />
                            {desktopDownloadsCtaWindows}
                          </Link>
                        </Button>
                        <Button asChild variant="outline" className="h-11 font-semibold">
                          <Link to={downloads["linux-deb"].route}>
                            {desktopDownloadsCtaDeb}
                          </Link>
                        </Button>
                        <Button asChild variant="outline" className="h-11 font-semibold">
                          <Link to={downloads["linux-appimage"].route}>
                            {desktopDownloadsCtaAppImage}
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Quando o plano PRO estiver ativo, esta area libera a release mais recente do desktop e a ativacao por chave da empresa em cada maquina.
                      </p>
                    )}
                  </div>

                  <div className="mt-6 rounded-3xl border border-border bg-background/70 p-4">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">{mobileDownloadsTitle}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {mobileDownloadsDescription}
                        </p>
                      </div>
                      <Badge variant={hasOfflineDownloads ? "default" : "outline"}>
                        {offlineAccessLabel}
                      </Badge>
                    </div>

                    {hasOfflineDownloads ? (
                      <div className="mt-4 grid gap-3">
                        <Button asChild className="h-11 font-semibold">
                          <Link to={downloads.android.route}>
                            <Download className="mr-2 h-4 w-4" />
                            {mobileDownloadsCtaAndroid}
                          </Link>
                        </Button>
                        <Button asChild variant="outline" className="h-11 font-semibold">
                          <Link to={downloads.ios.route}>
                            Acessar TestFlight iOS
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-muted-foreground">
                        Quando o plano PRO estiver ativo, esta area libera o download do app mobile Android e o acesso ao TestFlight iOS.
                      </p>
                    )}
                  </div>
              </>

              <div className="grid gap-3">
                <Button asChild className="h-12 text-base font-semibold">
                  <a href={activeSystemUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    {activeSystemLabel}
                  </a>
                </Button>
                <Button asChild className="h-12 text-base font-semibold">
                  <a href="/paginainicial#planos">Ver planos no site</a>
                </Button>
                <Button asChild variant="outline" className="h-12 text-base font-semibold">
                  <a href="/login">Entrar novamente com este mesmo email</a>
                </Button>
              </div>

              {refreshing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Atualizando informacoes da conta...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl text-destructive">
              <Trash2 className="h-5 w-5" />
              Zona de risco
            </CardTitle>
            <CardDescription>
              Apague seu cadastro do site e os dados vinculados a esta conta HappyCash.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="gap-2" onClick={() => handleDeleteAccountDialogOpenChange(true)}>
              <Trash2 className="h-4 w-4" />
              Apagar meu cadastro
            </Button>
          </CardContent>
        </Card>

        <div id="planos" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold">Escolha seu plano</h2>
              <p className="text-sm text-muted-foreground">
                Escolha mensal ou anual. Gere o Pix ou abra a fatura de debito / credito e o plano libera sozinho quando o pagamento for confirmado.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <Badge variant="outline">Pix e debito / credito</Badge>
              <div className="grid grid-cols-2 rounded-lg border border-border bg-card p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={selectedBillingPeriod === "monthly" ? "default" : "ghost"}
                  onClick={() => navigate(`/dashboard${selectedPlanId ? `?plan=${selectedPlanId}` : ""}`, { replace: true })}
                >
                  Mensal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={selectedBillingPeriod === "annual" ? "default" : "ghost"}
                  onClick={() => navigate(`/dashboard?${selectedPlanId ? `plan=${selectedPlanId}&` : ""}period=annual`, { replace: true })}
                >
                  Anual
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {sortedPlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isCurrentPaidPlan =
                currentSubscription?.plan_id === plan.id &&
                isCurrentSubscription(currentSubscription) &&
                isPaidPlanId(plan.id);
              const content = publicPlanContent[plan.id];
              const paidPlanId = isPaidPlanId(plan.id) ? plan.id : null;
              const isPaidPlan = Boolean(paidPlanId);
              const displayPrice = selectedBillingPeriod === "annual" && isPaidPlan ? plan.annual_price : plan.price;
              const displayPeriod = selectedBillingPeriod === "annual" && isPaidPlan ? "/ano" : "/30 dias";
              const pixActionKey = paidPlanId ? getPlanChargeActionKey(paidPlanId, "pix", selectedBillingPeriod) : null;
              const cardActionKey = paidPlanId ? getPlanChargeActionKey(paidPlanId, "card", selectedBillingPeriod) : null;
              const isPixLoading = pixActionKey === activatingCheckout;
              const isCardLoading = cardActionKey === activatingCheckout;
              const isPlanActivating = paidPlanId ? Boolean(activatingCheckout?.startsWith(`${paidPlanId}:`)) : false;

              return (
                <Card
                  key={plan.id}
                  className={`rounded-3xl transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : isCurrentPaidPlan
                      ? "border-secondary bg-secondary/10"
                      : "border-border/70"
                  }`}
                >
                  <CardHeader className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant={plan.id === "demo" ? "secondary" : plan.id === "pro" ? "default" : "outline"}>
                        {plan.id === "demo"
                          ? "Demo"
                          : selectedBillingPeriod === "annual"
                          ? "Anual"
                          : plan.id === "pro"
                          ? "Mais valor"
                          : "30 dias"}
                      </Badge>
                      {isCurrentPaidPlan && <Badge variant="outline">Atual</Badge>}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription className="mt-2">{plan.description}</CardDescription>
                    </div>
                    <div>
                      <span className="font-heading text-4xl font-bold">
                        {plan.id === "demo" ? "Gratis" : formatCurrency(displayPrice)}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {plan.id === "demo" ? "/3 dias" : displayPeriod}
                      </span>
                      {selectedBillingPeriod === "annual" && isPaidPlan && (
                        <p className="mt-2 text-xs font-medium text-primary">Plano anual com pagamento direto pelo checkout.</p>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <ul className="space-y-3 text-sm">
                      {content.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                            <Check className="h-3 w-3" />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {plan.id === "demo" ? (
                      <Button variant="secondary" className="h-12 w-full font-semibold" disabled>
                        {currentSubscription?.status === "trialing" ? "Demo ativa agora" : "Plano inicial do cadastro"}
                      </Button>
                    ) : (
                      <div className="grid gap-3">
                        <Button
                          className="h-12 w-full font-semibold"
                          disabled={!paidPlanId || isCurrentPaidPlan || isPlanActivating}
                          onClick={() => paidPlanId && handleCreatePlanCharge(paidPlanId, "pix", selectedBillingPeriod)}
                        >
                          {isPixLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Gerando Pix...
                            </>
                          ) : isCurrentPaidPlan ? (
                            "Plano atual"
                          ) : pendingPlanId === plan.id && pendingPaymentMethod === "pix" ? (
                            "Abrir Pix"
                          ) : (
                            "Pagar com Pix"
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="h-12 w-full font-semibold"
                          disabled={!paidPlanId || isCurrentPaidPlan || isPlanActivating}
                          onClick={() => paidPlanId && handleCreatePlanCharge(paidPlanId, "card", selectedBillingPeriod)}
                        >
                          {isCardLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Abrindo fatura...
                            </>
                          ) : pendingPlanId === plan.id && pendingPaymentMethod === "card" ? (
                            "Abrir debito / credito"
                          ) : (
                            "Debito / Credito"
                          )}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {isMobile ? (
          <Drawer open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
            <DrawerContent>
              <DrawerHeader className="border-b border-border px-4 pb-4 pt-2 text-left">
                <DrawerTitle className="flex items-center gap-2 pr-8">
                  {planCheckout?.paymentMethod === "card" ? <CreditCard className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
                  Pagamento da assinatura
                </DrawerTitle>
              </DrawerHeader>
              <div className="overflow-y-auto px-4 pb-6 pt-3">
                {checkoutContent}
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
            <DialogContent className={`${planCheckout?.paymentMethod === "pix" ? "sm:max-w-2xl" : "sm:max-w-xl"} overflow-hidden p-0`}>
              <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
                <DialogTitle className="flex items-center gap-2 pr-8">
                  {planCheckout?.paymentMethod === "card" ? <CreditCard className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
                  Pagamento da assinatura
                </DialogTitle>
              </DialogHeader>

              <div className="max-h-[calc(100svh-12rem)] overflow-y-auto px-6 pb-6 pt-3">
                {checkoutContent}
              </div>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={deleteAccountDialogOpen} onOpenChange={handleDeleteAccountDialogOpenChange}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Apagar meu cadastro</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Alert variant="destructive">
                <Trash2 className="h-4 w-4" />
                <AlertTitle>Acao irreversivel</AlertTitle>
                <AlertDescription>
                  Seu cadastro, operadores e dados da loja vinculados a esta conta serao apagados. Confirme com o email e a senha da conta logada.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="delete-account-email">Email da conta</Label>
                <Input
                  id="delete-account-email"
                  type="email"
                  value={deleteAccountEmail}
                  onChange={event => setDeleteAccountEmail(event.target.value)}
                  autoComplete="username"
                  placeholder="seu@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-account-password">Senha da conta</Label>
                <Input
                  id="delete-account-password"
                  type="password"
                  value={deleteAccountPassword}
                  onChange={event => setDeleteAccountPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-account-confirmation">Confirmacao final</Label>
                <Input
                  id="delete-account-confirmation"
                  value={deleteAccountConfirmation}
                  onChange={event => setDeleteAccountConfirmation(event.target.value)}
                  placeholder='Digite "APAGAR" para confirmar'
                />
              </div>

              {deleteAccountError && (
                <p className="text-sm font-medium text-destructive">{deleteAccountError}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleDeleteAccountDialogOpenChange(false)}
                disabled={deletingAccount}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleDeleteAccount()}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Apagando...
                  </>
                ) : (
                  "Confirmar e apagar"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Dashboard;

import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  CreditCard,
  Crown,
  Download,
  ExternalLink,
  Loader2,
  LogOut,
  QrCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearSiteLocalSession, enforceSiteSessionPreference } from "@/lib/authSessionPreferences";
import { desktopDownloads } from "@/lib/desktopDownloads";
import { getFreshSiteSession } from "@/lib/siteSession";
import { getSubscriptionCountdown, getSubscriptionEndAt, getSubscriptionStatusLabel, isCurrentSubscription } from "@/lib/subscriptionStatus";
import { publicPlanContent, publicPlanList, isPaidPlanId, isPublicPlanId, type PaidPlanId, type PublicPlanId } from "@/lib/subscriptionPlans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo-happycash.png";

type AuthUser = {
  id: string;
  email?: string | null;
};

type StoreAccountRow = {
  id: string;
  nome_cliente: string | null;
  nome_estabelecimento: string | null;
  email: string | null;
};

type SubscriptionPlanRow = {
  id: PublicPlanId;
  name: string;
  description: string | null;
  price: number | null;
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

type DashboardQueryClient = {
  from(table: "store_accounts"): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{
          data: StoreAccountRow | null;
          error: DashboardQueryError;
        }>;
      };
    };
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
  };
};

type CheckoutPaymentMethod = NonNullable<NonNullable<CreatePlanChargeResponse["checkout"]>["paymentMethod"]>;
type PlanCheckoutState = NonNullable<CreatePlanChargeResponse["checkout"]>;

type FinalizeSiteRegistrationResponse = {
  success?: boolean;
  alreadyReady?: boolean;
  error?: string;
};

const SITE_SESSION_EXPIRED_MESSAGE = "Sua sessao expirou. Entre novamente para continuar.";
const SITE_REGISTRATION_FUNCTION_MISSING_MESSAGE =
  "A funcao finalize-site-registration nao esta publicada ou acessivel neste projeto do Supabase. Publique a function para abrir o dashboard.";
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

const getPlanChargeActionKey = (planId: PaidPlanId, paymentMethod: CheckoutPaymentMethod) =>
  `${planId}:${paymentMethod}`;

const Dashboard = () => {
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
  const navigate = useNavigate();
  const { toast } = useToast();

  const selectedPlanId = (() => {
    const value = searchParams.get("plan");
    return isPublicPlanId(value) ? value : null;
  })();

  const querySuffix = selectedPlanId ? `?plan=${selectedPlanId}` : "";

  const clearInvalidSiteSession = async () => {
    await clearSiteLocalSession(supabase);
    setUser(null);
    setStoreAccount(null);
    setPlans([]);
    setSubscriptions([]);
    setBillingCustomer(null);
    setPlanCheckout(null);
    setCheckoutDialogOpen(false);
  };

  const ensureSiteRegistrationReady = async (accessToken: string) => {
    const { data, error } = await supabase.functions.invoke<FinalizeSiteRegistrationResponse>("finalize-site-registration", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {},
    });

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
    setRefreshing(true);
    setLoadError(null);

    const [
      { data: storeAccountData, error: storeAccountError },
      { data: plansData, error: plansError },
      { data: subscriptionsData, error: subscriptionsError },
      { data: billingCustomerData, error: billingCustomerError },
    ] = await Promise.all([
      db.from("store_accounts").select("id, nome_cliente, nome_estabelecimento, email").eq("owner_user_id", userId).maybeSingle(),
      db.from("subscription_plans").select("id, name, description, price, duration_days, sort_order").eq("is_public", true).eq("is_active", true).order("sort_order", { ascending: true }),
      db.from("store_subscriptions").select("id, plan_id, status, billing_type, provider, provider_payment_id, current_period_starts_at, current_period_ends_at, trial_started_at, trial_ends_at, metadata, created_at").eq("owner_user_id", userId).order("created_at", { ascending: false }),
      db.from("billing_customers").select("provider, provider_customer_id").eq("owner_user_id", userId).maybeSingle(),
    ]);

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
          navigate(`/login${querySuffix}`, { replace: true });
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
  }, [navigate, querySuffix]);

  const currentSubscription = subscriptions.find(isCurrentSubscription) || subscriptions[0] || null;
  const currentPlanId = currentSubscription?.plan_id || null;
  const currentPlanContent = currentPlanId ? publicPlanContent[currentPlanId] : null;
  const countdown = getSubscriptionCountdown(currentSubscription);
  const currentDeadline = getSubscriptionEndAt(currentSubscription);
  const isCurrentProPlan = currentPlanId === "pro" && isCurrentSubscription(currentSubscription);
  const pendingSubscription = subscriptions.find(subscription => subscription.status === "pending") || null;
  const pendingPlanId = pendingSubscription && isPaidPlanId(pendingSubscription.plan_id) ? pendingSubscription.plan_id : null;
  const pendingPlanContent = pendingPlanId ? publicPlanContent[pendingPlanId] : null;
  const pendingPaymentMethod = pendingSubscription
    ? resolveSubscriptionPaymentMethod(pendingSubscription.billing_type)
    : null;

  const sortedPlans = publicPlanList.map((fallbackPlan) => {
    const dbPlan = plans.find((plan) => plan.id === fallbackPlan.id);
    return {
      ...fallbackPlan,
      name: dbPlan?.name || fallbackPlan.name,
      description: dbPlan?.description || fallbackPlan.description,
      price: Number(dbPlan?.price ?? fallbackPlan.price),
      duration_days: Number(dbPlan?.duration_days ?? (fallbackPlan.id === "demo" ? 0 : 30)),
    };
  });

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      await clearSiteLocalSession(supabase);
      navigate(`/login${querySuffix}`, { replace: true });
    } finally {
      setLoggingOut(false);
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
      setCheckoutDialogOpen(false);
      setPlanCheckout(null);
      toast({
        title: `${publicPlanContent[planCheckout.planId].name} liberado`,
        description: "Pagamento confirmado. Seu plano ja esta ativo por 30 dias.",
      });
    }
  }, [checkoutDialogOpen, currentSubscription, planCheckout, toast]);

  const handleCreatePlanCharge = async (planId: PaidPlanId, paymentMethod: CheckoutPaymentMethod) => {
    const actionKey = getPlanChargeActionKey(planId, paymentMethod);
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
        body: { planId, paymentMethod },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error || !data?.success || !data.checkout) {
        let functionErrorMessage = data?.error || `Nao foi possivel gerar a cobranca de ${paymentMethodLabel}.`;

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
          functionErrorMessage = `Nao foi possivel conectar ao servico de cobranca de ${paymentMethodLabel}.`;
        } else if (error instanceof FunctionsRelayError) {
          functionErrorMessage = `Nao foi possivel encaminhar a solicitacao de cobranca de ${paymentMethodLabel}.`;
        } else if (error instanceof Error && error.message.trim()) {
          functionErrorMessage = error.message;
        }

        throw new Error(functionErrorMessage);
      }

      await loadDashboard(session.user.id);
      setPlanCheckout(data.checkout);
      setCheckoutDialogOpen(true);
      navigate(`/dashboard?plan=${planId}`, { replace: true });
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
                A mesma conta serve no site e no sistema HappyCash. Demo com 3 horas e planos pagos com ciclo de 30 dias.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/">
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
                ? "Sua demo de 3 horas ja comeca no cadastro."
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
                  onClick={() => handleCreatePlanCharge(pendingPlanId!, pendingPaymentMethod)}
                  disabled={activatingCheckout === getPlanChargeActionKey(pendingPlanId!, pendingPaymentMethod)}
                >
                  {activatingCheckout === getPlanChargeActionKey(pendingPlanId!, pendingPaymentMethod) ? (
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
              <div className="grid gap-4 md:grid-cols-3">
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
                      ? "3 horas"
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
                    Fiado, Completo e PRO ficam ativos por 30 dias cada. O plano Fiado libera painel, clientes, produtos, excluidos e fiado, sem configuracoes.
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
                  <li>1. O cadastro cria sua conta unica no HappyCash.</li>
                  <li>2. A demo libera tudo por 3 horas.</li>
                  <li>3. Os planos pagos podem ser cobrados por Pix ou debito / credito e valem 30 dias.</li>
                  <li>4. Assim que o pagamento for confirmado no Asaas, o plano ativa automaticamente.</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Downloads do desktop</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      O executavel fica liberado apenas para contas com plano PRO ativo.
                    </p>
                  </div>
                  <Badge variant={isCurrentProPlan ? "default" : "outline"}>
                    {isCurrentProPlan ? "PRO liberado" : "Somente PRO"}
                  </Badge>
                </div>

                {isCurrentProPlan ? (
                  <div className="mt-4 grid gap-3">
                    <Button asChild className="h-11 font-semibold">
                      <Link to={desktopDownloads.windows.route}>
                        <Download className="mr-2 h-4 w-4" />
                        Baixar executavel Windows
                      </Link>
                    </Button>
                    <Button asChild variant="outline" className="h-11 font-semibold">
                      <Link to={desktopDownloads.linux.route}>
                        Baixar AppImage Linux
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Quando o plano PRO estiver ativo, esta area libera o download do app desktop para Windows e Linux.
                  </p>
                )}
              </div>

              <div className="grid gap-3">
                <Button asChild className="h-12 text-base font-semibold">
                  <a href="/#planos">Ver planos no site</a>
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

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold">Escolha seu plano</h2>
              <p className="text-sm text-muted-foreground">
                Todos os planos pagos ficam ativos por 30 dias. Gere o Pix ou abra a fatura de debito / credito e o plano libera sozinho quando o pagamento for confirmado.
              </p>
            </div>
            <Badge variant="outline">Pix e debito / credito</Badge>
          </div>

          <div className="grid gap-5 xl:grid-cols-4">
            {sortedPlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isCurrentPaidPlan =
                currentSubscription?.plan_id === plan.id &&
                isCurrentSubscription(currentSubscription) &&
                isPaidPlanId(plan.id);
              const content = publicPlanContent[plan.id];
              const isPaidPlan = isPaidPlanId(plan.id);
              const pixActionKey = isPaidPlan ? getPlanChargeActionKey(plan.id, "pix") : null;
              const cardActionKey = isPaidPlan ? getPlanChargeActionKey(plan.id, "card") : null;
              const isPixLoading = pixActionKey === activatingCheckout;
              const isCardLoading = cardActionKey === activatingCheckout;
              const isPlanActivating = isPaidPlan && Boolean(activatingCheckout?.startsWith(`${plan.id}:`));

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
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant={plan.id === "demo" ? "secondary" : plan.id === "pro" ? "default" : "outline"}>
                        {plan.id === "demo" ? "Demo" : plan.id === "pro" ? "Mais valor" : "30 dias"}
                      </Badge>
                      {isCurrentPaidPlan && <Badge variant="outline">Atual</Badge>}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription className="mt-2">{plan.description}</CardDescription>
                    </div>
                    <div>
                      <span className="font-heading text-4xl font-bold">
                        {plan.id === "demo" ? "Gratis" : formatCurrency(plan.price)}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {plan.id === "demo" ? "/3 horas" : "/30 dias"}
                      </span>
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
                          disabled={isCurrentPaidPlan || isPlanActivating}
                          onClick={() => handleCreatePlanCharge(plan.id, "pix")}
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
                          disabled={isCurrentPaidPlan || isPlanActivating}
                          onClick={() => handleCreatePlanCharge(plan.id, "card")}
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

        <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
          <DialogContent className={planCheckout?.paymentMethod === "pix" ? "max-w-2xl" : "max-w-xl"}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {planCheckout?.paymentMethod === "card" ? <CreditCard className="h-5 w-5" /> : <QrCode className="h-5 w-5" />}
                Pagamento da assinatura
              </DialogTitle>
            </DialogHeader>

            {planCheckout && (
              planCheckout.paymentMethod === "pix" ? (
                planCheckout.qrCodeBase64 && planCheckout.copyPasteCode ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
                      <div className="flex justify-center">
                        <div className="space-y-3 rounded-3xl border border-border bg-white p-3 shadow-sm">
                          <img
                            src={`data:image/png;base64,${planCheckout.qrCodeBase64}`}
                            alt="QR Code Pix do plano"
                            className="h-44 w-44 rounded-2xl object-contain sm:h-48 sm:w-48"
                          />
                          <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-600">
                            Escaneie no banco
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                          <p className="text-sm font-semibold">
                            {publicPlanContent[planCheckout.planId].name}
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Valor</p>
                              <p className="mt-1 font-semibold">{formatCurrency(planCheckout.value)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Forma</p>
                              <p className="mt-1 font-semibold">{getPaymentMethodLabel(planCheckout.paymentMethod)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vencimento</p>
                              <p className="mt-1 font-semibold">{formatDateTime(planCheckout.dueDate)}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</p>
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
                            className="min-h-[104px] resize-none bg-muted/30 font-mono text-xs"
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
                  <Alert variant="destructive">
                    <AlertTitle>QR Code indisponivel</AlertTitle>
                    <AlertDescription>
                      O Asaas nao devolveu os dados do Pix. Gere a cobranca novamente em alguns instantes.
                    </AlertDescription>
                  </Alert>
                )
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-semibold">
                      {publicPlanContent[planCheckout.planId].name}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Valor</p>
                        <p className="mt-1 font-semibold">{formatCurrency(planCheckout.value)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Forma</p>
                        <p className="mt-1 font-semibold">{getPaymentMethodLabel(planCheckout.paymentMethod)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Vencimento</p>
                        <p className="mt-1 font-semibold">{formatDateTime(planCheckout.dueDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</p>
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
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Dashboard;

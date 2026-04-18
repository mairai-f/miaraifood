import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Clock3,
  Crown,
  Download,
  Loader2,
  LogOut,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { desktopDownloads } from "@/lib/desktopDownloads";
import { getSubscriptionCountdown, getSubscriptionEndAt, getSubscriptionStatusLabel, isCurrentSubscription } from "@/lib/subscriptionStatus";
import { publicPlanContent, publicPlanList, isPaidPlanId, isPublicPlanId, type PaidPlanId, type PublicPlanId } from "@/lib/subscriptionPlans";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  provider: string | null;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
};

type BillingCustomerRow = {
  provider: string | null;
  provider_customer_id: string | null;
};

type ActivatePlanResponse = {
  success?: boolean;
  error?: string;
  subscription?: {
    id: string;
    plan_id: PaidPlanId;
    current_period_ends_at: string;
  };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Sem data";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const formatCurrency = (value?: number | null) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));

const Dashboard = () => {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [storeAccount, setStoreAccount] = useState<StoreAccountRow | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<StoreSubscriptionRow[]>([]);
  const [billingCustomer, setBillingCustomer] = useState<BillingCustomerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activatingPlan, setActivatingPlan] = useState<PaidPlanId | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const selectedPlanId = (() => {
    const value = searchParams.get("plan");
    return isPublicPlanId(value) ? value : null;
  })();

  const querySuffix = selectedPlanId ? `?plan=${selectedPlanId}` : "";

  const loadDashboard = async (userId: string) => {
    const db = supabase as any;
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
      db.from("store_subscriptions").select("id, plan_id, status, provider, current_period_starts_at, current_period_ends_at, trial_started_at, trial_ends_at, created_at").eq("owner_user_id", userId).order("created_at", { ascending: false }),
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
      const { data: { session } } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session?.user) {
        navigate(`/login${querySuffix}`, { replace: true });
        return;
      }

      const authUser: AuthUser = {
        id: session.user.id,
        email: session.user.email,
      };

      setUser(authUser);
      await loadDashboard(authUser.id);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        navigate(`/login${querySuffix}`, { replace: true });
        return;
      }

      const authUser: AuthUser = {
        id: session.user.id,
        email: session.user.email,
      };

      setUser(authUser);
      void loadDashboard(authUser.id);
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
    await supabase.auth.signOut();
    navigate(`/login${querySuffix}`, { replace: true });
  };

  const handleActivatePlan = async (planId: PaidPlanId) => {
    setActivatingPlan(planId);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        navigate(`/login?plan=${planId}`, { replace: true });
        return;
      }

      const { data, error } = await supabase.functions.invoke<ActivatePlanResponse>("activate-plan", {
        body: { planId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Nao foi possivel ativar o plano.");
      }

      await loadDashboard(session.user.id);
      navigate(`/dashboard?plan=${planId}`, { replace: true });
      toast({
        title: `${publicPlanContent[planId].name} ativado`,
        description: `Esse plano fica liberado por 30 dias. A cobranca Pix automatica no Asaas entra na proxima etapa.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao ativar plano",
        description: error instanceof Error ? error.message : "Nao foi possivel ativar o plano agora.",
        variant: "destructive",
      });
    } finally {
      setActivatingPlan(null);
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
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sair
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
                : `Esse plano fica liberado por 30 dias. Voce pode ativar quando quiser logo abaixo.`}
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
            <AlertTitle>Cobranca Pix em preparacao</AlertTitle>
            <AlertDescription>
              Seu acesso ja pode ser organizado aqui. Assim que o Asaas for configurado, o cadastro de cobranca por Pix passa a ser automatico.
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
                Crie a conta, volte ao site quando quiser e escolha o plano certo no momento da ativacao.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border bg-background/70 p-4">
                <p className="text-sm font-semibold">Como esta funcionando agora</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>1. O cadastro cria sua conta unica no HappyCash.</li>
                  <li>2. A demo libera tudo por 3 horas.</li>
                  <li>3. Os planos pagos ficam ativos por 30 dias.</li>
                  <li>4. O Pix automatico pelo Asaas entra na proxima etapa.</li>
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
                      <a href={desktopDownloads.windows.href} target="_blank" rel="noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Baixar executavel Windows
                      </a>
                    </Button>
                    <Button asChild variant="outline" className="h-11 font-semibold">
                      <a href={desktopDownloads.linux.href} target="_blank" rel="noreferrer">
                        Baixar AppImage Linux
                      </a>
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
                Todos os planos pagos ficam ativos por 30 dias. A demo continua com 3 horas.
              </p>
            </div>
            <Badge variant="outline">Pagamento via Pix</Badge>
          </div>

          <div className="grid gap-5 xl:grid-cols-4">
            {sortedPlans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              const isCurrentPaidPlan =
                currentSubscription?.plan_id === plan.id &&
                isCurrentSubscription(currentSubscription) &&
                isPaidPlanId(plan.id);
              const isPaidPlan = isPaidPlanId(plan.id);
              const content = publicPlanContent[plan.id];

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
                      <Button
                        className="h-12 w-full font-semibold"
                        disabled={isCurrentPaidPlan || activatingPlan === plan.id}
                        onClick={() => handleActivatePlan(plan.id)}
                      >
                        {activatingPlan === plan.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Ativando...
                          </>
                        ) : isCurrentPaidPlan ? (
                          "Plano atual"
                        ) : (
                          `Ativar por 30 dias`
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import { useState } from "react";
import { ChevronDown, Loader2, Menu, X } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth-session";
import { startSiteLogout } from "@/lib/authSessionPreferences";
import { useCurrentSubscription } from "@/hooks/use-current-subscription";
import { isCurrentSubscription } from "@/lib/subscriptionStatus";
import { isPublicPlanId, publicPlanContent } from "@/lib/subscriptionPlans";
import { SiteThemeToggle } from "@/components/SiteThemeToggle";
import happyCashLogo from "../../../../src/assets/login/happycash.svg";

const solutionLinks = [
  {
    label: "Gestão e relatórios",
    description: "Painel para acompanhar receita, caixa e decisão.",
    href: "/sistema-de-gestao-de-negocios",
  },
  {
    label: "Controle de fiado",
    description: "Clientes, saldo, cobrança e histórico no mesmo fluxo.",
    href: "/controle-de-fiado",
  },
  {
    label: "Sistema PDV",
    description: "Frente de caixa mais organizada para vender rápido.",
    href: "/sistema-pdv",
  },
  {
    label: "Controle de estoque",
    description: "Entradas, saídas e estoque mínimo com visão clara.",
    href: "/controle-de-estoque",
  },
  {
    label: "HappyCash Agenda",
    description: "Agendamentos, profissionais e clientes em uma agenda online.",
    href: "/happycash-agenda",
  },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuthSession();
  const { subscription, countdown, loading: loadingSubscription } = useCurrentSubscription(user?.id);

  const selectedPlanId = (() => {
    const value = searchParams.get("plan");
    return isPublicPlanId(value) ? value : null;
  })();
  const selectedBillingPeriod = searchParams.get("period") === "annual" ? "annual" : "monthly";
  const selectedPlanQuery = selectedPlanId
    ? `plan=${selectedPlanId}${selectedBillingPeriod === "annual" ? "&period=annual" : ""}`
    : selectedBillingPeriod === "annual"
      ? "period=annual"
      : "";
  const loginHref = selectedPlanQuery ? `/login?${selectedPlanQuery}` : "/login";
  const dashboardHref = selectedPlanQuery ? `/dashboard?${selectedPlanQuery}` : "/dashboard";
  const homeHref = selectedPlanQuery ? `/?${selectedPlanQuery}` : "/";
  const signupHref = selectedPlanQuery ? `/cadastro?${selectedPlanQuery}` : "/cadastro";
  const hasActivePaidPlan = Boolean(
    subscription &&
      subscription.plan_id !== "demo" &&
      isCurrentSubscription(subscription),
  );
  const showTestButton = !isAuthenticated || (!loadingSubscription && !hasActivePaidPlan);
  const demoHref = isAuthenticated ? "/dashboard#planos" : "/cadastro?plan=demo";
  const demoSignupHref = "/cadastro?plan=demo";
  const currentPlanName = subscription?.plan_id && isPublicPlanId(subscription.plan_id)
    ? publicPlanContent[subscription.plan_id].name
    : null;
  const subscriptionMarker = currentPlanName && countdown.markerLabel
    ? `${currentPlanName} • ${countdown.markerLabel}`
    : currentPlanName;
  const isHomePage = location.pathname === "/" || location.pathname === "/index" || location.pathname === "/paginainicial";
  const buildHomeSectionHref = (id: string) => (isHomePage ? `#${id}` : `/#${id}`);
  const headerOutlineButtonClassName = "h-11 rounded-full border-border bg-card px-5 text-primary shadow-none hover:bg-accent hover:text-accent-foreground";
  const headerPrimaryButtonClassName = "h-11 rounded-full bg-[#1f56a5] px-5 font-semibold text-white hover:bg-[#194788]";
  const headerGhostButtonClassName = "h-11 rounded-full px-4 font-semibold text-primary hover:bg-accent hover:text-accent-foreground";

  const mainLinks = [
    { label: "Funcionalidades", href: buildHomeSectionHref("funcionalidades") },
    { label: "Demonstração", to: demoSignupHref },
    { label: "Planos", href: buildHomeSectionHref("planos") },
    { label: "FAQ", href: buildHomeSectionHref("faq") },
  ];

  const handleLogout = () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setMobileOpen(false);
    startSiteLogout(supabase, loginHref);
  };

  const closeMobileMenu = () => {
    setMobileOpen(false);
    setMobileSolutionsOpen(false);
  };

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-3 md:px-5">
      <div className="mx-auto max-w-7xl rounded-[28px] border border-border bg-card/82 shadow-[0_18px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="flex h-[76px] items-center justify-between px-4 sm:px-5 lg:px-6">
          <Link to={homeHref} className="flex h-11 items-center" aria-label="HappyCash">
            <img
              src={happyCashLogo}
              alt="HappyCash"
              className="block h-auto w-[11.75rem] object-contain sm:w-[12.75rem] lg:w-[13.5rem]"
              loading="eager"
              decoding="async"
            />
          </Link>

          <nav className="hidden items-center gap-3 lg:flex">
            <div className="group relative">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Soluções
                <ChevronDown className="h-4 w-4" />
              </button>

              <div className="pointer-events-none absolute left-0 top-[calc(100%+10px)] w-[370px] translate-y-2 rounded-[24px] border border-border bg-card p-3 opacity-0 shadow-[0_24px_60px_rgba(15,23,42,0.14)] transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <div className="grid gap-2">
                  {solutionLinks.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="rounded-[18px] border border-transparent bg-background/70 px-4 py-3 transition-all duration-200 hover:border-primary/20 hover:bg-accent"
                    >
                      <span className="text-sm font-semibold text-foreground">{item.label}</span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">{item.description}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {mainLinks.map((item) => (
              item.to ? (
                <Link
                  key={item.label}
                  to={item.to}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {item.label}
                </a>
              )
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <SiteThemeToggle />
            {isAuthenticated ? (
              <>
                {!loadingSubscription && subscriptionMarker ? (
                  <Badge variant={countdown.badgeVariant} className="max-w-[260px] truncate rounded-full">
                    {subscriptionMarker}
                  </Badge>
                ) : null}
                <span className="hidden max-w-[180px] truncate text-xs font-medium text-muted-foreground xl:block">
                  {user?.email}
                </span>
                <Button asChild variant="outline" size="sm" className={headerOutlineButtonClassName}>
                  <Link to={dashboardHref}>Minha conta</Link>
                </Button>
                {showTestButton ? (
                  <Button asChild className={headerPrimaryButtonClassName}>
                    <Link to={demoHref}>Testar grátis</Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={headerGhostButtonClassName}
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                >
                  {loggingOut ? <Loader2 className="animate-spin" /> : null}
                  {loggingOut ? "Saindo..." : "Sair"}
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" size="sm" className={headerOutlineButtonClassName}>
                  <Link to={loginHref}>Entrar</Link>
                </Button>
                {showTestButton ? (
                  <Button asChild className={headerPrimaryButtonClassName}>
                    <Link to={demoHref}>Testar grátis</Link>
                  </Button>
                ) : null}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <SiteThemeToggle />
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground"
              onClick={() => setMobileOpen((current) => !current)}
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-border px-4 pb-5 pt-4 lg:hidden">
            <div className="grid gap-2">
              <button
                type="button"
                className="flex items-center justify-between rounded-[20px] border border-border bg-background/70 px-4 py-3 text-left text-sm font-semibold text-foreground"
                onClick={() => setMobileSolutionsOpen((current) => !current)}
              >
                Soluções
                <ChevronDown className={`h-4 w-4 transition-transform ${mobileSolutionsOpen ? "rotate-180" : ""}`} />
              </button>

              {mobileSolutionsOpen ? (
                <div className="grid gap-2 rounded-[22px] border border-border bg-card p-3 shadow-[0_18px_48px_rgba(15,23,42,0.10)]">
                  {solutionLinks.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="rounded-[18px] border border-border bg-background/70 px-4 py-3"
                      onClick={closeMobileMenu}
                    >
                      <span className="text-sm font-semibold text-foreground">{item.label}</span>
                      <span className="mt-1 block text-sm leading-6 text-muted-foreground">{item.description}</span>
                    </Link>
                  ))}
                </div>
              ) : null}

              {mainLinks.map((item) => (
                item.to ? (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="rounded-[20px] border border-border bg-background/70 px-4 py-3 text-sm font-semibold text-foreground"
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.href}
                    href={item.href}
                    className="rounded-[20px] border border-border bg-background/70 px-4 py-3 text-sm font-semibold text-foreground"
                    onClick={closeMobileMenu}
                  >
                    {item.label}
                  </a>
                )
              ))}

              <div className="mt-2 grid gap-2">
                {isAuthenticated ? (
                  <>
                    {!loadingSubscription && subscriptionMarker ? (
                      <Badge variant={countdown.badgeVariant} className="w-fit rounded-full">
                        {subscriptionMarker}
                      </Badge>
                    ) : null}
                    <Button asChild variant="outline" className="h-12 rounded-full border-border bg-card text-primary shadow-none hover:bg-accent hover:text-accent-foreground">
                      <Link to={dashboardHref} onClick={closeMobileMenu}>Minha conta</Link>
                    </Button>
                    {showTestButton ? (
                      <Button asChild className="h-12 rounded-full bg-[#1f56a5] font-semibold text-white hover:bg-[#194788]">
                        <Link to={demoHref} onClick={closeMobileMenu}>Testar grátis</Link>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-12 rounded-full font-semibold text-primary hover:bg-accent hover:text-accent-foreground"
                      onClick={() => void handleLogout()}
                      disabled={loggingOut}
                    >
                      {loggingOut ? <Loader2 className="animate-spin" /> : null}
                      {loggingOut ? "Saindo..." : "Sair"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="outline" className="h-12 rounded-full border-border bg-card text-primary shadow-none hover:bg-accent hover:text-accent-foreground">
                      <Link to={loginHref} onClick={closeMobileMenu}>Entrar</Link>
                    </Button>
                    <Button asChild variant="outline" className="h-12 rounded-full border-border bg-card font-semibold text-primary shadow-none hover:bg-accent hover:text-accent-foreground">
                      <Link to={signupHref} onClick={closeMobileMenu}>Criar conta</Link>
                    </Button>
                    {showTestButton ? (
                      <Button asChild className="h-12 rounded-full bg-[#1f56a5] font-semibold text-white hover:bg-[#194788]">
                        <Link to={demoHref} onClick={closeMobileMenu}>Testar grátis</Link>
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default Header;

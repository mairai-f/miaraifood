import { useState, useEffect } from "react";
import { Loader2, Menu, X } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/use-auth-session";
import { startSiteLogout } from "@/lib/authSessionPreferences";
import { useCurrentSubscription } from "@/hooks/use-current-subscription";
import { isCurrentSubscription } from "@/lib/subscriptionStatus";
import { isPublicPlanId, publicPlanContent } from "@/lib/subscriptionPlans";
import logo from "@/assets/logo-happycash.webp";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
  const currentPlanName = subscription?.plan_id && isPublicPlanId(subscription.plan_id)
    ? publicPlanContent[subscription.plan_id].name
    : null;
  const subscriptionMarker = currentPlanName && countdown.markerLabel
    ? `${currentPlanName} • ${countdown.markerLabel}`
    : currentPlanName;
  const isHomePage = location.pathname === "/" || location.pathname === "/index" || location.pathname === "/paginainicial";
  const buildHomeSectionHref = (id: string) => (isHomePage ? `#${id}` : `/#${id}`);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setMobileOpen(false);
    startSiteLogout(supabase, loginHref);
  };

  const links = [
    { label: "Fiado Digital", href: "/caderneta-de-fiado-digital" },
    { label: "Sistema PDV", href: "/sistema-pdv" },
    { label: "HappyCashFood", href: "/happycash-food" },
    { label: "HappyCash Agenda", href: "/happycash-agenda" },
    { label: "Estoque", href: "/controle-de-estoque" },
    { label: "Planos", href: buildHomeSectionHref("planos") },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled 
        ? "bg-background/95 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-background/50" 
        : "bg-transparent"
    }`}>
      <div className="container flex h-20 items-center justify-between">
        <Link to={homeHref} className="flex items-center gap-2 group">
          <img
            src={logo}
            alt="HappyCash"
            className="h-11 w-auto transition-transform duration-300 group-hover:scale-105 md:h-14 lg:h-16"
            width={768}
            height={512}
            loading="eager"
            decoding="async"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6 lg:gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative text-sm font-medium text-muted-foreground transition-colors hover:text-primary after:content-[''] after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-primary after:transition-all after:duration-300 hover:after:w-full"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2 lg:gap-3">
          {isAuthenticated ? (
            <>
              {!loadingSubscription && subscriptionMarker && (
                <Badge variant={countdown.badgeVariant} className="max-w-[260px] truncate">
                  {subscriptionMarker}
                </Badge>
              )}
              <span className="hidden max-w-[180px] truncate text-xs font-medium text-muted-foreground xl:block">
                {user?.email}
              </span>
              <Button asChild variant="outline" size="sm">
                <Link to={dashboardHref}>Minha conta</Link>
              </Button>
              {showTestButton && (
                <Button asChild className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 hover:scale-105">
                  <Link to={demoHref}>Testar grátis</Link>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="font-semibold"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
              >
                {loggingOut ? <Loader2 className="animate-spin" /> : null}
                {loggingOut ? "Saindo..." : "Sair"}
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <Link to={loginHref}>Entrar</Link>
              </Button>
              {showTestButton && (
                <Button asChild className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 hover:scale-105">
                  <Link to={demoHref}>Testar grátis</Link>
                </Button>
              )}
            </>
          )}
        </div>

        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl animate-fade-in">
          <nav className="container flex flex-col gap-4 py-6">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </a>
            ))}
            {isAuthenticated ? (
              <>
                {!loadingSubscription && subscriptionMarker && (
                  <Badge variant={countdown.badgeVariant} className="w-fit">
                    {subscriptionMarker}
                  </Badge>
                )}
                <Button asChild variant="outline" className="w-full">
                  <Link to={dashboardHref} onClick={() => setMobileOpen(false)}>Minha conta</Link>
                </Button>
                {showTestButton && (
                  <Button asChild className="w-full bg-primary text-primary-foreground font-semibold">
                    <Link to={demoHref} onClick={() => setMobileOpen(false)}>Testar grátis</Link>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full font-semibold"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                >
                  {loggingOut ? <Loader2 className="animate-spin" /> : null}
                  {loggingOut ? "Saindo..." : "Sair"}
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" className="w-full">
                  <Link to={loginHref} onClick={() => setMobileOpen(false)}>Entrar</Link>
                </Button>
                <Button asChild variant="outline" className="w-full font-semibold">
                  <Link to={signupHref} onClick={() => setMobileOpen(false)}>Criar conta</Link>
                </Button>
                {showTestButton && (
                  <Button asChild className="w-full bg-primary text-primary-foreground font-semibold">
                    <Link to={demoHref} onClick={() => setMobileOpen(false)}>Testar grátis</Link>
                  </Button>
                )}
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;

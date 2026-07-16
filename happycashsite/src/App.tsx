import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WhatsAppFloatingButton } from "@/components/WhatsAppFloatingButton";
import Index from "./pages/Index.tsx";
import { LocaleProvider } from "../../shared/locale/LocaleContext";

const queryClient = new QueryClient();
const Pix = lazy(() => import("./pages/Pix.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const Cadastro = lazy(() => import("./pages/Cadastro.tsx"));
const AuthCallback = lazy(() => import("./pages/AuthCallback.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const DownloadRedirect = lazy(() => import("./pages/DownloadRedirect.tsx"));
const LogoutSplash = lazy(() => import("./pages/LogoutSplash.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const FiadoDigital = lazy(() => import("./pages/FiadoDigital.tsx"));
const SistemaPdv = lazy(() => import("./pages/SistemaPdv.tsx"));
const SistemaGestaoNegocios = lazy(() => import("./pages/SistemaGestaoNegocios.tsx"));
const ControleEstoque = lazy(() => import("./pages/ControleEstoque.tsx"));
const ControleDeFiado = lazy(() => import("./pages/ControleDeFiado.tsx"));
const SistemaGestaoRh = lazy(() => import("./pages/SistemaGestaoRh.tsx"));
const AppParaFiado = lazy(() => import("./pages/AppParaFiado.tsx"));
const GestaoClientesFiado = lazy(() => import("./pages/GestaoClientesFiado.tsx"));
const ComoControlarFiadoMercadinho = lazy(() => import("./pages/ComoControlarFiadoMercadinho.tsx"));
const PlanilhaFiadoVsApp = lazy(() => import("./pages/PlanilhaFiadoVsApp.tsx"));
const Lgpd = lazy(() => import("./pages/Lgpd.tsx"));
const PoliticaDePrivacidade = lazy(() => import("./pages/PoliticaDePrivacidade.tsx"));
const TermosDeServico = lazy(() => import("./pages/TermosDeServico.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

function ScrollToRouteTop() {
  const { hash, pathname } = useLocation();

  useEffect(() => {
    if (hash) {
      const frame = window.requestAnimationFrame(() => {
        const target = document.getElementById(hash.slice(1));
        target?.scrollIntoView({ block: "start" });
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const scrollToTop = () => window.scrollTo({ left: 0, top: 0 });
    scrollToTop();

    const frame = window.requestAnimationFrame(scrollToTop);
    const firstTimeout = window.setTimeout(scrollToTop, 120);
    const secondTimeout = window.setTimeout(scrollToTop, 350);
    const finalTimeout = window.setTimeout(scrollToTop, 700);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(firstTimeout);
      window.clearTimeout(secondTimeout);
      window.clearTimeout(finalTimeout);
    };
  }, [hash, pathname]);

  return null;
}

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando...</span>
      </div>
    </div>
  );
}

function WhatsAppForRoute() {
  const { pathname } = useLocation();
  const legalPaths = new Set([
    "/lgpd",
    "/politica-de-privacidade",
    "/termos-de-uso",
    "/termos-de-servico",
  ]);

  if (pathname === "/cadastro" || pathname.startsWith("/cadastro/") || legalPaths.has(pathname)) {
    return null;
  }

  return <WhatsAppFloatingButton />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="happycash-site:ui-theme">
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToRouteTop />
            <WhatsAppForRoute />
            <Suspense fallback={<RouteLoader />}>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/index" element={<Index />} />
              <Route path="/paginainicial" element={<Index />} />
              <Route path="/pix" element={<Pix />} />
              <Route path="/login" element={<Login />} />
              <Route path="/saindo" element={<LogoutSplash />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/caderneta-de-fiado-digital" element={<FiadoDigital />} />
              <Route path="/sistema-pdv" element={<SistemaPdv />} />
              <Route path="/sistema-de-gestao" element={<SistemaGestaoNegocios />} />
              <Route path="/sistema-de-gestao-de-negocios" element={<SistemaGestaoNegocios />} />
              <Route path="/sistema-de-gestao-rh" element={<SistemaGestaoRh />} />
              <Route path="/sistema-de-gestao-de-rh" element={<SistemaGestaoRh />} />
              <Route path="/gestao-de-rh" element={<SistemaGestaoRh />} />
              <Route path="/controle-de-estoque" element={<ControleEstoque />} />
              <Route path="/controle-de-fiado" element={<ControleDeFiado />} />
              <Route path="/app-para-fiado" element={<AppParaFiado />} />
              <Route path="/gestao-de-clientes-fiado" element={<GestaoClientesFiado />} />
              <Route path="/blog/como-controlar-fiado-no-mercadinho" element={<ComoControlarFiadoMercadinho />} />
              <Route path="/blog/planilha-de-fiado-vs-app" element={<PlanilhaFiadoVsApp />} />
              <Route path="/lgpd" element={<Lgpd />} />
              <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />
              <Route path="/termos-de-uso" element={<TermosDeServico />} />
              <Route path="/termos-de-servico" element={<TermosDeServico />} />
              <Route path="/downloads/:platform" element={<DownloadRedirect />} />
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </LocaleProvider>
  </ThemeProvider>
);

export default App;

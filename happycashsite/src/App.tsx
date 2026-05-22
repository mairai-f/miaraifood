import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
const ControleEstoque = lazy(() => import("./pages/ControleEstoque.tsx"));
const HappyCashFood = lazy(() => import("./pages/HappyCashFood.tsx"));
const HappyCashAgenda = lazy(() => import("./pages/HappyCashAgenda.tsx"));
const ControleDeFiado = lazy(() => import("./pages/ControleDeFiado.tsx"));
const AppParaFiado = lazy(() => import("./pages/AppParaFiado.tsx"));
const GestaoClientesFiado = lazy(() => import("./pages/GestaoClientesFiado.tsx"));
const ComoControlarFiadoMercadinho = lazy(() => import("./pages/ComoControlarFiadoMercadinho.tsx"));
const PlanilhaFiadoVsApp = lazy(() => import("./pages/PlanilhaFiadoVsApp.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

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

const App = () => (
  <LocaleProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
              <Route path="/controle-de-estoque" element={<ControleEstoque />} />
              <Route path="/happycash-food" element={<HappyCashFood />} />
              <Route path="/happycash-agenda" element={<HappyCashAgenda />} />
              <Route path="/sistema-de-agendamento" element={<HappyCashAgenda />} />
              <Route path="/controle-de-fiado" element={<ControleDeFiado />} />
              <Route path="/app-para-fiado" element={<AppParaFiado />} />
              <Route path="/gestao-de-clientes-fiado" element={<GestaoClientesFiado />} />
              <Route path="/blog/como-controlar-fiado-no-mercadinho" element={<ComoControlarFiadoMercadinho />} />
              <Route path="/blog/planilha-de-fiado-vs-app" element={<PlanilhaFiadoVsApp />} />
              <Route path="/downloads/:platform" element={<DownloadRedirect />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </LocaleProvider>
);

export default App;

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PlanProvider, usePlanAccess } from "@/contexts/PlanContext";
import { DataProvider } from "@/contexts/DataContext";
import { AppLayout } from "@/components/AppLayout";
import { FeatureLocked } from "@/components/FeatureLocked";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Products from "@/pages/Products";
import Rewards from "@/pages/Rewards";
import ClientDetail from "@/pages/ClientDetail";
import DeletedClients from "@/pages/DeletedClients";
import PDV from "@/pages/PDV";
import Reports from "@/pages/Reports";
import Financial from "@/pages/Financial";
import Stock from "@/pages/Stock";
import PricingManager from "@/pages/PricingManager";
import Notes from "@/pages/Notes";
import Settings from "@/pages/Settings";
import AccessMonitor from "@/pages/AccessMonitor";
import { SplashScreen } from "@/components/SplashScreen";
import type { UserRole } from "@/lib/access";
import { LocaleProvider } from "../shared/locale/LocaleContext";

const queryClient = new QueryClient();
const Router = typeof window !== "undefined" && window.location.protocol === "file:" ? HashRouter : BrowserRouter;

function ProtectedRoute({
  children,
  allowedRoles,
  requiredFeature,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredFeature?: string;
}) {
  const { isAuthenticated, loading, role } = useAuth();
  const { loading: planLoading, hasFeature } = usePlanAccess();
  if (loading || planLoading) return <SplashScreen progress={100} />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;
  if (requiredFeature && !hasFeature(requiredFeature)) return <AppLayout><FeatureLocked /></AppLayout>;
  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  const [progress, setProgress] = useState(0);
  const [minimumSplashDone, setMinimumSplashDone] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const stepValues = [25, 50, 75];
    const stepDelay = 420;
    const timerIds: number[] = [];

    stepValues.forEach((stepValue, index) => {
      const timerId = window.setTimeout(() => {
        setProgress((current) => Math.max(current, stepValue));

        if (index === stepValues.length - 1) {
          setMinimumSplashDone(true);
        }
      }, (index + 1) * stepDelay);

      timerIds.push(timerId);
    });

    return () => {
      timerIds.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setProgress(100);
    }
  }, [loading]);

  useEffect(() => {
    if (!loading && minimumSplashDone) {
      const hideTimer = window.setTimeout(() => setShowSplash(false), 260);
      return () => window.clearTimeout(hideTimer);
    }
  }, [loading, minimumSplashDone]);

  if (showSplash) {
    return <SplashScreen progress={progress} />;
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'operator']} requiredFeature="dashboard.view"><Dashboard /></ProtectedRoute>} />
      <Route path="/pdv" element={<ProtectedRoute allowedRoles={['admin', 'operator']} requiredFeature="pdv.use"><PDV /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute allowedRoles={['admin', 'operator']} requiredFeature="clients.manage"><Clients /></ProtectedRoute>} />
      <Route path="/produtos" element={<ProtectedRoute allowedRoles={['admin', 'operator']} requiredFeature="products.manage"><Products /></ProtectedRoute>} />
      <Route path="/estoque" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="stock.manage"><Stock /></ProtectedRoute>} />
      <Route path="/relatorios" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="reports.view"><Reports /></ProtectedRoute>} />
      <Route path="/financeiro" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="financial.manage"><Financial /></ProtectedRoute>} />
      <Route path="/precificacao" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="pricing.manage"><PricingManager /></ProtectedRoute>} />
      <Route path="/notas" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="notes.manage"><Notes /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="settings.manage"><Settings /></ProtectedRoute>} />
      <Route path="/acessos" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="settings.manage"><AccessMonitor /></ProtectedRoute>} />
      <Route path="/recompensas" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="rewards.manage"><Rewards /></ProtectedRoute>} />
      <Route path="/cliente/:clientRef" element={<ProtectedRoute allowedRoles={['admin', 'operator']} requiredFeature="clients.manage"><ClientDetail /></ProtectedRoute>} />
      <Route path="/excluidos" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="deleted.view"><DeletedClients /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

const App = () => (
  <LocaleProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <PlanProvider>
            <DataProvider>
              <Router>
                <AppRoutes />
              </Router>
            </DataProvider>
          </PlanProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </LocaleProvider>
);

export default App;

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";
import { AppLayout } from "@/components/AppLayout";
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
import Settings from "@/pages/Settings";
import { SplashScreen } from "@/components/SplashScreen";
import type { UserRole } from "@/lib/access";

const queryClient = new QueryClient();

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { isAuthenticated, loading, role } = useAuth();
  if (loading) return <SplashScreen progress={100} />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;
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
      <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><Dashboard /></ProtectedRoute>} />
      <Route path="/pdv" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><PDV /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><Clients /></ProtectedRoute>} />
      <Route path="/produtos" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><Products /></ProtectedRoute>} />
      <Route path="/estoque" element={<ProtectedRoute allowedRoles={['admin']}><Stock /></ProtectedRoute>} />
      <Route path="/relatorios" element={<ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>} />
      <Route path="/financeiro" element={<ProtectedRoute allowedRoles={['admin']}><Financial /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />
      <Route path="/recompensas" element={<ProtectedRoute allowedRoles={['admin']}><Rewards /></ProtectedRoute>} />
      <Route path="/cliente/:clientRef" element={<ProtectedRoute allowedRoles={['admin', 'operator']}><ClientDetail /></ProtectedRoute>} />
      <Route path="/excluidos" element={<ProtectedRoute allowedRoles={['admin']}><DeletedClients /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

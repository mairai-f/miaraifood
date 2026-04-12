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
import { SplashScreen } from "@/components/SplashScreen";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <SplashScreen progress={100} />;
  if (!isAuthenticated) return <Navigate to="/login" />;
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
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/pdv" element={<ProtectedRoute><PDV /></ProtectedRoute>} />
      <Route path="/clientes" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
      <Route path="/produtos" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/estoque" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
      <Route path="/relatorios" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/financeiro" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
      <Route path="/recompensas" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
      <Route path="/cliente/:clientRef" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
      <Route path="/excluidos" element={<ProtectedRoute><DeletedClients /></ProtectedRoute>} />
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

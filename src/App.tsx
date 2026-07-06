import { Suspense, lazy, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DesktopRuntimeProvider, useDesktopRuntime } from "@/contexts/DesktopRuntimeContext";
import { PlanProvider, usePlanAccess } from "@/contexts/PlanContext";
import { DesktopActivationScreen } from "@/components/DesktopActivationScreen";
import Login from "@/pages/Login";
import ResetPassword from "@/pages/ResetPassword";
import { SplashScreen } from "@/components/SplashScreen";
import { hasSeenAppSplash, markAppSplashSeen } from "@/lib/appSplash";
import { getDesktopUpdateSplashSummary } from "@/lib/desktopUpdateSplash";
import {
  isDesktopActivationRequired,
  readDesktopActivation,
  type DesktopActivationRecord,
} from "@/lib/desktopActivation";
import {
  checkDesktopUpdates,
  installDesktopUpdate,
  onDesktopUpdateStatus,
  readDesktopUpdateStatus,
  type DesktopUpdateStatus,
} from "@/lib/offlineConcentrator";
import { LocaleProvider } from "../shared/locale/LocaleContext";
import { toast } from "sonner";

const queryClient = new QueryClient();
const Router = typeof window !== "undefined" && window.location.protocol === "file:" ? HashRouter : BrowserRouter;
const AuthenticatedArea = lazy(() => import('@/routes/AuthenticatedArea'));

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Carregando...</span>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, loading, logout } = useAuth();
  const { checking: checkingDesktopLicense, isDesktop } = useDesktopRuntime();
  const { loading: planLoading } = usePlanAccess();
  const [desktopActivation, setDesktopActivation] = useState<DesktopActivationRecord | null>(() => readDesktopActivation());
  const [progress, setProgress] = useState(0);
  const [minimumSplashDone, setMinimumSplashDone] = useState(hasSeenAppSplash());
  const [showSplash, setShowSplash] = useState(!hasSeenAppSplash());
  const [desktopUpdateStatus, setDesktopUpdateStatus] = useState<DesktopUpdateStatus | null>(null);
  const [desktopUpdatePreflightStarted, setDesktopUpdatePreflightStarted] = useState(false);
  const shouldBlockSplash = loading || planLoading || checkingDesktopLicense;
  const requiresDesktopActivation = isDesktop && isDesktopActivationRequired() && !desktopActivation;
  const desktopUpdateSplashSummary = getDesktopUpdateSplashSummary(desktopUpdateStatus);
  const canInstallDesktopUpdateFromSplash = desktopUpdateStatus?.status === "downloaded";

  useEffect(() => {
    if (hasSeenAppSplash()) {
      setProgress(100);
      return;
    }

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
    if (!shouldBlockSplash) {
      setProgress(100);
    }
  }, [shouldBlockSplash]);

  useEffect(() => {
    if (!shouldBlockSplash && minimumSplashDone) {
      const hideTimer = window.setTimeout(() => {
        markAppSplashSeen();
        setShowSplash(false);
      }, 260);
      return () => window.clearTimeout(hideTimer);
    }
  }, [minimumSplashDone, shouldBlockSplash]);

  useEffect(() => {
    setDesktopActivation(readDesktopActivation());
  }, [isAuthenticated, isDesktop]);

  useEffect(() => {
    if (!isDesktop) {
      setDesktopUpdateStatus(null);
      setDesktopUpdatePreflightStarted(false);
      return;
    }

    void readDesktopUpdateStatus()
      .then((status) => {
        setDesktopUpdateStatus(status);
      })
      .catch(() => {
        // Ignore startup update status read failures and keep the normal splash flow.
      });

    return onDesktopUpdateStatus((status) => {
      setDesktopUpdateStatus(status);
    });
  }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop || !showSplash || desktopUpdatePreflightStarted) return;

    setDesktopUpdatePreflightStarted(true);

    void checkDesktopUpdates()
      .then((status) => {
        setDesktopUpdateStatus(status);
      })
      .catch(() => {
        // Keep opening the ERP even if the preflight update check fails.
      });
  }, [desktopUpdatePreflightStarted, isDesktop, showSplash]);

  const handleDesktopActivated = async (activation: DesktopActivationRecord) => {
    if (isAuthenticated) {
      await logout();
    }

    setDesktopActivation(activation);
  };

  const handleInstallDesktopUpdateFromSplash = async () => {
    try {
      const result = await installDesktopUpdate();
      if (!result?.success) {
        toast.error(result?.error || "Nenhuma atualização pronta para instalar.");
      }
    } catch {
      toast.error("Não foi possível iniciar a instalação da atualização.");
    }
  };

  if (showSplash && !isAuthenticated) {
    return (
      <SplashScreen
        progress={progress}
        updateStatus={desktopUpdateSplashSummary}
        updateActionLabel={canInstallDesktopUpdateFromSplash ? "Reiniciar e instalar" : null}
        onUpdateAction={canInstallDesktopUpdateFromSplash ? () => void handleInstallDesktopUpdateFromSplash() : null}
        updateActionDisabled={desktopUpdateStatus?.status === "installing"}
      />
    );
  }

  if (requiresDesktopActivation) {
    return <DesktopActivationScreen onActivated={handleDesktopActivated} />;
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/*"
        element={
          loading
            ? <FullScreenLoader />
            : isAuthenticated
              ? <Suspense fallback={<FullScreenLoader />}><AuthenticatedArea /></Suspense>
              : <Navigate to="/login" replace />
        }
      />
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
          <DesktopRuntimeProvider>
            <PlanProvider>
              <Router>
                <AppRoutes />
              </Router>
            </PlanProvider>
          </DesktopRuntimeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </LocaleProvider>
);

export default App;

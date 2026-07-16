import { Suspense, lazy, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "next-themes";
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
import DesktopTurnstileChallenge from "@/pages/DesktopTurnstileChallenge";
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
  const hasCompletedSplash = !isDesktop && hasSeenAppSplash();
  const [desktopActivation, setDesktopActivation] = useState<DesktopActivationRecord | null>(() => readDesktopActivation());
  const [progress, setProgress] = useState(0);
  const [minimumSplashDone, setMinimumSplashDone] = useState(hasCompletedSplash);
  const [showSplash, setShowSplash] = useState(!hasCompletedSplash);
  const [desktopUpdateStatus, setDesktopUpdateStatus] = useState<DesktopUpdateStatus | null>(null);
  const [desktopUpdatePreflightStarted, setDesktopUpdatePreflightStarted] = useState(false);
  const [desktopUpdatePreflightDone, setDesktopUpdatePreflightDone] = useState(false);
  const [desktopUpdateAutoInstallStarted, setDesktopUpdateAutoInstallStarted] = useState(false);
  const desktopUpdateBlocksSplash = isDesktop && (
    !desktopUpdatePreflightDone
    || desktopUpdateStatus?.status === "checking"
    || desktopUpdateStatus?.status === "downloading"
    || desktopUpdateStatus?.status === "downloaded"
    || desktopUpdateStatus?.status === "installing"
  );
  const shouldBlockSplash = loading || planLoading || checkingDesktopLicense || desktopUpdateBlocksSplash;
  const requiresDesktopActivation = isDesktop && isDesktopActivationRequired() && !desktopActivation;
  const desktopUpdateSplashSummary = getDesktopUpdateSplashSummary(desktopUpdateStatus);

  useEffect(() => {
    if (!isDesktop && hasSeenAppSplash()) {
      setProgress(100);
      return;
    }

    const stepValues = isDesktop ? [15, 32, 52, 72, 88] : [22, 44, 66, 88];
    const stepDelay = isDesktop ? 980 : 620;
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
  }, [isDesktop]);

  useEffect(() => {
    if (!shouldBlockSplash && minimumSplashDone) {
      setProgress(100);
    }
  }, [minimumSplashDone, shouldBlockSplash]);

  useEffect(() => {
    if (!shouldBlockSplash && minimumSplashDone) {
      const hideTimer = window.setTimeout(() => {
        if (!isDesktop) {
          markAppSplashSeen();
        }
        setShowSplash(false);
      }, isDesktop ? 1400 : 820);
      return () => window.clearTimeout(hideTimer);
    }
  }, [isDesktop, minimumSplashDone, shouldBlockSplash]);

  useEffect(() => {
    setDesktopActivation(readDesktopActivation());
  }, [isAuthenticated, isDesktop]);

  useEffect(() => {
    if (!isDesktop) {
      setDesktopUpdateStatus(null);
      setDesktopUpdatePreflightStarted(false);
      setDesktopUpdatePreflightDone(true);
      setDesktopUpdateAutoInstallStarted(false);
      return;
    }

    setDesktopUpdatePreflightDone(false);

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
    setDesktopUpdatePreflightDone(false);

    void checkDesktopUpdates({ autoInstallOnDownloaded: true })
      .then((status) => {
        setDesktopUpdateStatus(status);
      })
      .catch(() => {
        // Keep opening the ERP even if the preflight update check fails.
      })
      .finally(() => {
        setDesktopUpdatePreflightDone(true);
      });
  }, [desktopUpdatePreflightStarted, isDesktop, showSplash]);

  useEffect(() => {
    if (!showSplash || !isDesktop || desktopUpdateStatus?.status !== "downloaded" || desktopUpdateAutoInstallStarted) {
      return;
    }

    setDesktopUpdateAutoInstallStarted(true);

    const timerId = window.setTimeout(() => {
      void installDesktopUpdate()
        .then((result) => {
          if (result?.success) return;

          setDesktopUpdateAutoInstallStarted(false);
          setDesktopUpdateStatus((current) => current ? {
            ...current,
            status: "error",
            error: result?.error || "Não foi possível iniciar a instalação da atualização.",
          } : current);
          toast.error(result?.error || "Não foi possível iniciar a instalação da atualização.");
        })
        .catch(() => {
          setDesktopUpdateAutoInstallStarted(false);
          setDesktopUpdateStatus((current) => current ? {
            ...current,
            status: "error",
            error: "Não foi possível iniciar a instalação da atualização.",
          } : current);
          toast.error("Não foi possível iniciar a instalação da atualização.");
        });
    }, 900);

    return () => window.clearTimeout(timerId);
  }, [desktopUpdateAutoInstallStarted, desktopUpdateStatus?.status, isDesktop, showSplash]);

  const handleDesktopActivated = async (activation: DesktopActivationRecord) => {
    if (isAuthenticated) {
      await logout();
    }

    setDesktopActivation(activation);
  };

  if (showSplash && !isAuthenticated) {
    return (
      <SplashScreen
        progress={progress}
        updateStatus={desktopUpdateSplashSummary}
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

const App = () => {
  if (typeof window !== "undefined" && window.location.pathname === "/desktop-turnstile") {
    return <DesktopTurnstileChallenge />;
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="happycash:ui-theme">
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
    </ThemeProvider>
  );
};

export default App;

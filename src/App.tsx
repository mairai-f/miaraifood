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
import Login from "@/pages/Login";
import { DesktopActivation } from "@/pages/DesktopActivation";
import { SplashScreen } from "@/components/SplashScreen";
import { hasSeenAppSplash, markAppSplashSeen } from "@/lib/appSplash";
import { getDesktopActivationStatus, isDesktopActivationAvailable } from "@/lib/desktopActivation";
import { LocaleProvider } from "../shared/locale/LocaleContext";

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
  const { isAuthenticated, loading } = useAuth();
  const { checking: checkingDesktopLicense } = useDesktopRuntime();
  const { loading: planLoading } = usePlanAccess();
  const [progress, setProgress] = useState(0);
  const [minimumSplashDone, setMinimumSplashDone] = useState(hasSeenAppSplash());
  const [showSplash, setShowSplash] = useState(!hasSeenAppSplash());
  const [desktopActivationChecking, setDesktopActivationChecking] = useState(isDesktopActivationAvailable());
  const [desktopActivated, setDesktopActivated] = useState(!isDesktopActivationAvailable());
  const shouldBlockSplash = loading || planLoading || checkingDesktopLicense;

  useEffect(() => {
    if (!isDesktopActivationAvailable()) {
      setDesktopActivated(true);
      setDesktopActivationChecking(false);
      return;
    }

    let active = true;
    void getDesktopActivationStatus().then((status) => {
      if (!active) return;
      setDesktopActivated(Boolean(status.activated));
      setDesktopActivationChecking(false);
    });

    return () => {
      active = false;
    };
  }, []);

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

  if (desktopActivationChecking) {
    return <FullScreenLoader />;
  }

  if (!desktopActivated) {
    return <DesktopActivation onActivated={() => setDesktopActivated(true)} />;
  }

  if (showSplash && !isAuthenticated) {
    return <SplashScreen progress={progress} />;
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={isAuthenticated ? <Suspense fallback={<FullScreenLoader />}><AuthenticatedArea /></Suspense> : <Login />} />
      <Route path="*" element={<Suspense fallback={<FullScreenLoader />}><AuthenticatedArea /></Suspense>} />
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

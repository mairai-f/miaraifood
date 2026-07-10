import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { AppLayout } from '@/components/AppLayout';
import { DesktopLicenseBlocked } from '@/components/DesktopLicenseBlocked';
import { FeatureLocked } from '@/components/FeatureLocked';
import { GuidedTour } from '@/components/GuidedTour';
import { LowStockNotifier } from '@/components/LowStockNotifier';
import { SplashScreen } from '@/components/SplashScreen';
import { useAuth } from '@/contexts/AuthContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { OperationalScopeProvider } from '@/contexts/OperationalScopeContext';
import { usePermissions } from '@/contexts/usePermissions';
import { DataProvider } from '@/contexts/DataContext';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';
import { usePlanAccess } from '@/contexts/PlanContext';
import { hasSeenAppSplash, markAppSplashSeen } from '@/lib/appSplash';
import { readDesktopActivation } from '@/lib/desktopActivation';
import { canUseDesktopFiscalModule } from '@/lib/fiscalAccess';
import { isRuntimeScopeAllowed, type ErpPermissionKey, type RuntimeScope } from '@/lib/permissions';

const pageLoaders = [
  () => import('@/pages/Dashboard'),
  () => import('@/pages/Clients'),
  () => import('@/pages/Products'),
  () => import('@/pages/Rewards'),
  () => import('@/pages/ClientDetail'),
  () => import('@/pages/DeletedClients'),
  () => import('@/pages/PDV'),
  () => import('@/pages/ServiceTickets'),
  () => import('@/pages/Reports'),
  () => import('@/pages/Financial'),
  () => import('@/pages/Stock'),
  () => import('@/pages/StockMovements'),
  () => import('@/pages/StockAbcCurve'),
  () => import('@/pages/StockPurchaseSuggestions'),
  () => import('@/pages/PricingManager'),
  () => import('@/pages/Operations'),
  () => import('@/pages/Notes'),
  () => import('@/pages/Settings'),
  () => import('@/pages/AccessMonitor'),
  () => import('@/pages/AuditLog'),
];

const [
  loadDashboard,
  loadClients,
  loadProducts,
  loadRewards,
  loadClientDetail,
  loadDeletedClients,
  loadPDV,
  loadServiceTickets,
  loadReports,
  loadFinancial,
  loadStock,
  loadStockMovements,
  loadStockAbcCurve,
  loadStockPurchaseSuggestions,
  loadPricingManager,
  loadOperations,
  loadNotes,
  loadSettings,
  loadAccessMonitor,
  loadAuditLog,
] = pageLoaders;

const Dashboard = lazy(loadDashboard);
const Clients = lazy(loadClients);
const Products = lazy(loadProducts);
const Rewards = lazy(loadRewards);
const ClientDetail = lazy(loadClientDetail);
const DeletedClients = lazy(loadDeletedClients);
const PDV = lazy(loadPDV);
const ServiceTickets = lazy(loadServiceTickets);
const Reports = lazy(loadReports);
const Financial = lazy(loadFinancial);
const Stock = lazy(loadStock);
const StockMovements = lazy(loadStockMovements);
const StockAbcCurve = lazy(loadStockAbcCurve);
const StockPurchaseSuggestions = lazy(loadStockPurchaseSuggestions);
const PricingManager = lazy(loadPricingManager);
const Operations = lazy(loadOperations);
const Notes = lazy(loadNotes);
const Settings = lazy(loadSettings);
const AccessMonitor = lazy(loadAccessMonitor);
const AuditLog = lazy(loadAuditLog);

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

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

function ProtectedRoute({
  children,
  requiredFeature,
  requiredPermission,
  runtimeScope = 'both',
  requiredDesktopFiscalAccess = false,
}: {
  children: ReactNode;
  requiredFeature?: string;
  requiredPermission: ErpPermissionKey;
  runtimeScope?: RuntimeScope;
  requiredDesktopFiscalAccess?: boolean;
}) {
  const { isAuthenticated, loading, role } = useAuth();
  const { loading: permissionsLoading, hasPermission } = usePermissions();
  const { isDesktop, checking: checkingDesktopLicense, licensed } = useDesktopRuntime();
  const { loading: planLoading, hasFeature, planId } = usePlanAccess();
  const shouldBlockDesktopLicense = checkingDesktopLicense && (!isAuthenticated || (isDesktop && !licensed));
  const shouldBlockAccess = loading || planLoading || permissionsLoading || shouldBlockDesktopLicense;
  const shouldShowSplash = !hasSeenAppSplash() && !isAuthenticated;
  const canUseFiscalNotesModule = !requiredDesktopFiscalAccess || canUseDesktopFiscalModule({
    isDesktop,
    licensed,
    planId,
    activation: readDesktopActivation(),
  });

  useEffect(() => {
    if (!shouldBlockAccess) {
      markAppSplashSeen();
    }
  }, [shouldBlockAccess]);

  if (shouldBlockAccess) {
    if (shouldShowSplash) {
      return <SplashScreen progress={100} />;
    }

    return <FullScreenLoader />;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isDesktop && !licensed) return <DesktopLicenseBlocked />;
  if (!isRuntimeScopeAllowed(runtimeScope, isDesktop)) return <Navigate to="/" replace />;
  if (!hasPermission(requiredPermission)) return <Navigate to={role === 'waiter' ? '/comandas' : '/'} replace />;
  if (requiredFeature && !hasFeature(requiredFeature)) return <AppLayout><FeatureLocked /></AppLayout>;
  if (!canUseFiscalNotesModule) return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
}

const desktopWarmPageLoaders = [
  loadDashboard,
  loadClients,
  loadProducts,
  loadPDV,
  loadStock,
  loadFinancial,
];

const webWarmPageLoaders = [
  loadDashboard,
  loadClients,
  loadProducts,
  loadPDV,
];

const warmPageChunks = (isDesktop: boolean) => {
  const runtimeLoaders = isDesktop ? desktopWarmPageLoaders : webWarmPageLoaders;
  const preloadTimers: number[] = [];

  const loadPreferredPages = () => {
    runtimeLoaders.forEach((loader, index) => {
      const timerId = window.setTimeout(() => {
        void loader();
      }, index * 220);
      preloadTimers.push(timerId);
    });
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(loadPreferredPages, { timeout: 3500 });
    return () => {
      window.cancelIdleCallback(idleId);
      preloadTimers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }

  const timeoutId = window.setTimeout(loadPreferredPages, 1200);
  return () => {
    window.clearTimeout(timeoutId);
    preloadTimers.forEach((timerId) => window.clearTimeout(timerId));
  };
};

const AuthenticatedArea = () => {
  const { isDesktop } = useDesktopRuntime();
  useEffect(() => warmPageChunks(isDesktop), [isDesktop]);

  return (
    <PermissionsProvider>
      <OperationalScopeProvider>
        <DataProvider>
          <LowStockNotifier />
          <GuidedTour />
          <Routes>
          <Route path="/" element={<ProtectedRoute requiredPermission="dashboard.view" requiredFeature="dashboard.view"><LazyPage><Dashboard /></LazyPage></ProtectedRoute>} />
          <Route path="/pdv" element={<ProtectedRoute requiredPermission="pdv.use" requiredFeature="pdv.use"><LazyPage><PDV /></LazyPage></ProtectedRoute>} />
          <Route path="/comandas" element={<ProtectedRoute requiredPermission="service_tickets.use" requiredFeature="service_tickets.use"><LazyPage><ServiceTickets /></LazyPage></ProtectedRoute>} />
          <Route path="/clientes" element={<ProtectedRoute requiredPermission="clients.view" requiredFeature="clients.manage"><LazyPage><Clients /></LazyPage></ProtectedRoute>} />
          <Route path="/produtos" element={<ProtectedRoute requiredPermission="products.view" requiredFeature="products.manage"><LazyPage><Products /></LazyPage></ProtectedRoute>} />
          <Route path="/estoque" element={<ProtectedRoute requiredPermission="stock.view" requiredFeature="stock.manage"><LazyPage><Stock /></LazyPage></ProtectedRoute>} />
          <Route path="/estoque/movimentacoes" element={<ProtectedRoute requiredPermission="stock.view" requiredFeature="stock.manage"><LazyPage><StockMovements /></LazyPage></ProtectedRoute>} />
          <Route path="/estoque/curva-abc" element={<ProtectedRoute requiredPermission="stock.view" requiredFeature="stock.manage"><LazyPage><StockAbcCurve /></LazyPage></ProtectedRoute>} />
          <Route path="/estoque/sugestoes-compra" element={<ProtectedRoute requiredPermission="stock.view" requiredFeature="stock.manage"><LazyPage><StockPurchaseSuggestions /></LazyPage></ProtectedRoute>} />
          <Route path="/relatorios" element={<ProtectedRoute requiredPermission="reports.view" requiredFeature="reports.view"><LazyPage><Reports /></LazyPage></ProtectedRoute>} />
          <Route path="/financeiro" element={<ProtectedRoute requiredPermission="financial.view" requiredFeature="financial.manage"><LazyPage><Financial /></LazyPage></ProtectedRoute>} />
          <Route path="/operacoes" element={<ProtectedRoute requiredPermission="purchases.view" requiredFeature="financial.manage"><LazyPage><Operations /></LazyPage></ProtectedRoute>} />
          <Route path="/precificacao" element={<ProtectedRoute requiredPermission="pricing.view" requiredFeature="pricing.manage"><LazyPage><PricingManager /></LazyPage></ProtectedRoute>} />
          <Route path="/notas" element={<ProtectedRoute requiredPermission="fiscal.view" requiredFeature="notes.manage" requiredDesktopFiscalAccess><LazyPage><Notes /></LazyPage></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute requiredPermission="settings.manage" requiredFeature="settings.manage"><LazyPage><Settings /></LazyPage></ProtectedRoute>} />
          <Route path="/configuracoes/:section" element={<ProtectedRoute requiredPermission="settings.manage" requiredFeature="settings.manage"><LazyPage><Settings /></LazyPage></ProtectedRoute>} />
          <Route path="/acessos" element={<ProtectedRoute requiredPermission="access_monitor.view" requiredFeature="settings.manage" runtimeScope="web"><LazyPage><AccessMonitor /></LazyPage></ProtectedRoute>} />
          <Route path="/auditoria" element={<ProtectedRoute requiredPermission="audit.view" requiredFeature="settings.manage" runtimeScope="web"><LazyPage><AuditLog /></LazyPage></ProtectedRoute>} />
          <Route path="/recompensas" element={<ProtectedRoute requiredPermission="rewards.manage" requiredFeature="rewards.manage"><LazyPage><Rewards /></LazyPage></ProtectedRoute>} />
          <Route path="/cliente/:clientRef" element={<ProtectedRoute requiredPermission="clients.view" requiredFeature="clients.manage"><LazyPage><ClientDetail /></LazyPage></ProtectedRoute>} />
          <Route path="/excluidos" element={<ProtectedRoute requiredPermission="deleted.view" requiredFeature="deleted.view"><LazyPage><DeletedClients /></LazyPage></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DataProvider>
      </OperationalScopeProvider>
    </PermissionsProvider>
  );
};

export default AuthenticatedArea;

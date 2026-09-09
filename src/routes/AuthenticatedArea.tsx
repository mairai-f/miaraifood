import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
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
  () => import('@/pages/AuditLog'),
  () => import('@/pages/InternalChat'),
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
  loadAuditLog,
  loadInternalChat,
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
const AuditLog = lazy(loadAuditLog);
const InternalChat = lazy(loadInternalChat);
const FoodTables = lazy(() => import('@/pages/FoodTables'));
const WaiterCalls = lazy(() => import('@/pages/WaiterCalls'));
const WaiterProfile = lazy(() => import('@/pages/WaiterProfile'));
const SettingsTables = lazy(() => import('@/pages/SettingsTables'));
const FoodMenuSettings = lazy(() => import('@/pages/FoodMenuSettings'));
const KdsPage = lazy(() => import('@/pages/KdsPage'));

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
  return (
    <PageErrorBoundary>
      <Suspense fallback={<FullScreenLoader />}>{children}</Suspense>
    </PageErrorBoundary>
  );
}

class PageErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Nao foi possivel renderizar a pagina:', error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const error = this.state.error as Error;

    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="w-full max-w-2xl rounded-2xl border border-rose-500/30 bg-card p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-3 text-rose-500">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center font-bold text-lg">⚠️</div>
            <div>
              <p className="text-base font-extrabold text-foreground">Nao foi possivel abrir esta tela.</p>
              <p className="text-xs text-muted-foreground">Ocorreu uma exceção não capturada no componente da página.</p>
            </div>
          </div>

          <div className="rounded-xl bg-muted/60 p-3.5 border font-mono text-xs text-rose-400 overflow-x-auto max-h-48">
            <p className="font-bold text-rose-300">{error?.name || 'Error'}: {error?.message || String(error)}</p>
            {error?.stack && (
              <pre className="mt-2 text-[11px] opacity-80 whitespace-pre-wrap font-mono leading-relaxed">{error.stack}</pre>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition"
            >
              Recarregar Página
            </button>
            <button
              onClick={() => {
                this.setState({ error: null });
              }}
              className="px-4 py-2 rounded-xl border border-border text-foreground font-bold text-xs hover:bg-muted transition"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const getDefaultAuthenticatedPath = (role: string) => {
  // The waiter starts where the work happens. The same FoodTables page is used;
  // permissions decide which actions (open, order, payment, close) are exposed.
  if (role === 'waiter') return '/acesso';
  if (role === 'admin') return '/';
  return '/acesso';
};

function AccessLanding() {
  const { hasPermission, loading } = usePermissions();
  // A collaborator lands on the first operational screen actually granted by
  // the owner, rather than seeing a plan lock for an unrelated module.
  const destination = [
    ['food.tables.view', '/mesas'],
    ['pdv.use', '/pdv'],
    ['service_tickets.use', '/comandas'],
    ['chat.view', '/conversas'],
    ['clients.view', '/clientes'],
  ].find(([permission]) => hasPermission(permission as ErpPermissionKey))?.[1];
  if (loading) return <FullScreenLoader />;
  return destination ? <Navigate to={destination} replace /> : <AppLayout><FeatureLocked /></AppLayout>;
}

function ProtectedRoute({
  children,
  requiredFeature,
  requiredPermission,
  allowedPermissions = [],
  runtimeScope = 'both',
  requiredDesktopFiscalAccess = false,
}: {
  children: ReactNode;
  requiredFeature?: string;
  requiredPermission: ErpPermissionKey;
  allowedPermissions?: ErpPermissionKey[];
  runtimeScope?: RuntimeScope;
  requiredDesktopFiscalAccess?: boolean;
}) {
  const { isAuthenticated, loading, role } = useAuth();
  const { loading: permissionsLoading, hasPermission } = usePermissions();
  const { isDesktop, isLocalRuntime, checking: checkingDesktopLicense, licensed } = useDesktopRuntime();
  const { loading: planLoading, hasFeature, planId } = usePlanAccess();
  const location = useLocation();
  const shouldBlockDesktopLicense = checkingDesktopLicense && (!isAuthenticated || (isLocalRuntime && !licensed));
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
      return <SplashScreen />;
    }

    return <FullScreenLoader />;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isLocalRuntime && !licensed) return <DesktopLicenseBlocked />;
  const baseFallbackPath = getDefaultAuthenticatedPath(role);
  const fallbackPath = baseFallbackPath;
  if (!isRuntimeScopeAllowed(runtimeScope, isDesktop)) return <Navigate to={fallbackPath} replace />;
  const hasRequiredPermission = hasPermission(requiredPermission) || allowedPermissions.some(permission => hasPermission(permission));
  if (!hasRequiredPermission) {
    if (location.pathname === fallbackPath) return <AppLayout><FeatureLocked /></AppLayout>;
    return <Navigate to={fallbackPath} replace />;
  }
  if (requiredFeature && !hasFeature(requiredFeature)) return <AppLayout><FeatureLocked /></AppLayout>;
  if (!canUseFiscalNotesModule) return <Navigate to={fallbackPath} replace />;
  return <AppLayout>{children}</AppLayout>;
}

const desktopWarmPageLoaders = [
  loadDashboard,
  loadClients,
  loadProducts,
  loadPDV,
  loadStock,
  loadFinancial,
  loadSettings,
];

const webWarmPageLoaders = [
  loadDashboard,
  loadClients,
  loadProducts,
  loadPDV,
  loadStock,
  loadSettings,
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
  const { role } = useAuth();
  useEffect(() => {
    return warmPageChunks(isDesktop);
  }, [isDesktop, role]);

  return (
    <PermissionsProvider>
      <OperationalScopeProvider>
        <DataProvider>
          <LowStockNotifier />
          <GuidedTour />
          <Routes>
          <Route path="/acesso" element={<AccessLanding />} />
          <Route path="/" element={<ProtectedRoute requiredPermission="dashboard.view" requiredFeature="dashboard.view"><LazyPage><Dashboard /></LazyPage></ProtectedRoute>} />
          <Route path="/pdv" element={<ProtectedRoute requiredPermission="pdv.use" requiredFeature="pdv.use"><LazyPage><PDV /></LazyPage></ProtectedRoute>} />
          <Route path="/comandas" element={<ProtectedRoute requiredPermission="service_tickets.use" requiredFeature="service_tickets.use"><LazyPage><ServiceTickets /></LazyPage></ProtectedRoute>} />
          <Route path="/mesas" element={<ProtectedRoute requiredPermission="food.tables.view" requiredFeature="food.tables"><LazyPage><FoodTables /></LazyPage></ProtectedRoute>} />
          <Route path="/chamados" element={<ProtectedRoute requiredPermission="food.waiter_calls.handle" requiredFeature="food.tables"><LazyPage><WaiterCalls /></LazyPage></ProtectedRoute>} />
          <Route path="/garcom/perfil" element={<ProtectedRoute requiredPermission="food.tables.view" requiredFeature="food.tables"><LazyPage><WaiterProfile /></LazyPage></ProtectedRoute>} />
          <Route path="/configuracoes/mesas" element={<ProtectedRoute requiredPermission="food.tables.manage" requiredFeature="food.tables"><LazyPage><SettingsTables /></LazyPage></ProtectedRoute>} />
          <Route path="/kds" element={<ProtectedRoute requiredPermission="food.kds.use" requiredFeature="food.kds"><LazyPage><KdsPage /></LazyPage></ProtectedRoute>} />
          <Route path="/conversas" element={<ProtectedRoute requiredPermission="chat.view" requiredFeature="dashboard.view"><LazyPage><InternalChat /></LazyPage></ProtectedRoute>} />
          <Route path="/configuracoes/qrmenu" element={<ProtectedRoute requiredPermission="food.qrmenu.manage" requiredFeature="food.qrmenu" runtimeScope="web"><LazyPage><FoodMenuSettings /></LazyPage></ProtectedRoute>} />
          <Route path="/clientes" element={<ProtectedRoute requiredPermission="clients.view" requiredFeature="clients.manage"><LazyPage><Clients /></LazyPage></ProtectedRoute>} />
          <Route path="/produtos" element={<ProtectedRoute requiredPermission="products.view" requiredFeature="products.manage"><LazyPage><Products /></LazyPage></ProtectedRoute>} />
          <Route path="/estoque" element={<ProtectedRoute requiredPermission="stock.view" requiredFeature="stock.manage"><LazyPage><Stock /></LazyPage></ProtectedRoute>} />
          <Route path="/estoque/movimentacoes" element={<ProtectedRoute requiredPermission="stock.view" requiredFeature="stock.manage"><LazyPage><StockMovements /></LazyPage></ProtectedRoute>} />
          <Route path="/estoque/curva-abc" element={<ProtectedRoute requiredPermission="stock.view" requiredFeature="stock.manage"><LazyPage><StockAbcCurve /></LazyPage></ProtectedRoute>} />
          <Route path="/estoque/sugestoes-compra" element={<ProtectedRoute requiredPermission="stock.view" requiredFeature="stock.manage"><LazyPage><StockPurchaseSuggestions /></LazyPage></ProtectedRoute>} />
          <Route path="/relatorios" element={<ProtectedRoute requiredPermission="reports.view" requiredFeature="reports.view"><LazyPage><Reports /></LazyPage></ProtectedRoute>} />
          <Route path="/relatorios/:section" element={<ProtectedRoute requiredPermission="reports.view" requiredFeature="reports.view"><LazyPage><Reports /></LazyPage></ProtectedRoute>} />
          <Route path="/financeiro" element={<ProtectedRoute requiredPermission="financial.view" requiredFeature="financial.manage"><LazyPage><Financial /></LazyPage></ProtectedRoute>} />
          <Route path="/operacoes" element={<ProtectedRoute requiredPermission="purchases.view" requiredFeature="financial.manage"><LazyPage><Operations /></LazyPage></ProtectedRoute>} />
          <Route path="/precificacao" element={<ProtectedRoute requiredPermission="pricing.view" requiredFeature="pricing.manage"><LazyPage><PricingManager /></LazyPage></ProtectedRoute>} />
          <Route path="/notas" element={<ProtectedRoute requiredPermission="fiscal.view" requiredFeature="notes.manage" requiredDesktopFiscalAccess><LazyPage><Notes /></LazyPage></ProtectedRoute>} />
          <Route path="/configuracoes" element={<ProtectedRoute requiredPermission="settings.manage" requiredFeature="settings.manage"><LazyPage><Settings /></LazyPage></ProtectedRoute>} />
          <Route path="/configuracoes/colaboradores" element={<ProtectedRoute requiredPermission="staff.manage" allowedPermissions={['settings.manage']} requiredFeature="settings.manage"><LazyPage><Settings /></LazyPage></ProtectedRoute>} />
          <Route path="/configuracoes/:section" element={<ProtectedRoute requiredPermission="settings.manage" requiredFeature="settings.manage"><LazyPage><Settings /></LazyPage></ProtectedRoute>} />
          <Route path="/auditoria" element={<ProtectedRoute requiredPermission="audit.view" requiredFeature="settings.manage" runtimeScope="web"><LazyPage><AuditLog /></LazyPage></ProtectedRoute>} />
          <Route path="/recompensas" element={<ProtectedRoute requiredPermission="rewards.manage" requiredFeature="rewards.manage"><LazyPage><Rewards /></LazyPage></ProtectedRoute>} />
          <Route path="/cliente/:clientRef" element={<ProtectedRoute requiredPermission="clients.view" requiredFeature="clients.manage"><LazyPage><ClientDetail /></LazyPage></ProtectedRoute>} />
          <Route path="/excluidos" element={<ProtectedRoute requiredPermission="deleted.view" requiredFeature="deleted.view"><LazyPage><DeletedClients /></LazyPage></ProtectedRoute>} />
          <Route path="*" element={<Navigate to={getDefaultAuthenticatedPath(role)} replace />} />
          </Routes>
        </DataProvider>
      </OperationalScopeProvider>
    </PermissionsProvider>
  );
};

export default AuthenticatedArea;

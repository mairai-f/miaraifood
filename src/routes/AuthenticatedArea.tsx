import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { AppLayout } from '@/components/AppLayout';
import { GuidedTour } from '@/components/GuidedTour';
import { DesktopLicenseBlocked } from '@/components/DesktopLicenseBlocked';
import { FeatureLocked } from '@/components/FeatureLocked';
import { LowStockNotifier } from '@/components/LowStockNotifier';
import { SplashScreen } from '@/components/SplashScreen';
import { useAuth } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';
import { usePlanAccess } from '@/contexts/PlanContext';
import { hasSeenAppSplash, markAppSplashSeen } from '@/lib/appSplash';
import type { UserRole } from '@/lib/access';

const pageLoaders = [
  () => import('@/pages/Dashboard'),
  () => import('@/pages/Clients'),
  () => import('@/pages/Products'),
  () => import('@/pages/Rewards'),
  () => import('@/pages/ClientDetail'),
  () => import('@/pages/DeletedClients'),
  () => import('@/pages/PDV'),
  () => import('@/pages/Reports'),
  () => import('@/pages/Financial'),
  () => import('@/pages/Stock'),
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
  loadReports,
  loadFinancial,
  loadStock,
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
const Reports = lazy(loadReports);
const Financial = lazy(loadFinancial);
const Stock = lazy(loadStock);
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
  allowedRoles,
  requiredFeature,
}: {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requiredFeature?: string;
}) {
  const { isAuthenticated, loading, role } = useAuth();
  const { isDesktop, checking: checkingDesktopLicense, licensed } = useDesktopRuntime();
  const { loading: planLoading, hasFeature } = usePlanAccess();
  const shouldBlockAccess = loading || planLoading || checkingDesktopLicense;
  const shouldShowSplash = !hasSeenAppSplash() && !isAuthenticated;

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
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" replace />;
  if (requiredFeature && !hasFeature(requiredFeature)) return <AppLayout><FeatureLocked /></AppLayout>;
  return <AppLayout>{children}</AppLayout>;
}

const warmPageChunks = () => {
  const loadAllPages = () => {
    pageLoaders.forEach(loader => {
      void loader();
    });
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const idleId = window.requestIdleCallback(loadAllPages, { timeout: 2500 });
    return () => window.cancelIdleCallback(idleId);
  }

  const timeoutId = window.setTimeout(loadAllPages, 500);
  return () => window.clearTimeout(timeoutId);
};

const AuthenticatedArea = () => {
  useEffect(() => warmPageChunks(), []);

  return (
    <DataProvider>
      <LowStockNotifier />
      <GuidedTour />
      <Routes>
        <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'operator']} requiredFeature="dashboard.view"><LazyPage><Dashboard /></LazyPage></ProtectedRoute>} />
        <Route path="/pdv" element={<ProtectedRoute allowedRoles={['admin', 'operator']} requiredFeature="pdv.use"><LazyPage><PDV /></LazyPage></ProtectedRoute>} />
        <Route path="/clientes" element={<ProtectedRoute allowedRoles={['admin', 'operator']} requiredFeature="clients.manage"><LazyPage><Clients /></LazyPage></ProtectedRoute>} />
        <Route path="/produtos" element={<ProtectedRoute allowedRoles={['admin', 'operator']} requiredFeature="products.manage"><LazyPage><Products /></LazyPage></ProtectedRoute>} />
        <Route path="/estoque" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="stock.manage"><LazyPage><Stock /></LazyPage></ProtectedRoute>} />
        <Route path="/relatorios" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="reports.view"><LazyPage><Reports /></LazyPage></ProtectedRoute>} />
        <Route path="/financeiro" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="financial.manage"><LazyPage><Financial /></LazyPage></ProtectedRoute>} />
        <Route path="/operacoes" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="financial.manage"><LazyPage><Operations /></LazyPage></ProtectedRoute>} />
        <Route path="/precificacao" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="pricing.manage"><LazyPage><PricingManager /></LazyPage></ProtectedRoute>} />
        <Route path="/notas" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="notes.manage"><LazyPage><Notes /></LazyPage></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="settings.manage"><LazyPage><Settings /></LazyPage></ProtectedRoute>} />
        <Route path="/acessos" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="settings.manage"><LazyPage><AccessMonitor /></LazyPage></ProtectedRoute>} />
        <Route path="/auditoria" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="settings.manage"><LazyPage><AuditLog /></LazyPage></ProtectedRoute>} />
        <Route path="/recompensas" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="rewards.manage"><LazyPage><Rewards /></LazyPage></ProtectedRoute>} />
        <Route path="/cliente/:clientRef" element={<ProtectedRoute allowedRoles={['admin', 'operator']} requiredFeature="clients.manage"><LazyPage><ClientDetail /></LazyPage></ProtectedRoute>} />
        <Route path="/excluidos" element={<ProtectedRoute allowedRoles={['admin']} requiredFeature="deleted.view"><LazyPage><DeletedClients /></LazyPage></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DataProvider>
  );
};

export default AuthenticatedArea;

import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { AppLayout } from '@/components/AppLayout';
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

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Clients = lazy(() => import('@/pages/Clients'));
const Products = lazy(() => import('@/pages/Products'));
const Rewards = lazy(() => import('@/pages/Rewards'));
const ClientDetail = lazy(() => import('@/pages/ClientDetail'));
const DeletedClients = lazy(() => import('@/pages/DeletedClients'));
const PDV = lazy(() => import('@/pages/PDV'));
const Reports = lazy(() => import('@/pages/Reports'));
const Financial = lazy(() => import('@/pages/Financial'));
const Stock = lazy(() => import('@/pages/Stock'));
const PricingManager = lazy(() => import('@/pages/PricingManager'));
const Operations = lazy(() => import('@/pages/Operations'));
const Notes = lazy(() => import('@/pages/Notes'));
const Settings = lazy(() => import('@/pages/Settings'));
const AccessMonitor = lazy(() => import('@/pages/AccessMonitor'));
const AuditLog = lazy(() => import('@/pages/AuditLog'));

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
  return <Suspense fallback={<FullScreenLoader />}>{children}</Suspense>;
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

const AuthenticatedArea = () => (
  <DataProvider>
    <LowStockNotifier />
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

export default AuthenticatedArea;

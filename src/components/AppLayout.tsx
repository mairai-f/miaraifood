import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock3, Home, Users, Package, LogOut, Menu, X, UserCircle, Receipt, Boxes, ChevronDown, ChevronUp, Settings, Database, Loader2, WifiOff, ClipboardList, HelpCircle, MapPin, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';
import { usePermissions } from '@/contexts/usePermissions';
import { useOperationalScope } from '@/contexts/useOperationalScope';
import { usePlanAccess } from '@/contexts/PlanContext';
import happyCashLogo from '@/assets/login/happycash.webp';
import { roleLabel } from '@/lib/access';
import { readDesktopActivation } from '@/lib/desktopActivation';
import { isGuidedTourEligiblePlan, requestGuidedTourStart } from '@/lib/guidedTour';
import { isRuntimeScopeAllowed, type ErpPermissionKey, type RuntimeScope } from '@/lib/permissions';
import { hasOfflineAdminAccess, saveOfflineAdminAccess } from '@/lib/offlineAdminAccess';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DesktopOfflineAdminSetupDialog } from '@/components/DesktopOfflineAdminSetupDialog';
import { ThemeModeToggle } from '@/components/ThemeModeToggle';
import { getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';
import { readScopedCashSession } from '@/lib/cashSessionStorage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NavigationItem {
  path: string;
  label: string;
  icon: typeof Home;
  featureKey: string;
  permissionKey: ErpPermissionKey;
  runtimeScope: RuntimeScope;
  tourId: string;
  shortcut?: string;
}

// featureKey controla o plano contratado; permissionKey controla o colaborador.
// runtimeScope evita oferecer e pre-carregar administracao Web no Electron.
const navItems: NavigationItem[] = [
  { path: '/', label: 'Painel', icon: Home, shortcut: '1', featureKey: 'dashboard.view', permissionKey: 'dashboard.view', runtimeScope: 'both', tourId: 'nav-dashboard' },
  { path: '/pdv', label: 'PDV', icon: Receipt, shortcut: '2', featureKey: 'pdv.use', permissionKey: 'pdv.use', runtimeScope: 'both', tourId: 'nav-pdv' },
  { path: '/comandas', label: 'Comandas', icon: ClipboardList, shortcut: '3', featureKey: 'service_tickets.use', permissionKey: 'service_tickets.use', runtimeScope: 'both', tourId: 'nav-service-tickets' },
  { path: '/clientes', label: 'Clientes', icon: Users, shortcut: '4', featureKey: 'clients.manage', permissionKey: 'clients.view', runtimeScope: 'both', tourId: 'nav-clients' },
  { path: '/produtos', label: 'Produtos', icon: Package, shortcut: '5', featureKey: 'products.manage', permissionKey: 'products.view', runtimeScope: 'both', tourId: 'nav-products' },
  { path: '/estoque', label: 'Estoque', icon: Boxes, shortcut: '6', featureKey: 'stock.manage', permissionKey: 'stock.view', runtimeScope: 'both', tourId: 'nav-stock' },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, shortcut: '7', featureKey: 'settings.manage', permissionKey: 'settings.manage', runtimeScope: 'both', tourId: 'nav-settings' },
];

const centralAdministrativePaths = new Set([
  '/financeiro', '/relatorios', '/operacoes', '/notas', '/acessos', '/auditoria',
  '/recompensas', '/precificacao', '/excluidos',
]);

const OFFLINE_VALIDATION_GRACE_DAYS = 5;
const OFFLINE_VALIDATION_GRACE_MS = OFFLINE_VALIDATION_GRACE_DAYS * 24 * 60 * 60 * 1000;
const OFFLINE_VALIDATION_REMINDER_HOURS = 5;
const OFFLINE_VALIDATION_REMINDER_MS = OFFLINE_VALIDATION_REMINDER_HOURS * 60 * 60 * 1000;

const offlineValidationCacheKey = (userId: string) => `happycash:desktop:offline-validation:${userId}`;
const offlineValidationReminderKey = (userId: string, expiresAt: string) =>
  `happycash:desktop:offline-validation-reminder:${userId}:${expiresAt}`;

const readOfflineValidationStartedAt = (userId: string) => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(offlineValidationCacheKey(userId));
};

const writeOfflineValidationStartedAt = (userId: string, value: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(offlineValidationCacheKey(userId), value);
};

const parseTimestamp = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const buildOfflineValidationExpiresAt = (startedAt: string | null, planValidUntil: string | null) => {
  const startedAtMs = parseTimestamp(startedAt);
  if (!startedAtMs) return null;

  const offlineLimitMs = startedAtMs + OFFLINE_VALIDATION_GRACE_MS;
  const planValidUntilMs = parseTimestamp(planValidUntil);
  const expiresAtMs = planValidUntilMs ? Math.min(offlineLimitMs, planValidUntilMs) : offlineLimitMs;
  return new Date(expiresAtMs).toISOString();
};

const formatRemainingTime = (remainingMs: number) => {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);

  return parts.slice(0, 2).join(' ');
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { logout, user, username, role, ownerUserId, session, isLocalOfflineSession, refreshProfile } = useAuth();
  const {
    offlinePreparationStatus,
    offlinePreparationMessage,
    offlineSnapshotUpdatedAt,
    refetch,
    syncNow,
  } = useData();
  const {
    isDesktop,
    licensed: desktopLicensed,
    refresh: refreshDesktopLicense,
    validUntil: desktopValidUntil,
    validationExpiresAt: desktopValidationExpiresAt,
    usingOfflineValidationCache,
  } = useDesktopRuntime();
  const { hasPermission } = usePermissions();
  const {
    loading: operationalScopeLoading,
    scope: operationalScope,
    locations: operationalLocations,
    terminals: operationalTerminals,
    selectWebScope,
  } = useOperationalScope();
  const { hasFeature, planId } = usePlanAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [offlineAdminSetupOpen, setOfflineAdminSetupOpen] = useState(false);
  const [savingOfflineAdminSetup, setSavingOfflineAdminSetup] = useState(false);
  const [offlineReminderOpen, setOfflineReminderOpen] = useState(false);
  const [offlineValidationStartedAt, setOfflineValidationStartedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [syncingNow, setSyncingNow] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  const [scrollHints, setScrollHints] = useState({ top: false, bottom: false });
  const isPdvMode = location.pathname === '/pdv';
  const showCentralBackButton = role !== 'hr' && (
    location.pathname.startsWith('/configuracoes/')
    || centralAdministrativePaths.has(location.pathname)
  );
  const desktopActivation = readDesktopActivation();
  const visibleNavItems = navItems.filter(item => {
    if (!hasPermission(item.permissionKey) || !hasFeature(item.featureKey)) return false;
    if (!isRuntimeScopeAllowed(item.runtimeScope, isDesktop)) return false;
    return true;
  });
  const canOpenSettings = role !== 'hr' && hasPermission('settings.manage') && hasFeature('settings.manage');
  const canUseGuidedTour = role !== 'hr' && isGuidedTourEligiblePlan(planId);
  const hasOpenLocalCashSession = Boolean(
    ownerUserId && user?.id && readScopedCashSession(ownerUserId, user.id),
  );
  const terminalsForCurrentLocation = operationalScope
    ? operationalTerminals.filter((terminal) => terminal.locationId === operationalScope.location.id)
    : [];
  const fallbackValidationStartedAt = user?.id ? readOfflineValidationStartedAt(user.id) : null;
  const offlineValidationExpiresAt = desktopValidationExpiresAt
    || buildOfflineValidationExpiresAt(offlineValidationStartedAt || fallbackValidationStartedAt, desktopValidUntil);
  const offlineValidationExpiresAtMs = parseTimestamp(offlineValidationExpiresAt);
  const offlineValidationRemainingMs = offlineValidationExpiresAtMs ? offlineValidationExpiresAtMs - Date.now() : null;
  const offlineValidationExpired = Boolean(
    isDesktop
    && usingOfflineValidationCache
    && offlineValidationRemainingMs !== null
    && offlineValidationRemainingMs <= 0
  );
  const shouldShowOfflineReminder = Boolean(
    isDesktop
    && usingOfflineValidationCache
    && offlineValidationRemainingMs !== null
    && offlineValidationRemainingMs > 0
    && offlineValidationRemainingMs <= OFFLINE_VALIDATION_REMINDER_MS
  );
  const isOfflinePreparationRelevant = isDesktop && offlinePreparationStatus !== 'unavailable';
  const shouldBlockMissingOfflineSnapshot = Boolean(
    isDesktop
    && isLocalOfflineSession
    && !isOnline
    && (offlinePreparationStatus === 'not-ready' || offlinePreparationStatus === 'error')
  );
  const shouldShowOfflinePreparationBanner = Boolean(
    isOfflinePreparationRelevant
    && !shouldBlockMissingOfflineSnapshot
    && (
      offlinePreparationStatus === 'preparing'
      || offlinePreparationStatus === 'error'
      || offlinePreparationStatus === 'not-ready'
    )
  );

  useEffect(() => {
    const syncNetworkStatus = () => setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine);

    window.addEventListener('online', syncNetworkStatus);
    window.addEventListener('offline', syncNetworkStatus);

    return () => {
      window.removeEventListener('online', syncNetworkStatus);
      window.removeEventListener('offline', syncNetworkStatus);
    };
  }, []);

  const handleAccountClick = () => {
    if (!canOpenSettings) return;
    setOpen(false);
    navigate('/configuracoes');
  };

  const handleGlobalSync = useCallback(async () => {
    if (syncingNow) return;

    setSyncingNow(true);

    try {
      await syncNow();
      toast.success(isDesktop ? 'Desktop e web atualizados.' : 'Dados atualizados.');
    } catch (error) {
      console.warn('Sincronizacao manual nao concluiu agora; mantendo os dados atuais:', getRedactedLogValue(error));
      toast.warning('Sincronização ficou pendente. O sistema continua aberto.');
    } finally {
      setSyncingNow(false);
    }
  }, [isDesktop, syncNow, syncingNow]);

  const defaultOfflineAdminUsername = (username || user?.email || 'admin')
    .trim()
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'admin';

  const updateScrollHints = useCallback(() => {
    const nav = navRef.current;
    if (!nav) {
      setScrollHints({ top: false, bottom: false });
      return;
    }

    const threshold = 8;
    const hasTopOverflow = nav.scrollTop > threshold;
    const hasBottomOverflow = nav.scrollTop + nav.clientHeight < nav.scrollHeight - threshold;

    setScrollHints((current) => {
      if (current.top === hasTopOverflow && current.bottom === hasBottomOverflow) {
        return current;
      }

      return { top: hasTopOverflow, bottom: hasBottomOverflow };
    });
  }, []);

  const scrollSidebarNav = useCallback((direction: 'up' | 'down') => {
    const nav = navRef.current;
    if (!nav) return;

    const distance = Math.max(120, Math.round(nav.clientHeight * 0.55));
    nav.scrollBy({
      top: direction === 'up' ? -distance : distance,
      behavior: 'smooth',
    });

    window.setTimeout(updateScrollHints, 260);
  }, [updateScrollHints]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return element.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPdvMode || role === 'hr') return;
      if (isEditableTarget(event.target)) return;
      if (
        event.altKey
        && event.shiftKey
        && !event.ctrlKey
        && !event.metaKey
        && event.key.toLowerCase() === 's'
      ) {
        event.preventDefault();
        void handleGlobalSync();
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const pathByKey = visibleNavItems.reduce<Record<string, string>>((acc, item) => {
        if (!item.shortcut) return acc;
        acc[item.shortcut] = item.path;
        return acc;
      }, {});
      const path = pathByKey[event.key];
      if (!path) return;
      event.preventDefault();
      setOpen(false);
      navigate(path);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleGlobalSync, isPdvMode, navigate, role, visibleNavItems]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const runUpdate = () => window.requestAnimationFrame(updateScrollHints);
    runUpdate();

    nav.addEventListener('scroll', updateScrollHints, { passive: true });
    window.addEventListener('resize', runUpdate);

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(runUpdate)
      : null;

    resizeObserver?.observe(nav);

    return () => {
      nav.removeEventListener('scroll', updateScrollHints);
      window.removeEventListener('resize', runUpdate);
      resizeObserver?.disconnect();
    };
  }, [location.pathname, open, updateScrollHints]);

  useEffect(() => {
    if (!isDesktop || !user?.id) {
      setOfflineValidationStartedAt(null);
      return;
    }

    const storedStartedAt = readOfflineValidationStartedAt(user.id);

    if (desktopLicensed && !usingOfflineValidationCache) {
      const nextStartedAt = new Date().toISOString();
      writeOfflineValidationStartedAt(user.id, nextStartedAt);
      setOfflineValidationStartedAt(nextStartedAt);
      return;
    }

    if (usingOfflineValidationCache && !storedStartedAt) {
      const migratedStartedAt = new Date().toISOString();
      writeOfflineValidationStartedAt(user.id, migratedStartedAt);
      setOfflineValidationStartedAt(migratedStartedAt);
      return;
    }

    setOfflineValidationStartedAt(storedStartedAt);
  }, [desktopLicensed, isDesktop, user?.id, usingOfflineValidationCache]);

  useEffect(() => {
    if (!user?.id || !offlineValidationExpiresAt || !shouldShowOfflineReminder) {
      setOfflineReminderOpen(false);
      return;
    }

    const reminderKey = offlineValidationReminderKey(user.id, offlineValidationExpiresAt);
    if (window.sessionStorage.getItem(reminderKey) === '1') return;

    setOfflineReminderOpen(true);
  }, [offlineValidationExpiresAt, shouldShowOfflineReminder, user?.id]);

  useEffect(() => {
    if (
      !isDesktop
      || role !== 'admin'
      || !user?.id
      || !ownerUserId
      || !session?.access_token
      || isLocalOfflineSession
      || !desktopActivation
    ) {
      setOfflineAdminSetupOpen(false);
      return;
    }

    if (desktopActivation.ownerUserId !== ownerUserId) {
      setOfflineAdminSetupOpen(false);
      return;
    }

    setOfflineAdminSetupOpen(!hasOfflineAdminAccess(ownerUserId));
  }, [desktopActivation, isDesktop, isLocalOfflineSession, ownerUserId, role, session?.access_token, user?.id]);

  const handleCloseOfflineReminder = useCallback(() => {
    if (user?.id && offlineValidationExpiresAt) {
      window.sessionStorage.setItem(offlineValidationReminderKey(user.id, offlineValidationExpiresAt), '1');
    }

    setOfflineReminderOpen(false);
  }, [offlineValidationExpiresAt, user?.id]);

  const handleOfflineAdminSetup = useCallback(async (payload: { username: string; pin: string }) => {
    if (!user?.id || !ownerUserId) {
      toast.error('Nao foi possivel identificar o administrador desta loja.');
      return;
    }

    setSavingOfflineAdminSetup(true);

    try {
      await saveOfflineAdminAccess({
        userId: user.id,
        ownerUserId,
        username: payload.username,
        email: user.email ?? null,
        pin: payload.pin,
      });

      if (session?.access_token && username !== payload.username) {
        // Generated Supabase types are behind the current profile schema.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const { error } = await db.from('profiles').update({ username: payload.username }).eq('user_id', user.id);

        if (error) {
          toast.error('Acesso offline salvo, mas nao foi possivel sincronizar o usuario admin online agora.');
        } else {
          await refreshProfile();
        }
      }

      toast.message('Preparando banco local desta maquina...');
      await refetch();
      setOfflineAdminSetupOpen(false);
      toast.success('Acesso offline do administrador configurado e dados locais atualizados.');
    } catch (error) {
      toast.error(getPublicErrorMessage(error, 'Nao foi possivel salvar o acesso offline do administrador.'));
    } finally {
      setSavingOfflineAdminSetup(false);
    }
  }, [ownerUserId, refetch, refreshProfile, session?.access_token, user?.email, user?.id, username]);

  if (offlineValidationExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-card p-6 shadow-xl">
          <div className="flex items-center gap-3 text-primary">
            <Clock3 className="h-5 w-5" />
            <h2 className="text-xl font-semibold text-foreground">Validação offline expirada</h2>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            O HappyCash pode ficar offline por até {OFFLINE_VALIDATION_GRACE_DAYS} dias após a última validação.
            Esse prazo terminou, então agora é preciso reconectar à internet para validar novamente.
          </p>
          <div className="mt-4 rounded-xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
            <p>Última validade offline: {offlineValidationExpiresAt ? new Date(offlineValidationExpiresAt).toLocaleString('pt-BR') : 'não identificada'}</p>
            <p className="mt-1">Situação atual: acesso offline bloqueado até nova validação online.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" onClick={() => void refreshDesktopLicense()}>
              Validar novamente
            </Button>
            <Button type="button" variant="outline" onClick={() => void logout()}>
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (shouldBlockMissingOfflineSnapshot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-xl rounded-2xl border border-border/70 bg-card p-6 shadow-xl">
          <div className="flex items-center gap-3 text-primary">
            <WifiOff className="h-5 w-5" />
            <h2 className="text-xl font-semibold text-foreground">Desktop ainda nao preparado para offline</h2>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {offlinePreparationMessage || 'Este computador ainda nao baixou os dados da loja para uso offline.'}
          </p>
          <div className="mt-4 rounded-xl border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
            <p>Como preparar: conecte a internet, entre com o administrador, configure o usuario/PIN offline e aguarde a mensagem de acesso offline pronto.</p>
            <p className="mt-2">Depois disso, se a internet cair, o HappyCash abre os dados salvos neste computador.</p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="button" onClick={() => void refetch()}>
              Tentar carregar novamente
            </Button>
            <Button type="button" variant="outline" onClick={() => void logout()}>
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isPdvMode) {
    return (
      <div className="h-screen overflow-hidden bg-background">
        <main className="h-screen overflow-hidden p-3 sm:p-4 lg:overflow-y-auto lg:p-6">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DesktopOfflineAdminSetupDialog
        open={offlineAdminSetupOpen}
        defaultUsername={defaultOfflineAdminUsername}
        companyName={desktopActivation?.companyName ?? null}
        submitting={savingOfflineAdminSetup}
        onSubmit={handleOfflineAdminSetup}
      />

      <Dialog open={offlineReminderOpen} onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleCloseOfflineReminder();
          return;
        }

        setOfflineReminderOpen(true);
      }}>
        <DialogContent className="max-w-md border-border/70 bg-card/95 backdrop-blur">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock3 className="h-5 w-5 text-primary" />
              Lembrete de validação offline
            </DialogTitle>
            <DialogDescription>
              Faltam menos de {OFFLINE_VALIDATION_REMINDER_HOURS} horas para a validação offline vencer.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Restam {offlineValidationRemainingMs !== null ? formatRemainingTime(offlineValidationRemainingMs) : 'poucos minutos'} para validar novamente.
            </p>
            <p className="mt-2">
              Conecte o HappyCash à internet para renovar a validação e evitar bloqueio do modo offline.
            </p>
            <p className="mt-2">
              Limite atual: {offlineValidationExpiresAt ? new Date(offlineValidationExpiresAt).toLocaleString('pt-BR') : 'não identificado'}.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseOfflineReminder}>
              Lembrar depois
            </Button>
            <Button type="button" onClick={() => {
              handleCloseOfflineReminder();
              void refreshDesktopLicense();
            }}>
              Validar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {open && <div className="fixed inset-0 bg-background/80 z-40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col overflow-hidden border-r border-border bg-card transition-transform duration-300 lg:static lg:h-screen lg:translate-x-0 lg:shrink-0 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="shrink-0 border-b border-border px-3 py-3">
          <div className="relative flex items-start justify-end">
            <div className="min-w-0 flex-1 pr-2 text-center">
              <img
                src={happyCashLogo}
                alt="Logo do sistema"
                className="mx-auto h-auto w-full max-w-[118px] object-contain"
                width={768}
                height={512}
                loading="eager"
                decoding="async"
              />
              <p className="mt-1 text-[9px] font-semibold tracking-[0.08em] text-muted-foreground">
                SISTEMA DE GESTAO 2.0
              </p>
            </div>
            <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          {scrollHints.top && (
            <div className="pointer-events-none absolute inset-x-4 top-0 z-10 flex justify-center bg-gradient-to-b from-card via-card/85 to-transparent pb-4 pt-2">
              <button
                type="button"
                aria-label="Rolar menu para cima"
                title="Rolar menu para cima"
                className="pointer-events-auto rounded-full border border-border/70 bg-background/90 p-1.5 text-muted-foreground shadow-lg backdrop-blur-sm transition-colors animate-[floatHint_1.7s_ease-in-out_infinite] hover:border-primary/60 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                onClick={() => scrollSidebarNav('up')}
              >
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          )}
          <nav ref={navRef} className="no-scrollbar min-h-0 h-full overflow-y-auto p-4 space-y-1">
            {visibleNavItems.map(item => {
              const active = item.path === '/configuracoes'
                ? location.pathname.startsWith('/configuracoes')
                : item.path === '/estoque'
                  ? location.pathname.startsWith('/estoque')
                : location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
                  data-tour-id={item.tourId}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                  {'shortcut' in item && item.shortcut && (
                    <span className={`ml-auto hidden rounded border px-1.5 py-0.5 text-[10px] font-semibold md:inline-flex ${active ? 'border-primary-foreground/40 text-primary-foreground' : 'border-border text-muted-foreground'}`}>
                      {item.shortcut}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          {scrollHints.bottom && (
            <div className="pointer-events-none absolute inset-x-4 bottom-0 z-10 flex justify-center bg-gradient-to-t from-card via-card/85 to-transparent pb-2 pt-4">
              <button
                type="button"
                aria-label="Rolar menu para baixo"
                title="Rolar menu para baixo"
                className="pointer-events-auto rounded-full border border-border/70 bg-background/90 p-1.5 text-muted-foreground shadow-lg backdrop-blur-sm transition-colors animate-[floatHint_1.7s_ease-in-out_infinite] hover:border-primary/60 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                onClick={() => scrollSidebarNav('down')}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-border p-2.5">
          <button onClick={logout} className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="h-4 w-4" /><span>Sair</span>
          </button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="z-30 flex min-h-14 shrink-0 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur-sm sm:gap-4 sm:px-5">
          <button type="button" onClick={() => setOpen(true)} className="shrink-0 text-muted-foreground hover:text-foreground lg:hidden" aria-label="Abrir menu">
            <Menu className="h-6 w-6" />
          </button>

          {showCentralBackButton && (
            <Button asChild variant="ghost" size="sm" className="h-9 shrink-0 px-2 sm:px-3">
              <Link to="/configuracoes">
                <ArrowLeft className="mr-1.5 h-4 w-4 sm:mr-2" />
                <span className="sm:hidden">Central</span>
                <span className="hidden sm:inline">Voltar para a Central</span>
              </Link>
            </Button>
          )}

          {role !== 'hr' && operationalScope && (
            <div className="flex min-w-0 items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {isDesktop ? 'Terminal local' : 'Filial ativa'}
                </p>
                {isDesktop || operationalLocations.length <= 1 ? (
                  <p className="max-w-40 truncate text-xs font-semibold text-foreground sm:max-w-64">
                    {operationalScope.location.name} · {operationalScope.terminal?.name ?? 'Sem terminal'}
                  </p>
                ) : (
                  <Select
                    value={operationalScope.location.id}
                    disabled={operationalScopeLoading || hasOpenLocalCashSession}
                    onValueChange={(locationId) => selectWebScope(locationId)}
                  >
                    <SelectTrigger className="h-6 max-w-40 border-0 bg-transparent p-0 text-xs font-semibold shadow-none sm:max-w-64" aria-label="Selecionar filial operacional">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operationalLocations.map((storeLocation) => (
                        <SelectItem key={storeLocation.id} value={storeLocation.id}>{storeLocation.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {!isDesktop && terminalsForCurrentLocation.length > 1 && (
                <Select
                  value={operationalScope.terminal?.id ?? ''}
                  disabled={hasOpenLocalCashSession}
                  onValueChange={(terminalId) => selectWebScope(operationalScope.location.id, terminalId)}
                >
                  <SelectTrigger className="hidden h-8 w-36 text-xs md:flex" aria-label="Selecionar terminal operacional">
                    <SelectValue placeholder="Terminal" />
                  </SelectTrigger>
                  <SelectContent>
                    {terminalsForCurrentLocation.map((terminal) => (
                      <SelectItem key={terminal.id} value={terminal.id}>{terminal.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeModeToggle compact className="shrink-0" />
            {role !== 'hr' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 px-2 sm:px-3"
                title="Sincronizar agora (Alt+Shift+S)"
                onClick={() => void handleGlobalSync()}
                disabled={syncingNow}
              >
                {syncingNow ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="hidden sm:inline">{syncingNow ? 'Sincronizando...' : 'Sincronizar'}</span>
                {!syncingNow && <span className="hidden xl:inline text-[10px] text-muted-foreground">Alt+Shift+S</span>}
              </Button>
            )}
            {user && (
              <button
                type="button"
                onClick={handleAccountClick}
                disabled={!canOpenSettings}
                data-tour-id="account-settings"
                className="flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-default disabled:hover:bg-transparent"
              >
                <UserCircle className="h-4 w-4 shrink-0 text-primary" />
                <span className="hidden min-w-0 sm:block">
                  <span className="block max-w-32 truncate font-semibold text-foreground">{username ?? user.email}</span>
                  <span className="block truncate text-[9px] uppercase tracking-wide">{roleLabel[role]}</span>
                </span>
              </button>
            )}
            {canUseGuidedTour && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 px-2 text-xs"
                onClick={() => {
                  setOpen(false);
                  requestGuidedTourStart();
                }}
              >
                <HelpCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Tutorial</span>
              </Button>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-8">
          {shouldShowOfflinePreparationBanner && (
            <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  {offlinePreparationStatus === 'preparing' ? (
                    <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Database className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      {offlinePreparationStatus === 'preparing'
                        ? 'Preparando uso offline'
                        : offlinePreparationStatus === 'ready'
                          ? 'Uso offline pronto'
                          : 'Atenção ao uso offline'}
                    </p>
                    <p className="mt-1 leading-relaxed">
                      {offlinePreparationMessage || 'Conecte a internet para preparar este computador para uso offline.'}
                    </p>
                    {offlineSnapshotUpdatedAt && (
                      <p className="mt-1 text-xs">
                        Ultima copia local: {new Date(offlineSnapshotUpdatedAt).toLocaleString('pt-BR')}.
                      </p>
                    )}
                  </div>
                </div>
                {(offlinePreparationStatus === 'error' || offlinePreparationStatus === 'not-ready') && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
                    Tentar novamente
                  </Button>
                )}
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

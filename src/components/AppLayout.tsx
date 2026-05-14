import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Clock3, Home, Users, Package, Gift, Trash2, LogOut, Menu, X, UserCircle, Receipt, BarChart3, DollarSign, Boxes, ChevronDown, ChevronUp, FileText, Shield, Calculator, ShieldCheck, Database, Loader2, WifiOff, ClipboardList, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { useDesktopRuntime } from '@/contexts/DesktopRuntimeContext';
import { usePlanAccess } from '@/contexts/PlanContext';
import happyCashLogo from '@/assets/happycash-logo.webp';
import { roleLabel } from '@/lib/access';
import { readDesktopActivation } from '@/lib/desktopActivation';
import { hasOfflineAdminAccess, saveOfflineAdminAccess } from '@/lib/offlineAdminAccess';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { DesktopOfflineAdminSetupDialog } from '@/components/DesktopOfflineAdminSetupDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const navItems = [
  { path: '/', label: 'Painel', icon: Home, shortcut: '1', roles: ['admin', 'operator'], featureKey: 'dashboard.view' },
  { path: '/pdv', label: 'PDV 🧾', icon: Receipt, shortcut: '2', roles: ['admin', 'operator'], featureKey: 'pdv.use' },
  { path: '/clientes', label: 'Clientes', icon: Users, shortcut: '3', roles: ['admin', 'operator'], featureKey: 'clients.manage' },
  { path: '/produtos', label: 'Produtos', icon: Package, shortcut: '4', roles: ['admin', 'operator'], featureKey: 'products.manage' },
  { path: '/estoque', label: 'Estoque', icon: Boxes, shortcut: '5', roles: ['admin'], featureKey: 'stock.manage' },
  { path: '/relatorios', label: 'Relatórios', icon: BarChart3, shortcut: '6', roles: ['admin'], featureKey: 'reports.view' },
  { path: '/financeiro', label: 'Financeiro', icon: DollarSign, shortcut: '7', roles: ['admin'], featureKey: 'financial.manage' },
  { path: '/operacoes', label: 'Operações', icon: ClipboardList, roles: ['admin'], featureKey: 'financial.manage' },
  { path: '/restaurante', label: 'Restaurante', icon: Utensils, roles: ['admin', 'operator'], featureKey: 'restaurant.manage' },
  { path: '/notas', label: 'Notas', icon: FileText, shortcut: '8', roles: ['admin'], featureKey: 'notes.manage' },
  { path: '/precificacao', label: 'Precificação', icon: Calculator, roles: ['admin'], featureKey: 'pricing.manage' },
  { path: '/acessos', label: 'Acessos', icon: Shield, roles: ['admin'], featureKey: 'settings.manage' },
  { path: '/auditoria', label: 'Auditoria', icon: ShieldCheck, roles: ['admin'], featureKey: 'settings.manage' },
  { path: '/recompensas', label: 'Recompensas', icon: Gift, roles: ['admin'], featureKey: 'rewards.manage' },
  { path: '/excluidos', label: 'Excluídos', icon: Trash2, roles: ['admin'], featureKey: 'deleted.view' },
];

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
  } = useData();
  const {
    isDesktop,
    licensed: desktopLicensed,
    refresh: refreshDesktopLicense,
    validUntil: desktopValidUntil,
    validationExpiresAt: desktopValidationExpiresAt,
    usingOfflineValidationCache,
  } = useDesktopRuntime();
  const { hasFeature } = usePlanAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [offlineAdminSetupOpen, setOfflineAdminSetupOpen] = useState(false);
  const [savingOfflineAdminSetup, setSavingOfflineAdminSetup] = useState(false);
  const [offlineReminderOpen, setOfflineReminderOpen] = useState(false);
  const [offlineValidationStartedAt, setOfflineValidationStartedAt] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const navRef = useRef<HTMLElement | null>(null);
  const [scrollHints, setScrollHints] = useState({ top: false, bottom: false });
  const isPdvMode = location.pathname === '/pdv';
  const desktopActivation = readDesktopActivation();
  const visibleNavItems = navItems.filter(item => item.roles.includes(role) && hasFeature(item.featureKey));
  const canOpenSettings = role === 'admin' && hasFeature('settings.manage');
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

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      const tag = element.tagName;
      return element.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPdvMode) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (isEditableTarget(event.target)) return;
      const pathByKey = visibleNavItems.reduce<Record<string, string>>((acc, item) => {
        if (!item.shortcut) return acc;
        acc[item.shortcut] = item.path;
        acc[`F${item.shortcut}`] = item.path;
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
  }, [isPdvMode, navigate, visibleNavItems]);

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
          toast.error('Acesso offline salvo, mas nao foi possivel sincronizar o usuario admin no Supabase agora.');
        } else {
          await refreshProfile();
        }
      }

      toast.message('Preparando banco local desta maquina...');
      await refetch();
      setOfflineAdminSetupOpen(false);
      toast.success('Acesso offline do administrador configurado e dados locais atualizados.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel salvar o acesso offline do administrador.');
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
        <main className="h-screen overflow-hidden p-3 sm:p-4 lg:overflow-y-auto lg:p-6">{children}</main>
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
        <div className="shrink-0 border-b border-border px-4 py-5">
          <div className="relative flex items-start justify-end">
            <div className="min-w-0 flex-1 pr-2 text-center">
              <img
                src={happyCashLogo}
                alt="Logo do sistema"
                className="mx-auto h-auto w-full max-w-[168px] object-contain"
                width={768}
                height={512}
                loading="eager"
                decoding="async"
              />
              <p className="mt-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                SISTEMA DE GESTAO 2.0
              </p>
            </div>
            <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          {scrollHints.top && (
            <div className="pointer-events-none absolute inset-x-4 top-0 z-10 flex justify-center bg-gradient-to-b from-card via-card/85 to-transparent pb-4 pt-2">
              <div className="rounded-full border border-border/70 bg-background/80 p-1.5 text-muted-foreground shadow-lg backdrop-blur-sm animate-[floatHint_1.7s_ease-in-out_infinite]">
                <ChevronUp className="h-4 w-4" />
              </div>
            </div>
          )}
          <nav ref={navRef} className="no-scrollbar min-h-0 h-full overflow-y-auto p-4 space-y-1">
            {visibleNavItems.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                  <item.icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                  {'shortcut' in item && item.shortcut && (
                    <span className={`ml-auto rounded border px-1.5 py-0.5 text-[10px] font-semibold ${active ? 'border-primary-foreground/40 text-primary-foreground' : 'border-border text-muted-foreground'}`}>
                      {item.shortcut}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          {scrollHints.bottom && (
            <div className="pointer-events-none absolute inset-x-4 bottom-0 z-10 flex justify-center bg-gradient-to-t from-card via-card/85 to-transparent pb-2 pt-4">
              <div className="rounded-full border border-border/70 bg-background/80 p-1.5 text-muted-foreground shadow-lg backdrop-blur-sm animate-[floatHint_1.7s_ease-in-out_infinite]">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          )}
        </div>
        <div className="shrink-0 space-y-2 border-t border-border p-4">
          {user && (
            canOpenSettings ? (
              <button
                type="button"
                onClick={handleAccountClick}
                className="w-full rounded-lg px-4 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <div className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-primary" />
                  <span className="truncate font-medium">{username ?? user.email}</span>
                </div>
                <p className="mt-1 pl-7 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  {roleLabel[role]} • Configuracoes
                </p>
              </button>
            ) : (
              <div className="px-4 py-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 text-primary" />
                  <span className="truncate font-medium">{username ?? user.email}</span>
                </div>
                <p className="mt-1 pl-7 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  {roleLabel[role]}
                </p>
              </div>
            )
          )}
          <button onClick={logout} className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors">
            <LogOut className="h-5 w-5" /><span>Sair</span>
          </button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border p-3 sm:p-4 lg:hidden">
          <button onClick={() => setOpen(true)} className="text-muted-foreground hover:text-foreground"><Menu className="h-6 w-6" /></button>
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

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import { normalizeUserRole, type UserRole } from '@/lib/access';
import { clearSystemTemporarySessionPreference, enforceSystemSessionPreference } from '@/lib/authSessionPreferences';
import {
  ACCESS_HEARTBEAT_INTERVAL_MS,
  clearSystemClientSessionId,
  trackSystemAccessEvent,
} from '@/lib/accessTracking';
import { getActivatedDesktopOwnerUserId, readDesktopActivation } from '@/lib/desktopActivation';
import { verifyOfflineAdminAccess } from '@/lib/offlineAdminAccess';
import { saveOfflineOperatorAccess, verifyOfflineOperatorAccess } from '@/lib/offlineOperatorAccess';
import { isDesktopRuntime, isProbablyOfflineError } from '@/lib/offlineConcentrator';
import { getPasskeyErrorMessage, getPasskeySupportErrorMessage, type PasskeyEntry } from '@/lib/passkeys';
import {
  clearLocalLoginFailures,
  getLocalLoginBlockMessage,
  recordLocalLoginFailure,
} from '@/lib/localLoginAttemptLimiter';
import { requestTurnstileToken } from '../../shared/security/turnstile';
import { getPasswordPolicyError } from '../../shared/security/passwordPolicy';
import { getPublicAuthErrorMessage, getPublicErrorMessage, getRedactedLogValue } from '../../shared/security/redaction';
import { normalizeProductContext, type ProductContext } from '../../shared/productContext';
import { retryAsync } from '../../shared/network/retry';

interface UserProfile {
  username: string | null;
  email: string | null;
  role: UserRole;
  owner_user_id: string | null;
  product_context: ProductContext;
}

interface ProfileQueryRow {
  username?: string | null;
  email?: string | null;
  role?: string | null;
  owner_user_id?: string | null;
}

interface ProductContextRpcClient {
  rpc(functionName: 'get_current_store_product_context'): Promise<{
    data: string | null;
    error: { message: string } | null;
  }>;
}

interface ProfileCountClient {
  from(table: 'profiles'): {
    select(columns: string, options: { count: 'exact'; head: true }): {
      eq(column: string, value: string): Promise<{
        count: number | null;
      }>;
    };
  };
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  username: string | null;
  profileEmail: string | null;
  role: UserRole;
  ownerUserId: string | null;
  isAdmin: boolean;
  isOperator: boolean;
  isHr: boolean;
  login: (email: string, password: string, accessCode?: string) => Promise<AdminLoginResult>;
  signInWithGoogle: () => Promise<string | true>;
  signInWithPasskey: () => Promise<string | true>;
  loginOfflineAdmin: (username: string, pin: string) => Promise<string | true>;
  loginOperator: (username: string, password: string) => Promise<string | true>;
  register: (email: string, password: string, username: string) => Promise<string | true>;
  registerPasskey: () => Promise<PasskeyEntry>;
  listPasskeys: () => Promise<PasskeyEntry[]>;
  deletePasskey: (passkeyId: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLocalOfflineSession: boolean;
  refreshProfile: () => Promise<void>;
  loading: boolean;
}

interface OperatorLoginResponse {
  success?: boolean;
  session?: {
    access_token?: string;
    refresh_token?: string;
  };
  operator?: {
    userId?: string;
    ownerUserId?: string | null;
    username?: string | null;
    email?: string | null;
    role?: UserRole;
  };
  error?: string;
}

interface AdminLoginResponse {
  success?: boolean;
  verificationRequired?: boolean;
  code?: string;
  retryAfterSeconds?: number | null;
  remainingAttempts?: number | null;
  maxFailedAttempts?: number | null;
  session?: {
    access_token?: string;
    refresh_token?: string;
  };
  user?: {
    id?: string;
    email?: string | null;
    ownerUserId?: string | null;
    role?: UserRole;
  };
  error?: string;
}

type AdminLoginResult = true | string | {
  error: string;
  verificationRequired?: boolean;
  retryAfterSeconds?: number | null;
  remainingAttempts?: number | null;
  maxFailedAttempts?: number | null;
};

interface LocalOfflineSession {
  source: 'offline-admin' | 'offline-operator';
  role: UserRole;
  userId: string;
  ownerUserId: string;
  username: string;
  email: string | null;
  authenticatedAt: string;
}

const normalizeOfflineStaffRole = (value: string | null | undefined): UserRole =>
  value === 'waiter' ? 'waiter' : 'operator';

const SUPABASE_AUTH_URL = (import.meta.env.VITE_SUPABASE_AUTH_URL as string | undefined)?.trim() || null;

const parseUrlOrNull = (value: string | null | undefined) => {
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const getHappyCashAuthOrigin = () => {
  const parsed = parseUrlOrNull(SUPABASE_AUTH_URL);
  if (!parsed || !/^https?:$/.test(parsed.protocol)) return null;
  return parsed.origin;
};

const AuthContext = createContext<AuthContextType | null>(null);
const profileCacheKey = (userId: string) => `happycash:system:profile:${userId}`;
const DESKTOP_ACTIVATION_OWNER_MISMATCH = 'DESKTOP_ACTIVATION_OWNER_MISMATCH';
const SYSTEM_PRODUCT_CONTEXT_MISMATCH = 'SYSTEM_PRODUCT_CONTEXT_MISMATCH';
const SYSTEM_PRODUCT_CONTEXT_MISMATCH_MESSAGE = 'Email ou senha incorretos.';
const readCachedProfile = (userId: string): UserProfile | null => {
  if (typeof window === 'undefined') return null;

  try {
    const stored = window.localStorage.getItem(profileCacheKey(userId));
    if (!stored) return null;
    return JSON.parse(stored) as UserProfile;
  } catch {
    return null;
  }
};

const writeCachedProfile = (userId: string, profile: UserProfile) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(profileCacheKey(userId), JSON.stringify(profile));
  } catch {
    // Keep auth usable even when localStorage is unavailable.
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole>('admin');
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [localOfflineSession, setLocalOfflineSession] = useState<LocalOfflineSession | null>(null);
  const [loading, setLoading] = useState(true);
  const localOfflineSessionRef = useRef<LocalOfflineSession | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const loadingRef = useRef(true);

  const resetAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setUsername(null);
    setProfileEmail(null);
    setRole('admin');
    setOwnerUserId(null);
    localOfflineSessionRef.current = null;
    setLocalOfflineSession(null);
  }, []);

  const buildLocalOfflineUser = useCallback((payload: LocalOfflineSession) => ({
    id: payload.userId,
    email: payload.email ?? undefined,
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {
      provider: payload.source,
      providers: [payload.source],
    },
    user_metadata: {
      username: payload.username,
      role: payload.role,
      owner_user_id: payload.ownerUserId,
      offline: true,
    },
    created_at: payload.authenticatedAt,
  } as User), []);

  const applyLocalOfflineSession = useCallback((payload: LocalOfflineSession) => {
    localOfflineSessionRef.current = payload;
    setSession(null);
    setUser(buildLocalOfflineUser(payload));
    setUsername(payload.username);
    setProfileEmail(payload.email);
    setRole(payload.role);
    setOwnerUserId(payload.ownerUserId);
    setLocalOfflineSession(payload);
  }, [buildLocalOfflineUser]);

  const clearLocalSession = useCallback(() => {
    window.setTimeout(() => {
      clearSystemTemporarySessionPreference();
      void supabase.auth.signOut({ scope: 'local' });
    }, 0);
  }, []);

  const fetchStoreAccountProductContext = useCallback(async (_ownerUserId: string) => {
    if (!_ownerUserId) {
      return 'happycash' as ProductContext;
    }

    const db = supabase as unknown as ProductContextRpcClient;
    const { data, error } = await db.rpc('get_current_store_product_context');

    if (error) {
      throw error;
    }

    return normalizeProductContext(data);
  }, []);

  const fetchProfile = useCallback(async (currentUser: User): Promise<UserProfile> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, email, role, owner_user_id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar perfil do usuário:', getRedactedLogValue(error));
      }

      const profile = (data ?? null) as ProfileQueryRow | null;

      const resolvedProfile: UserProfile = {
        username: profile?.username ?? null,
        email: profile?.email ?? currentUser.email ?? null,
        role: normalizeUserRole(profile?.role),
        owner_user_id: profile?.owner_user_id ?? currentUser.id,
        product_context: 'happycash',
      };

      const productContext = await fetchStoreAccountProductContext(resolvedProfile.owner_user_id ?? currentUser.id);
      if (productContext !== 'happycash') {
        throw new Error(SYSTEM_PRODUCT_CONTEXT_MISMATCH);
      }

      resolvedProfile.product_context = productContext;

      const activatedOwnerUserId = getActivatedDesktopOwnerUserId();
      if (isDesktopRuntime() && activatedOwnerUserId && resolvedProfile.owner_user_id !== activatedOwnerUserId) {
        throw new Error(DESKTOP_ACTIVATION_OWNER_MISMATCH);
      }

      writeCachedProfile(currentUser.id, resolvedProfile);
      return resolvedProfile;
    } catch (error) {
      if (
        error instanceof Error
        && (error.message === DESKTOP_ACTIVATION_OWNER_MISMATCH || error.message === SYSTEM_PRODUCT_CONTEXT_MISMATCH)
      ) {
        throw error;
      }

      console.error('Erro inesperado ao carregar perfil do usuário:', getRedactedLogValue(error));

      const cachedProfile = readCachedProfile(currentUser.id);
      if (cachedProfile && isDesktopRuntime() && isProbablyOfflineError(error)) {
        return cachedProfile;
      }

      return {
        username: null,
        email: currentUser.email ?? null,
        role: 'admin',
        owner_user_id: currentUser.id,
        product_context: 'happycash',
      };
    }
  }, [fetchStoreAccountProductContext]);

  const syncProfileState = useCallback(async (currentUser: User) => {
    const profile = await fetchProfile(currentUser);
    setUsername(profile.username);
    setProfileEmail(profile.email);
    setRole(profile.role);
    setOwnerUserId(profile.owner_user_id ?? currentUser.id);
  }, [fetchProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;

    if (localOfflineSession) {
      applyLocalOfflineSession(localOfflineSession);
      return;
    }

    await syncProfileState(user);
  }, [applyLocalOfflineSession, localOfflineSession, syncProfileState, user]);

  useEffect(() => {
    currentUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    let isMounted = true;
    let syncRequestId = 0;

    const syncAuthState = async (nextSession: Session | null) => {
      const currentRequestId = ++syncRequestId;

      if (isMounted) {
        setLoading(true);
      }

      try {
        if (!nextSession?.access_token) {
          if (isMounted && currentRequestId === syncRequestId) {
            const offlineSession = localOfflineSessionRef.current;
            if (offlineSession) {
              applyLocalOfflineSession(offlineSession);
            } else {
              resetAuthState();
            }
          }
          return;
        }

        const { data, error } = await retryAsync(
          async () => {
            const response = await supabase.auth.getUser(nextSession.access_token);
            if (response.error) throw response.error;
            return response;
          },
          { attempts: 3, delayMs: 700 },
        ).catch((error) => ({ data: { user: null }, error }));

        if (!isMounted || currentRequestId !== syncRequestId) return;

        if (error || !data.user) {
          if (isDesktopRuntime() && isProbablyOfflineError(error) && nextSession.user) {
            setSession(nextSession);
            setUser(nextSession.user);
            await syncProfileState(nextSession.user);
            return;
          }

          console.error('Erro ao validar sessão do Supabase:', getRedactedLogValue(error));
          resetAuthState();
          clearLocalSession();
          return;
        }

        setLocalOfflineSession(null);
        setSession(nextSession);
        setUser(data.user);
        await syncProfileState(data.user);
      } catch (error) {
        if (!isMounted || currentRequestId !== syncRequestId) return;

        console.error('Erro ao sincronizar autenticação:', getRedactedLogValue(error));
        resetAuthState();
        if (
          error instanceof Error
          && (error.message === DESKTOP_ACTIVATION_OWNER_MISMATCH || error.message === SYSTEM_PRODUCT_CONTEXT_MISMATCH)
        ) {
          clearLocalSession();
        }
      } finally {
        if (isMounted && currentRequestId === syncRequestId) {
          setLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return;

      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
        && nextSession?.access_token
        && nextSession.user?.id === currentUserIdRef.current
        && !loadingRef.current
      ) {
        window.setTimeout(() => {
          if (!isMounted) return;
          setSession(nextSession);
          setUser(nextSession.user);
        }, 0);
        return;
      }

      window.setTimeout(() => {
        void syncAuthState(nextSession);
      }, 0);
    });

    void (async () => {
      try {
        await enforceSystemSessionPreference(supabase);
        const { data: { session: nextSession }, error } = await retryAsync(
          async () => {
            const response = await supabase.auth.getSession();
            if (response.error) throw response.error;
            return response;
          },
          { attempts: 3, delayMs: 700 },
        ).catch((error) => ({ data: { session: null }, error }));
        if (!isMounted) return;

        if (error) {
          console.error('Erro ao recuperar sessão do Supabase:', getRedactedLogValue(error));
          resetAuthState();
          setLoading(false);
          return;
        }

        await syncAuthState(nextSession);
      } catch (error) {
        if (!isMounted) return;

        console.error('Erro ao inicializar autenticação:', getRedactedLogValue(error));
        resetAuthState();
        if (
          error instanceof Error
          && (error.message === DESKTOP_ACTIVATION_OWNER_MISMATCH || error.message === SYSTEM_PRODUCT_CONTEXT_MISMATCH)
        ) {
          clearLocalSession();
        }
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      syncRequestId += 1;
      subscription.unsubscribe();
    };
  }, [applyLocalOfflineSession, clearLocalSession, localOfflineSession, resetAuthState, syncProfileState]);

  useEffect(() => {
    if (!session?.access_token || !user) return;

    const sendHeartbeat = () => {
      void trackSystemAccessEvent(session.access_token, 'heartbeat');
    };

    sendHeartbeat();

    const heartbeatId = window.setInterval(sendHeartbeat, ACCESS_HEARTBEAT_INTERVAL_MS);

    const handleFocus = () => sendHeartbeat();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(heartbeatId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.access_token, user]);

  const validateSignedInAdminSession = useCallback(async (signedInUser: User) => {
    const activation = readDesktopActivation();

    try {
      const profile = await fetchProfile(signedInUser);
      if (activation?.ownerUserId && (profile.owner_user_id ?? signedInUser.id) !== activation.ownerUserId) {
        await supabase.auth.signOut({ scope: 'local' });
        return `Este login nao pertence a empresa ativada neste desktop: ${activation.companyName}.`;
      }
    } catch (activationError) {
      await supabase.auth.signOut({ scope: 'local' });
      if (activationError instanceof Error && activationError.message === DESKTOP_ACTIVATION_OWNER_MISMATCH) {
        return activation?.ownerUserId
          ? `Este login nao pertence a empresa ativada neste desktop: ${activation.companyName}.`
          : 'Nao foi possivel validar a empresa desta sessao.';
      }
      if (activationError instanceof Error && activationError.message === SYSTEM_PRODUCT_CONTEXT_MISMATCH) {
        return SYSTEM_PRODUCT_CONTEXT_MISMATCH_MESSAGE;
      }
      return 'Nao foi possivel validar a empresa desta sessao.';
    }

    return true;
  }, [fetchProfile]);

  const login = async (email: string, password: string, accessCode?: string): Promise<AdminLoginResult> => {
    let captchaToken: string | undefined;
    try {
      captchaToken = await requestTurnstileToken('app-login');
    } catch (error) {
      return getPublicAuthErrorMessage(error, 'Nao foi possivel concluir a verificacao de seguranca.');
    }

    const activation = readDesktopActivation();
    const { data, error } = await supabase.functions.invoke<AdminLoginResponse>('admin-login', {
      body: {
        email,
        password,
        accessCode: accessCode?.replace(/\D/g, '').slice(0, 8) || null,
        loginSurface: isDesktopRuntime() ? 'desktop' : 'web',
        desktopOwnerUserId: activation?.ownerUserId ?? null,
        captchaToken,
      },
    }).catch((error) => ({ data: null, error }));

    if (error || !data?.success || !data.session?.access_token || !data.session?.refresh_token) {
      let functionErrorMessage = data?.error || 'Email ou senha incorretos.';
      let errorPayload: (AdminLoginResponse & { message?: string }) | null = data ?? null;

      if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
        try {
          errorPayload = await error.context.clone().json() as AdminLoginResponse & { message?: string };
          functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
        } catch {
          functionErrorMessage = 'Email ou senha incorretos.';
        }
      }

      const resolvedError = getPublicAuthErrorMessage(functionErrorMessage, 'Email ou senha incorretos.');
      const verificationRequired = Boolean(errorPayload?.verificationRequired || errorPayload?.code === 'LOGIN_VERIFICATION_REQUIRED');
      if (verificationRequired || errorPayload?.remainingAttempts === 1) {
        return {
          error: resolvedError,
          verificationRequired,
          retryAfterSeconds: errorPayload.retryAfterSeconds ?? null,
          remainingAttempts: errorPayload.remainingAttempts ?? null,
          maxFailedAttempts: errorPayload.maxFailedAttempts ?? null,
        };
      }

      return resolvedError;
    }

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });

    if (setSessionError) {
      return getPublicAuthErrorMessage(setSessionError, 'Nao foi possivel iniciar a sessao.');
    }

    const { data: authenticatedUserData, error: authenticatedUserError } = await supabase.auth.getUser(data.session.access_token);
    if (authenticatedUserError || !authenticatedUserData.user) {
      await supabase.auth.signOut({ scope: 'local' });
      return 'Nao foi possivel validar esta sessao.';
    }

    return validateSignedInAdminSession(authenticatedUserData.user);
  };

  const signInWithPasskey = async (): Promise<string | true> => {
    const supportError = getPasskeySupportErrorMessage();
    if (supportError) return supportError;

    const { data, error } = await supabase.auth.signInWithPasskey();
    if (error || !data.user) {
      return getPasskeyErrorMessage(error, 'Nao foi possivel iniciar o login com biometria.');
    }

    return validateSignedInAdminSession(data.user);
  };

  const signInWithGoogle = async (): Promise<string | true> => {
    if (typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol)) {
      return 'Login com Google disponivel apenas na versao web.';
    }

    const happyCashAuthOrigin = getHappyCashAuthOrigin();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      return getPublicAuthErrorMessage(error, 'Nao foi possivel iniciar o login com Google.');
    }

    if (!data.url) {
      return 'Nao foi possivel preparar o login com Google.';
    }

    try {
      const providerUrl = new URL(data.url);

      // Only rewrite the auth URL when a custom auth proxy was configured explicitly.
      if (happyCashAuthOrigin) {
        const authOrigin = new URL(happyCashAuthOrigin);
        providerUrl.protocol = authOrigin.protocol;
        providerUrl.host = authOrigin.host;
      }

      window.location.assign(providerUrl.toString());
    } catch {
      return 'Nao foi possivel abrir o login com Google.';
    }

    return true;
  };

  const loginOfflineAdmin = async (adminUsername: string, pin: string): Promise<string | true> => {
    const activation = readDesktopActivation();

    if (!activation?.ownerUserId) {
      return 'Ative esta maquina com a chave da empresa antes do login offline.';
    }

    if (activation.appContext !== 'happycash') {
      return SYSTEM_PRODUCT_CONTEXT_MISMATCH_MESSAGE;
    }

    const blockMessage = getLocalLoginBlockMessage({
      namespace: 'offline-admin',
      ownerUserId: activation.ownerUserId,
      identifier: adminUsername,
    });
    if (blockMessage) return blockMessage;

    const verification = await verifyOfflineAdminAccess({
      ownerUserId: activation.ownerUserId,
      username: adminUsername,
      pin,
    });

    if (!verification.success) {
      return recordLocalLoginFailure({
        namespace: 'offline-admin',
        ownerUserId: activation.ownerUserId,
        identifier: adminUsername,
      }) || verification.error;
    }

    clearLocalLoginFailures({
      namespace: 'offline-admin',
      ownerUserId: activation.ownerUserId,
      identifier: adminUsername,
    });

    clearSystemTemporarySessionPreference();
    await supabase.auth.signOut({ scope: 'local' });

    applyLocalOfflineSession({
      source: 'offline-admin',
      role: 'admin',
      userId: verification.record.userId,
      ownerUserId: verification.record.ownerUserId,
      username: verification.record.username,
      email: verification.record.email,
      authenticatedAt: new Date().toISOString(),
    });

    return true;
  };

  const loginOperator = async (username: string, password: string): Promise<string | true> => {
    const activation = readDesktopActivation();
    const tryOfflineOperatorLogin = async () => {
      if (!activation?.ownerUserId) {
        return 'Ative esta maquina com a chave da empresa antes do login offline.';
      }

      if (activation.appContext !== 'happycash') {
        return SYSTEM_PRODUCT_CONTEXT_MISMATCH_MESSAGE;
      }

      const blockMessage = getLocalLoginBlockMessage({
        namespace: 'offline-operator',
        ownerUserId: activation.ownerUserId,
        identifier: username,
      });
      if (blockMessage) return blockMessage;

      const verification = await verifyOfflineOperatorAccess({
        ownerUserId: activation.ownerUserId,
        username,
        secret: password,
      });

      if (!verification.success) {
        return recordLocalLoginFailure({
          namespace: 'offline-operator',
          ownerUserId: activation.ownerUserId,
          identifier: username,
        }) || verification.error;
      }

      clearLocalLoginFailures({
        namespace: 'offline-operator',
        ownerUserId: activation.ownerUserId,
        identifier: username,
      });

      clearSystemTemporarySessionPreference();
      await supabase.auth.signOut({ scope: 'local' });

      applyLocalOfflineSession({
        source: 'offline-operator',
        role: normalizeOfflineStaffRole(verification.record.role),
        userId: verification.record.userId,
        ownerUserId: verification.record.ownerUserId,
        username: verification.record.username,
        email: verification.record.email,
        authenticatedAt: new Date().toISOString(),
      });

      return true;
    };

    if (isDesktopRuntime() && typeof navigator !== 'undefined' && navigator.onLine === false) {
      return tryOfflineOperatorLogin();
    }

    let captchaToken: string | undefined;
    try {
      captchaToken = await requestTurnstileToken('app-operator-login');
    } catch (error) {
      return getPublicAuthErrorMessage(error, 'Nao foi possivel concluir a verificacao de seguranca.');
    }

    const { data, error } = await supabase.functions.invoke<OperatorLoginResponse>('operator-login', {
      body: {
        username,
        password,
        ownerUserId: activation?.ownerUserId ?? null,
        captchaToken,
      },
    }).catch((error) => ({ data: null, error }));

    if (error || !data?.success || !data.session?.access_token || !data.session?.refresh_token) {
      if (isDesktopRuntime() && isProbablyOfflineError(error)) {
        return tryOfflineOperatorLogin();
      }

      let functionErrorMessage = data?.error || 'Usuário ou senha incorretos.';

      if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
        try {
          const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
          functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
        } catch {
          functionErrorMessage = 'Usuário ou senha incorretos.';
        }
      }

      return getPublicAuthErrorMessage(functionErrorMessage, 'Usuário ou senha incorretos.');
    }

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });

    if (setSessionError) {
      return getPublicAuthErrorMessage(setSessionError, 'Nao foi possivel iniciar a sessao do operador.');
    }

    try {
      const { data: authenticatedUserData, error: authenticatedUserError } = await supabase.auth.getUser(data.session.access_token);
      if (authenticatedUserError || !authenticatedUserData.user) {
        await supabase.auth.signOut({ scope: 'local' });
        return 'Nao foi possivel validar esta sessao do operador.';
      }

      await fetchProfile(authenticatedUserData.user);
    } catch (profileError) {
      await supabase.auth.signOut({ scope: 'local' });
      if (profileError instanceof Error && profileError.message === SYSTEM_PRODUCT_CONTEXT_MISMATCH) {
        return SYSTEM_PRODUCT_CONTEXT_MISMATCH_MESSAGE;
      }
      if (profileError instanceof Error && profileError.message === DESKTOP_ACTIVATION_OWNER_MISMATCH) {
        return activation?.ownerUserId
          ? `Este login nao pertence a empresa ativada neste desktop: ${activation.companyName}.`
          : 'Nao foi possivel validar esta sessao do operador.';
      }
      return 'Nao foi possivel validar esta sessao do operador.';
    }

    if (
      isDesktopRuntime()
      && activation?.ownerUserId
      && data.operator?.userId
      && data.operator.role !== 'hr'
      && (data.operator.ownerUserId ?? activation.ownerUserId) === activation.ownerUserId
    ) {
      try {
        await saveOfflineOperatorAccess({
          userId: data.operator.userId,
          ownerUserId: activation.ownerUserId,
          username: data.operator.username ?? username,
          email: data.operator.email ?? null,
          role: normalizeOfflineStaffRole(data.operator.role),
          secret: password,
        });
      } catch (offlineAccessError) {
        console.error('Nao foi possivel salvar o acesso offline do operador:', getRedactedLogValue(offlineAccessError));
      }
    }

    return true;
  };

  const register = async (email: string, password: string, uname: string): Promise<string | true> => {
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) return passwordError;

    const profileDb = supabase as unknown as ProfileCountClient;
    const { count } = await profileDb
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');
    if ((count ?? 0) >= 2) return 'Limite de 2 administradores atingido.';

    let captchaToken: string | undefined;
    try {
      captchaToken = await requestTurnstileToken('app-signup');
    } catch (error) {
      return getPublicAuthErrorMessage(error, 'Nao foi possivel concluir a verificacao de seguranca.');
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: uname, role: 'admin' }, captchaToken }
    });
    if (error) return getPublicErrorMessage(error, 'Nao foi possivel criar o administrador.');
    return true;
  };

  const registerPasskey = async () => {
    const supportError = getPasskeySupportErrorMessage();
    if (supportError) {
      throw new Error(supportError);
    }

    const { data, error } = await supabase.auth.registerPasskey();
    if (error || !data) {
      throw new Error(getPasskeyErrorMessage(error, 'Nao foi possivel cadastrar a biometria.'));
    }

    return data;
  };

  const listPasskeys = async () => {
    const supportError = getPasskeySupportErrorMessage();
    if (supportError) {
      throw new Error(supportError);
    }

    const { data, error } = await supabase.auth.passkey.list();
    if (error || !data) {
      throw new Error(getPasskeyErrorMessage(error, 'Nao foi possivel carregar as biometrias cadastradas.'));
    }

    return data;
  };

  const deletePasskey = async (passkeyId: string) => {
    const supportError = getPasskeySupportErrorMessage();
    if (supportError) {
      throw new Error(supportError);
    }

    const { error } = await supabase.auth.passkey.delete({ passkeyId });
    if (error) {
      throw new Error(getPasskeyErrorMessage(error, 'Nao foi possivel remover esta biometria.'));
    }
  };

  const logout = async () => {
    if (session?.access_token) {
      await trackSystemAccessEvent(session.access_token, 'logout');
    }

    clearSystemClientSessionId();
    clearSystemTemporarySessionPreference();

    if (localOfflineSession) {
      resetAuthState();
      await supabase.auth.signOut({ scope: 'local' });
      return;
    }

    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        username,
        profileEmail,
        role,
        ownerUserId,
        isAdmin: role === 'admin',
        isOperator: role === 'operator',
        login,
        signInWithGoogle,
        signInWithPasskey,
        loginOfflineAdmin,
        loginOperator,
        register,
        registerPasskey,
        listPasskeys,
        deletePasskey,
        logout,
        isAuthenticated: !!user,
        isHr: role === 'hr',
        isLocalOfflineSession: Boolean(localOfflineSession),
        refreshProfile,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

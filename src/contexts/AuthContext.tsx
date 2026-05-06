import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@/lib/access';
import { clearSystemTemporarySessionPreference, enforceSystemSessionPreference } from '@/lib/authSessionPreferences';
import {
  ACCESS_HEARTBEAT_INTERVAL_MS,
  clearSystemClientSessionId,
  trackSystemAccessEvent,
} from '@/lib/accessTracking';
import { getActivatedDesktopOwnerUserId, readDesktopActivation } from '@/lib/desktopActivation';
import { isDesktopRuntime, isProbablyOfflineError } from '@/lib/offlineConcentrator';
import { getPasswordPolicyError } from '../../shared/security/passwordPolicy';
import { retryAsync } from '../../shared/network/retry';

interface UserProfile {
  username: string | null;
  email: string | null;
  role: UserRole;
  owner_user_id: string | null;
}

interface ProfileQueryRow {
  username?: string | null;
  email?: string | null;
  role?: string | null;
  owner_user_id?: string | null;
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
  login: (email: string, password: string) => Promise<string | true>;
  loginOperator: (username: string, password: string) => Promise<string | true>;
  register: (email: string, password: string, username: string) => Promise<string | true>;
  resetPassword: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

interface OperatorLoginResponse {
  success?: boolean;
  session?: {
    access_token?: string;
    refresh_token?: string;
  };
  error?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);
const profileCacheKey = (userId: string) => `happycash:system:profile:${userId}`;

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
  const [loading, setLoading] = useState(true);

  const resetAuthState = useCallback(() => {
    setSession(null);
    setUser(null);
    setUsername(null);
    setProfileEmail(null);
    setRole('admin');
    setOwnerUserId(null);
  }, []);

  const clearLocalSession = useCallback(() => {
    window.setTimeout(() => {
      clearSystemTemporarySessionPreference();
      void supabase.auth.signOut({ scope: 'local' });
    }, 0);
  }, []);

  const fetchProfile = useCallback(async (currentUser: User): Promise<UserProfile> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, email, role, owner_user_id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.error('Erro ao carregar perfil do usuário:', error);
      }

      const profile = (data ?? null) as ProfileQueryRow | null;

      const resolvedProfile = {
        username: profile?.username ?? null,
        email: profile?.email ?? currentUser.email ?? null,
        role: profile?.role === 'operator' ? 'operator' : 'admin',
        owner_user_id: profile?.owner_user_id ?? currentUser.id,
      };

      const activatedOwnerUserId = getActivatedDesktopOwnerUserId();
      if (isDesktopRuntime() && activatedOwnerUserId && resolvedProfile.owner_user_id !== activatedOwnerUserId) {
        throw new Error('DESKTOP_ACTIVATION_OWNER_MISMATCH');
      }

      writeCachedProfile(currentUser.id, resolvedProfile);
      return resolvedProfile;
    } catch (error) {
      if (error instanceof Error && error.message === 'DESKTOP_ACTIVATION_OWNER_MISMATCH') {
        throw error;
      }

      console.error('Erro inesperado ao carregar perfil do usuário:', error);

      const cachedProfile = readCachedProfile(currentUser.id);
      if (cachedProfile && isDesktopRuntime() && isProbablyOfflineError(error)) {
        return cachedProfile;
      }

      return {
        username: null,
        email: currentUser.email ?? null,
        role: 'admin',
        owner_user_id: currentUser.id,
      };
    }
  }, []);

  const syncProfileState = useCallback(async (currentUser: User) => {
    const profile = await fetchProfile(currentUser);
    setUsername(profile.username);
    setProfileEmail(profile.email);
    setRole(profile.role);
    setOwnerUserId(profile.owner_user_id ?? currentUser.id);
  }, [fetchProfile]);

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
            resetAuthState();
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

          console.error('Erro ao validar sessão do Supabase:', error);
          resetAuthState();
          clearLocalSession();
          return;
        }

        setSession(nextSession);
        setUser(data.user);
        await syncProfileState(data.user);
      } catch (error) {
        if (!isMounted || currentRequestId !== syncRequestId) return;

        console.error('Erro ao sincronizar autenticação:', error);
        resetAuthState();
        if (error instanceof Error && error.message === 'DESKTOP_ACTIVATION_OWNER_MISMATCH') {
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
          console.error('Erro ao recuperar sessão do Supabase:', error);
          resetAuthState();
          setLoading(false);
          return;
        }

        await syncAuthState(nextSession);
      } catch (error) {
        if (!isMounted) return;

        console.error('Erro ao inicializar autenticação:', error);
        resetAuthState();
        if (error instanceof Error && error.message === 'DESKTOP_ACTIVATION_OWNER_MISMATCH') {
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
  }, [clearLocalSession, resetAuthState, syncProfileState]);

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

  const login = async (email: string, password: string): Promise<string | true> => {
    const activation = readDesktopActivation();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return error ? error.message : 'Nao foi possivel iniciar a sessao.';

    if (activation?.ownerUserId) {
      try {
        const profile = await fetchProfile(data.user);
        if ((profile.owner_user_id ?? data.user.id) !== activation.ownerUserId) {
          await supabase.auth.signOut({ scope: 'local' });
          return `Este login nao pertence a empresa ativada neste desktop: ${activation.companyName}.`;
        }
      } catch (activationError) {
        await supabase.auth.signOut({ scope: 'local' });
        if (activationError instanceof Error && activationError.message === 'DESKTOP_ACTIVATION_OWNER_MISMATCH') {
          return `Este login nao pertence a empresa ativada neste desktop: ${activation.companyName}.`;
        }
        return 'Nao foi possivel validar a empresa desta sessao.';
      }
    }

    return true;
  };

  const loginOperator = async (username: string, password: string): Promise<string | true> => {
    const activation = readDesktopActivation();
    const { data, error } = await supabase.functions.invoke<OperatorLoginResponse>('operator-login', {
      body: {
        username,
        password,
        ownerUserId: activation?.ownerUserId ?? null,
      },
    });

    if (error || !data?.success || !data.session?.access_token || !data.session?.refresh_token) {
      let functionErrorMessage = data?.error || 'Usuário ou senha incorretos.';

      if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
        try {
          const errorPayload = await error.context.clone().json() as { error?: string; message?: string };
          functionErrorMessage = errorPayload.error || errorPayload.message || functionErrorMessage;
        } catch {
          functionErrorMessage = 'Usuário ou senha incorretos.';
        }
      }

      return functionErrorMessage;
    }

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });

    return setSessionError ? setSessionError.message : true;
  };

  const register = async (email: string, password: string, uname: string): Promise<string | true> => {
    const passwordError = getPasswordPolicyError(password);
    if (passwordError) return passwordError;

    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');
    if ((count ?? 0) >= 2) return 'Limite de 2 administradores atingido.';

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: uname, role: 'admin' } }
    });
    if (error) return error.message;
    return true;
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    return !error;
  };

  const logout = async () => {
    if (session?.access_token) {
      await trackSystemAccessEvent(session.access_token, 'logout');
    }

    clearSystemClientSessionId();
    clearSystemTemporarySessionPreference();
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
        loginOperator,
        register,
        resetPassword,
        logout,
        isAuthenticated: !!user,
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

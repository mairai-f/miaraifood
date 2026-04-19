import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import type { UserRole } from '@/lib/access';
import { clearSystemTemporarySessionPreference, enforceSystemSessionPreference } from '@/lib/authSessionPreferences';

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

      return {
        username: profile?.username ?? null,
        email: profile?.email ?? currentUser.email ?? null,
        role: profile?.role === 'operator' ? 'operator' : 'admin',
        owner_user_id: profile?.owner_user_id ?? currentUser.id,
      };
    } catch (error) {
      console.error('Erro inesperado ao carregar perfil do usuário:', error);

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

        const { data, error } = await supabase.auth.getUser(nextSession.access_token);

        if (!isMounted || currentRequestId !== syncRequestId) return;

        if (error || !data.user) {
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
        const { data: { session: nextSession }, error } = await supabase.auth.getSession();
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
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      syncRequestId += 1;
      subscription.unsubscribe();
    };
  }, [clearLocalSession, resetAuthState, syncProfileState]);

  const login = async (email: string, password: string): Promise<string | true> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : true;
  };

  const loginOperator = async (username: string, password: string): Promise<string | true> => {
    const { data, error } = await supabase.functions.invoke<OperatorLoginResponse>('operator-login', {
      body: {
        username,
        password,
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

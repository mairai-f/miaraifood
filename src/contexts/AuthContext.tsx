import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  username: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, username: string) => Promise<string | true>;
  resetPassword: (email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearLocalSession = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setUser(null);
    setUsername(null);
  };

  const fetchUsername = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('username').eq('user_id', userId).single();
    setUsername(data?.username ?? null);
  };

  useEffect(() => {
    let isMounted = true;

    const syncAuthState = async (nextSession: Session | null) => {
      if (!isMounted) return;

      if (!nextSession?.access_token) {
        setSession(null);
        setUser(null);
        setUsername(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.getUser(nextSession.access_token);
      if (!isMounted) return;

      if (error || !data.user) {
        console.error('Erro ao validar sessão do Supabase:', error);
        await clearLocalSession();
        if (isMounted) setLoading(false);
        return;
      }

      setSession(nextSession);
      setUser(data.user);
      void fetchUsername(data.user.id);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      await syncAuthState(nextSession);
    });

    supabase.auth.getSession().then(async ({ data: { session: nextSession }, error }) => {
      if (!isMounted) return;

      if (error) {
        console.error('Erro ao recuperar sessão do Supabase:', error);
        await clearLocalSession();
        if (isMounted) setLoading(false);
        return;
      }

      await syncAuthState(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return !error;
  };

  const register = async (email: string, password: string, uname: string): Promise<string | true> => {
    // Check admin limit
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    if ((count ?? 0) >= 2) return 'Limite de 2 administradores atingido.';

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: uname } }
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
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, username, login, register, resetPassword, logout, isAuthenticated: !!user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

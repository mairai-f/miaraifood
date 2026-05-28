import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { validateAgendaAdminAccess } from "@/lib/agendaAuth";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; isAdmin: boolean }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isAgendaAdminProfile = async (userId: string) => {
  const { data: profileAdmin } = await supabase
    .from("profiles")
    .select("role")
    .eq("role", "admin")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileAdmin) return true;

  const { data: roleAdmin } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return !!roleAdmin;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const syncAdminAccess = async (userId: string) => {
    const adminProfile = await isAgendaAdminProfile(userId);
    if (!adminProfile) {
      setIsAdmin(false);
      return false;
    }

    const access = await validateAgendaAdminAccess(userId);
    if (!access.ok) {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      return false;
    }

    setIsAdmin(true);
    return true;
  };

  useEffect(() => {
    const applySession = async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await syncAdminAccess(nextSession.user.id);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setLoading(true);
      setTimeout(() => {
        void applySession(nextSession);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      void applySession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user) {
      setIsAdmin(false);
      return { error: error ?? new Error("Nao foi possivel entrar."), isAdmin: false };
    }

    const adminProfile = await isAgendaAdminProfile(data.user.id);
    if (adminProfile) {
      const access = await validateAgendaAdminAccess(data.user.id);
      if (!access.ok) {
        await supabase.auth.signOut();
        setIsAdmin(false);
        return { error: new Error(access.message), isAdmin: false };
      }
    }

    setIsAdmin(adminProfile);
    return { error: null, isAdmin: adminProfile };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        signIn,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

import { createClient } from "@supabase/supabase-js";
import type { FoodUser } from "@/types";

type FoodProfileRow = {
  username: string | null;
  email: string | null;
  role: string | null;
  owner_user_id: string | null;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const foodSupabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "happycash:food:auth",
      },
    })
  : null;

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const signInFoodAdmin = async (
  email: string,
  password: string,
  users: FoodUser[],
): Promise<FoodUser> => {
  if (!foodSupabase) {
    throw new Error("Supabase nao esta configurado para o HappyCashFood.");
  }

  const normalizedEmail = normalizeEmail(email);
  const { data: authData, error: authError } = await foodSupabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (authError || !authData.user) {
    throw new Error(authError?.message || "Email ou senha invalidos.");
  }

  const { data: profile, error: profileError } = await foodSupabase
    .from("profiles")
    .select("username, email, role, owner_user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle<FoodProfileRow>();

  if (profileError) {
    throw new Error("Nao foi possivel validar seu perfil de acesso.");
  }

  if (profile?.role !== "admin") {
    throw new Error("Este login nao possui perfil administrador do HappyCashFood.");
  }

  const adminUser = users.find((user) => user.role === "admin") ?? users[0];

  if (!adminUser) {
    throw new Error("Usuario administrador nao encontrado no HappyCashFood.");
  }

  return {
    ...adminUser,
    id: authData.user.id,
    name: profile.username || normalizedEmail,
    username: profile.username || normalizedEmail,
    role: "admin",
  };
};

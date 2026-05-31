import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { FoodUser } from "@/types";
import {
  isCurrentSubscriptionPlanAllowedForProductContext,
  normalizeProductContext,
  type ProductContext,
} from "../../../shared/productContext";
import { createAdaptiveStorage } from "../../../shared/security/browserStorage";
import { createKeepConnectedReader } from "../../../shared/security/authPersistence";
import { getPublicErrorMessage } from "../../../shared/security/redaction";
import { cleanupLegacySupabaseAuthStorage } from "../../../shared/security/supabaseAuthStorage";

type FoodProfileRow = {
  username: string | null;
  email: string | null;
  role: string | null;
  owner_user_id: string | null;
};

type FoodStoreAccountRow = {
  product_context: ProductContext | null;
};

type FoodSubscriptionRow = {
  plan_id: string;
  status: string;
  current_period_ends_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const FOOD_AUTH_STORAGE_KEY = "happycash:food:auth";
const shouldPersistFoodSession = createKeepConnectedReader("happycash:food:keep-connected", false);

cleanupLegacySupabaseAuthStorage(FOOD_AUTH_STORAGE_KEY);

export const foodSupabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: createAdaptiveStorage(shouldPersistFoodSession),
        persistSession: true,
        autoRefreshToken: true,
        storageKey: FOOD_AUTH_STORAGE_KEY,
      },
    })
  : null;

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const activeSubscriptionStatuses = new Set(["trialing", "active", "past_due"]);

const getSubscriptionEndAt = (subscription: FoodSubscriptionRow | null | undefined) => {
  if (!subscription) return null;
  if (subscription.status === "trialing") {
    return subscription.trial_ends_at ?? subscription.current_period_ends_at ?? null;
  }
  return subscription.current_period_ends_at ?? subscription.trial_ends_at ?? null;
};

const isCurrentSubscription = (subscription: FoodSubscriptionRow | null | undefined) => {
  if (!subscription || !activeSubscriptionStatuses.has(subscription.status)) return false;
  const endAt = getSubscriptionEndAt(subscription);
  if (!endAt) return true;
  return new Date(endAt).getTime() > Date.now();
};

const resolveResetRedirectUrl = () => {
  const siteUrl = (import.meta.env.VITE_HAPPYCASH_SITE_URL as string | undefined)?.trim() || "https://www.happycashsite.com.br";
  return `${siteUrl.replace(/\/+$/, "")}/reset-password`;
};

const resolveFoodOAuthRedirectUrl = () => {
  if (typeof window === "undefined" || !/^https?:$/.test(window.location.protocol)) {
    return null;
  }

  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
};

const resolveFoodAdminUser = async (authUser: User, users: FoodUser[]): Promise<FoodUser> => {
  if (!foodSupabase) {
    throw new Error("Supabase nao esta configurado para o HappyCashFood.");
  }

  const normalizedEmail = normalizeEmail(authUser.email ?? "");

  const { data: profile, error: profileError } = await foodSupabase
    .from("profiles")
    .select("username, email, role, owner_user_id")
    .eq("user_id", authUser.id)
    .maybeSingle<FoodProfileRow>();

  if (profileError) {
    throw new Error("Nao foi possivel validar seu perfil de acesso.");
  }

  if (profile?.role !== "admin") {
    throw new Error("Este login nao possui perfil administrador do HappyCashFood.");
  }

  const ownerUserId = profile.owner_user_id ?? authUser.id;
  const [
    { data: storeAccount, error: storeAccountError },
    { data: subscriptions, error: subscriptionsError },
  ] = await Promise.all([
    foodSupabase
      .from("store_accounts")
      .select("product_context")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle<FoodStoreAccountRow>(),
    foodSupabase
      .from("store_subscriptions")
      .select("plan_id, status, current_period_ends_at, trial_ends_at, created_at")
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false }),
  ]);

  if (storeAccountError || subscriptionsError) {
    throw new Error("Nao foi possivel validar a assinatura do HappyCashFood.");
  }

  const accountProductContext = normalizeProductContext(storeAccount?.product_context);
  if (accountProductContext !== "happycashfood") {
    throw new Error("Esta conta pertence ao HappyCash. Entre no sistema correto.");
  }

  const subscriptionRows = ((subscriptions as FoodSubscriptionRow[] | null) || []).filter((subscription) =>
    isCurrentSubscriptionPlanAllowedForProductContext("happycashfood", subscription.plan_id),
  );
  const currentSubscription = subscriptionRows.find(isCurrentSubscription) ?? subscriptionRows[0] ?? null;

  if (!currentSubscription || !isCurrentSubscription(currentSubscription)) {
    throw new Error("Esta conta nao possui acesso ativo ao HappyCashFood.");
  }

  const adminUser = users.find((user) => user.role === "admin") ?? users[0];

  if (!adminUser) {
    throw new Error("Usuario administrador nao encontrado no HappyCashFood.");
  }

  return {
    ...adminUser,
    id: authUser.id,
    name: profile.username || normalizedEmail,
    username: profile.username || normalizedEmail,
    role: "admin",
    ownerUserId,
  };
};

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
    throw new Error(getPublicErrorMessage(authError, "Email ou senha invalidos."));
  }

  try {
    return await resolveFoodAdminUser(authData.user, users);
  } catch (error) {
    await foodSupabase.auth.signOut();
    throw error;
  }
};

export const signInFoodAdminWithGoogle = async () => {
  if (!foodSupabase) {
    throw new Error("Supabase nao esta configurado para o HappyCashFood.");
  }

  const redirectTo = resolveFoodOAuthRedirectUrl();
  if (!redirectTo) {
    throw new Error("Login com Google disponivel apenas na versao web.");
  }

  const { error } = await foodSupabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    throw new Error(getPublicErrorMessage(error, "Nao foi possivel iniciar o login com Google."));
  }
};

export const restoreFoodAdminSession = async (users: FoodUser[]) => {
  if (!foodSupabase) return null;

  const { data: { session }, error } = await foodSupabase.auth.getSession();
  if (error || !session?.user) {
    return null;
  }

  try {
    return await resolveFoodAdminUser(session.user, users);
  } catch (sessionError) {
    await foodSupabase.auth.signOut();
    throw sessionError;
  }
};

export const signOutFoodAdmin = async () => {
  if (!foodSupabase) return;
  await foodSupabase.auth.signOut();
};

export const requestFoodPasswordReset = async (email: string) => {
  if (!foodSupabase) {
    throw new Error("Supabase nao esta configurado para o HappyCashFood.");
  }

  const normalizedEmail = normalizeEmail(email);
  const { error } = await foodSupabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: resolveResetRedirectUrl(),
  });

  if (error) {
    throw new Error(getPublicErrorMessage(error, "Nao foi possivel enviar o email de redefinicao."));
  }
};

import { menuAdminSupabase } from "@/lib/supabase";
import { getPublicErrorMessage } from "../../../shared/security/redaction";

type MenuProfileRow = {
  username: string | null;
  email: string | null;
  role: string | null;
  owner_user_id: string | null;
};

type StoreAccountRow = {
  id: string;
  owner_user_id: string;
  product_context: "happycash" | "happycashfood" | null;
};

type SubscriptionRow = {
  plan_id: string;
  status: string;
  current_period_ends_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
};

const activeSubscriptionStatuses = new Set(["trialing", "active", "past_due"]);
const foodPlanIds = new Set(["food", "food_offline"]);

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const getSubscriptionEndAt = (subscription: SubscriptionRow | null | undefined) => {
  if (!subscription) return null;
  if (subscription.status === "trialing") {
    return subscription.trial_ends_at ?? subscription.current_period_ends_at ?? null;
  }
  return subscription.current_period_ends_at ?? subscription.trial_ends_at ?? null;
};

const isCurrentSubscription = (subscription: SubscriptionRow | null | undefined) => {
  if (!subscription || !foodPlanIds.has(subscription.plan_id) || !activeSubscriptionStatuses.has(subscription.status)) return false;
  const endAt = getSubscriptionEndAt(subscription);
  return !endAt || new Date(endAt).getTime() > Date.now();
};

const resolveResetRedirectUrl = () => {
  const siteUrl = (import.meta.env.VITE_HAPPYCASH_SITE_URL as string | undefined)?.trim() || "https://www.happycashsite.com.br";
  return `${siteUrl.replace(/\/+$/, "")}/reset-password`;
};

export const signInMenuAdmin = async (email: string, password: string) => {
  const normalizedEmail = normalizeEmail(email);
  const { data: authData, error: authError } = await menuAdminSupabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (authError || !authData.user) {
    throw new Error(getPublicErrorMessage(authError, "Email ou senha invalidos."));
  }

  const { data: profile, error: profileError } = await menuAdminSupabase
    .from("profiles")
    .select("username, email, role, owner_user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle<MenuProfileRow>();

  if (profileError) {
    await menuAdminSupabase.auth.signOut();
    throw new Error("Nao foi possivel validar seu perfil de acesso.");
  }

  if (profile?.role !== "admin") {
    await menuAdminSupabase.auth.signOut();
    throw new Error("Este login nao possui perfil administrador do HappyCashFood.");
  }

  const ownerUserId = profile.owner_user_id ?? authData.user.id;
  const [{ data: account, error: accountError }, { data: subscriptions, error: subscriptionError }] = await Promise.all([
    menuAdminSupabase
      .from("store_accounts")
      .select("id, owner_user_id, product_context")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle<StoreAccountRow>(),
    menuAdminSupabase
      .from("store_subscriptions")
      .select("plan_id, status, current_period_ends_at, trial_ends_at, created_at")
      .eq("owner_user_id", ownerUserId)
      .order("created_at", { ascending: false }),
  ]);

  if (accountError || subscriptionError) {
    await menuAdminSupabase.auth.signOut();
    throw new Error("Nao foi possivel validar a assinatura do HappyCashFood.");
  }

  if (account?.product_context !== "happycashfood") {
    await menuAdminSupabase.auth.signOut();
    throw new Error("Esta conta pertence ao HappyCash. Entre no sistema correto.");
  }

  const currentSubscription = ((subscriptions as SubscriptionRow[] | null) || []).find(isCurrentSubscription) ?? null;
  if (!currentSubscription) {
    await menuAdminSupabase.auth.signOut();
    throw new Error("Esta conta nao possui acesso ativo ao HappyCashFood.");
  }

  return {
    id: authData.user.id,
    name: profile.username || profile.email || normalizedEmail,
    email: profile.email || normalizedEmail,
  };
};

export const requestMenuAdminPasswordReset = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);
  const { error } = await menuAdminSupabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: resolveResetRedirectUrl(),
  });

  if (error) {
    throw new Error(getPublicErrorMessage(error, "Nao foi possivel enviar o email de redefinicao."));
  }
};

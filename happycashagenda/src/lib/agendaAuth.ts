import { supabase } from "@/integrations/supabase/client";
import {
  isCurrentSubscriptionPlanAllowedForProductContext,
  normalizeProductContext,
  type ProductContext,
} from "../../../shared/productContext";

type StoreAccountRow = {
  product_context: ProductContext | null;
};

type SubscriptionRow = {
  plan_id: string;
  status: string;
  current_period_ends_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
};

const AGENDA_CONTEXT: ProductContext = "happycashagenda";
const activeSubscriptionStatuses = new Set(["trialing", "active", "past_due"]);

export const AGENDA_PRODUCT_CONTEXT_MISMATCH =
  "Esta conta pertence a outro sistema HappyCash. Entre no modulo correto.";

export const AGENDA_SUBSCRIPTION_INACTIVE =
  "Esta conta nao possui acesso ativo ao HappyCash Agenda.";

const getSubscriptionEndAt = (subscription: SubscriptionRow | null | undefined) => {
  if (!subscription) return null;
  if (subscription.status === "trialing") {
    return subscription.trial_ends_at ?? subscription.current_period_ends_at ?? null;
  }
  return subscription.current_period_ends_at ?? subscription.trial_ends_at ?? null;
};

const isCurrentSubscription = (subscription: SubscriptionRow | null | undefined) => {
  if (!subscription || !activeSubscriptionStatuses.has(subscription.status)) return false;
  const endAt = getSubscriptionEndAt(subscription);
  if (!endAt) return true;
  return new Date(endAt).getTime() > Date.now();
};

export async function resolveAgendaOwnerUserId(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("owner_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return profile?.owner_user_id ?? userId;
}

export async function validateAgendaStoreAccess(ownerUserId: string) {
  const [
    { data: storeAccount, error: storeAccountError },
    { data: subscriptions, error: subscriptionsError },
  ] = await Promise.all([
    supabase
      .from("store_accounts")
      .select("product_context")
      .eq("owner_user_id", ownerUserId)
      .eq("product_context", AGENDA_CONTEXT)
      .maybeSingle<StoreAccountRow>(),
    supabase
      .from("store_subscriptions")
      .select("plan_id, status, current_period_ends_at, trial_ends_at, created_at")
      .eq("owner_user_id", ownerUserId)
      .eq("product_context", AGENDA_CONTEXT)
      .order("created_at", { ascending: false }),
  ]);

  if (storeAccountError || subscriptionsError) {
    return { ok: false as const, message: "Nao foi possivel validar a assinatura do HappyCash Agenda." };
  }

  const accountProductContext = normalizeProductContext(storeAccount?.product_context);
  if (accountProductContext !== AGENDA_CONTEXT) {
    return { ok: false as const, message: AGENDA_PRODUCT_CONTEXT_MISMATCH };
  }

  const subscriptionRows = ((subscriptions as SubscriptionRow[] | null) || []).filter((subscription) =>
    isCurrentSubscriptionPlanAllowedForProductContext(AGENDA_CONTEXT, subscription.plan_id),
  );
  const currentSubscription = subscriptionRows.find(isCurrentSubscription) ?? subscriptionRows[0] ?? null;

  if (!currentSubscription || !isCurrentSubscription(currentSubscription)) {
    return { ok: false as const, message: AGENDA_SUBSCRIPTION_INACTIVE };
  }

  return { ok: true as const };
}

export async function validateAgendaAdminAccess(userId: string) {
  const ownerUserId = await resolveAgendaOwnerUserId(userId);
  return validateAgendaStoreAccess(ownerUserId);
}

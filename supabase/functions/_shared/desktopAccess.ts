import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  isCurrentSubscriptionPlanAllowedForProductContext,
  isDesktopPlanAllowedForProductContext,
  normalizeProductContext,
  resolveProductContextFromPlanId,
  type ProductContext,
} from "./productContext.ts";

export type SupportedDesktopPlatform = "windows" | "linux" | "linux-deb" | "linux-appimage";

interface StoreSubscriptionRow {
  plan_id: string;
  status: string;
  current_period_ends_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
}

interface SubscriptionPlanFeatureRow {
  feature_key: string;
}

interface ProfileOwnershipRow {
  role: string | null;
  owner_user_id: string | null;
}

export interface DesktopLicenseValidationResult {
  ok: boolean;
  code?: string;
  message?: string;
  planId: string | null;
  status: string | null;
  validUntil: string | null;
  features: string[];
  offlineEnabled: boolean;
}

const activeSubscriptionStatuses = new Set(["trialing", "active", "past_due"]);
const staffRoles = new Set(["operator", "waiter", "hr"]);
const requiredFeatureKeys = ["desktop.app", "offline.access"] as const;
const getSubscriptionEndAt = (subscription: StoreSubscriptionRow | null | undefined) => {
  if (!subscription) return null;

  if (subscription.status === "trialing") {
    return subscription.trial_ends_at ?? subscription.current_period_ends_at ?? null;
  }

  return subscription.current_period_ends_at ?? subscription.trial_ends_at ?? null;
};

export const isCurrentSubscription = (subscription: StoreSubscriptionRow | null | undefined) => {
  if (!subscription || !activeSubscriptionStatuses.has(subscription.status)) return false;

  const endAt = getSubscriptionEndAt(subscription);
  if (!endAt) return true;

  return new Date(endAt).getTime() > Date.now();
};

export const validateDesktopLicense = async (
  serviceClient: SupabaseClient,
  userId: string,
  productContext?: ProductContext,
): Promise<DesktopLicenseValidationResult> => {
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role, owner_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const ownershipProfile = (profile as ProfileOwnershipRow | null) ?? null;
  const ownerUserId = ownershipProfile?.role && staffRoles.has(ownershipProfile.role) && ownershipProfile.owner_user_id
    ? ownershipProfile.owner_user_id
    : userId;

  const { data: subscriptions, error: subscriptionsError } = await serviceClient
    .from("store_subscriptions")
    .select("plan_id, status, current_period_ends_at, trial_ends_at, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });

  if (subscriptionsError) {
    return {
      ok: false,
      code: "SUBSCRIPTION_LOOKUP_FAILED",
      message: "Nao foi possivel validar sua licenca desktop agora.",
      planId: null,
      status: null,
      validUntil: null,
      features: [],
      offlineEnabled: false,
    };
  }

  const subscriptionRows = (subscriptions as StoreSubscriptionRow[] | null) ?? [];
  const explicitProductContext = productContext ? normalizeProductContext(productContext) : null;
  const compatibleSubscriptions = subscriptionRows.filter((subscription) =>
    isCurrentSubscriptionPlanAllowedForProductContext(
      explicitProductContext ?? resolveProductContextFromPlanId(subscription.plan_id),
      subscription.plan_id,
    ),
  );
  const currentSubscription = compatibleSubscriptions.find(isCurrentSubscription) ?? compatibleSubscriptions[0] ?? null;
  const validUntil = getSubscriptionEndAt(currentSubscription);
  const normalizedProductContext = explicitProductContext ?? resolveProductContextFromPlanId(currentSubscription?.plan_id);

  const hasActiveDesktopPlan = Boolean(
    currentSubscription
    && isDesktopPlanAllowedForProductContext(normalizedProductContext, currentSubscription.plan_id)
    && currentSubscription.status === "active"
    && isCurrentSubscription(currentSubscription),
  );

  if (!hasActiveDesktopPlan) {
    return {
      ok: false,
      code: "PRO_ACTIVE_REQUIRED",
      message: "O aplicativo desktop do HappyCash libera somente apos a confirmacao do pagamento do plano PRO.",
      planId: currentSubscription?.plan_id ?? null,
      status: currentSubscription?.status ?? null,
      validUntil,
      features: [],
      offlineEnabled: false,
    };
  }

  const { data: featureRows, error: featureError } = await serviceClient
    .from("subscription_plan_features")
    .select("feature_key")
    .eq("plan_id", currentSubscription.plan_id)
    .eq("enabled", true)
    .in("feature_key", [...requiredFeatureKeys]);

  if (featureError) {
    return {
      ok: false,
      code: "FEATURE_LOOKUP_FAILED",
      message: "Nao foi possivel validar os recursos do plano desktop agora.",
      planId: currentSubscription.plan_id,
      status: currentSubscription.status,
      validUntil,
      features: [],
      offlineEnabled: false,
    };
  }

  const features = new Set(
    ((featureRows as SubscriptionPlanFeatureRow[] | null) ?? []).map((row) => row.feature_key),
  );

  if (!features.has("desktop.app")) {
    return {
      ok: false,
      code: "DESKTOP_NOT_INCLUDED",
      message: "Seu plano atual nao inclui acesso ao aplicativo desktop.",
      planId: currentSubscription.plan_id,
      status: currentSubscription.status,
      validUntil,
      features: [...features],
      offlineEnabled: features.has("offline.access"),
    };
  }

  return {
    ok: true,
    planId: currentSubscription.plan_id,
    status: currentSubscription.status,
    validUntil,
    features: [...features],
    offlineEnabled: features.has("offline.access"),
  };
};

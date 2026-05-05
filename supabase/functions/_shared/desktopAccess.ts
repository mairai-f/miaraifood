import { createClient } from "npm:@supabase/supabase-js@2";

import { upsertDesktopLicenseKey } from "./desktopLicenseKey.ts";

export type SupportedDesktopPlatform = "windows" | "linux" | "linux-deb" | "linux-appimage";

interface StoreSubscriptionRow {
  id: string;
  owner_user_id: string;
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
  subscriptionId: string | null;
  ownerUserId: string | null;
  planId: string | null;
  status: string | null;
  validUntil: string | null;
  offlineGraceUntil: string | null;
  offlineGraceDays: number;
  licenseKey: string | null;
  features: string[];
  offlineEnabled: boolean;
}

const activeSubscriptionStatuses = new Set(["trialing", "active", "past_due"]);
const requiredFeatureKeys = ["desktop.app", "offline.access"] as const;
const PRO_OFFLINE_GRACE_DAYS = 7;

const addDaysIso = (value: string | null, days: number) => {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;

  return new Date(timestamp + days * 24 * 60 * 60 * 1000).toISOString();
};

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
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
): Promise<DesktopLicenseValidationResult> => {
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("role, owner_user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const ownershipProfile = (profile as ProfileOwnershipRow | null) ?? null;
  const ownerUserId = ownershipProfile?.role === "operator" && ownershipProfile.owner_user_id
    ? ownershipProfile.owner_user_id
    : userId;

  const { data: subscriptions, error: subscriptionsError } = await serviceClient
    .from("store_subscriptions")
    .select("id, owner_user_id, plan_id, status, current_period_ends_at, trial_ends_at, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });

  if (subscriptionsError) {
    return {
      ok: false,
      code: "SUBSCRIPTION_LOOKUP_FAILED",
      message: "Nao foi possivel validar sua licenca desktop agora.",
      subscriptionId: null,
      ownerUserId,
      planId: null,
      status: null,
      validUntil: null,
      offlineGraceUntil: null,
      offlineGraceDays: PRO_OFFLINE_GRACE_DAYS,
      features: [],
      offlineEnabled: false,
      licenseKey: null,
    };
  }

  const subscriptionRows = (subscriptions as StoreSubscriptionRow[] | null) ?? [];
  const currentSubscription = subscriptionRows.find(isCurrentSubscription) ?? subscriptionRows[0] ?? null;
  const validUntil = getSubscriptionEndAt(currentSubscription);

  if (!currentSubscription || currentSubscription.plan_id !== "pro" || !isCurrentSubscription(currentSubscription)) {
    return {
      ok: false,
      code: "PRO_REQUIRED",
      message: "O aplicativo desktop esta disponivel apenas para contas com plano PRO ativo.",
      subscriptionId: currentSubscription?.id ?? null,
      ownerUserId,
      planId: currentSubscription?.plan_id ?? null,
      status: currentSubscription?.status ?? null,
      validUntil,
      offlineGraceUntil: addDaysIso(validUntil, PRO_OFFLINE_GRACE_DAYS),
      offlineGraceDays: PRO_OFFLINE_GRACE_DAYS,
      features: [],
      offlineEnabled: false,
      licenseKey: null,
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
      subscriptionId: currentSubscription.id,
      ownerUserId,
      planId: currentSubscription.plan_id,
      status: currentSubscription.status,
      validUntil,
      offlineGraceUntil: addDaysIso(validUntil, PRO_OFFLINE_GRACE_DAYS),
      offlineGraceDays: PRO_OFFLINE_GRACE_DAYS,
      features: [],
      offlineEnabled: false,
      licenseKey: null,
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
      subscriptionId: currentSubscription.id,
      ownerUserId,
      planId: currentSubscription.plan_id,
      status: currentSubscription.status,
      validUntil,
      offlineGraceUntil: addDaysIso(validUntil, PRO_OFFLINE_GRACE_DAYS),
      offlineGraceDays: PRO_OFFLINE_GRACE_DAYS,
      features: [...features],
      offlineEnabled: features.has("offline.access"),
      licenseKey: null,
    };
  }

  const licenseKey = await upsertDesktopLicenseKey(serviceClient, currentSubscription);

  return {
    ok: true,
    subscriptionId: currentSubscription.id,
    ownerUserId,
    planId: currentSubscription.plan_id,
    status: currentSubscription.status,
    validUntil,
    offlineGraceUntil: addDaysIso(validUntil, PRO_OFFLINE_GRACE_DAYS),
    offlineGraceDays: PRO_OFFLINE_GRACE_DAYS,
    features: [...features],
    offlineEnabled: features.has("offline.access"),
    licenseKey: licenseKey.licenseKey,
  };
};

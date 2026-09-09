import { COMMERCIAL_PAID_PLAN_IDS } from "./subscriptionPlanPricing";

export type ProductContext = "happycash";

// Deriva da tabela canônica: uma lista paralela já bloqueou a compra dos
// planos com os nomes novos, que respondiam 403 em create-plan-charge.
const HAPPYCASH_PAID_PLAN_IDS = new Set<string>(COMMERCIAL_PAID_PLAN_IDS);

export const normalizeProductContext = (value?: string | null): ProductContext => {
  return "happycash";
};

export const resolveProductContextFromPlanId = (planId?: string | null): ProductContext => {
  return "happycash";
};

export const isPaidPlanAllowedForProductContext = (
  productContext: ProductContext,
  planId?: string | null,
) => {
  const normalizedPlanId = (planId || "").trim().toLowerCase();

  return HAPPYCASH_PAID_PLAN_IDS.has(normalizedPlanId);
};

export const isCurrentSubscriptionPlanAllowedForProductContext = (
  productContext: ProductContext,
  planId?: string | null,
) => {
  const normalizedPlanId = (planId || "").trim().toLowerCase();
  if (!normalizedPlanId) return false;
  if (normalizedPlanId === "demo") return true;
  return isPaidPlanAllowedForProductContext(productContext, normalizedPlanId);
};

export const getPublicPlanIdsForProductContext = (_productContext: ProductContext) =>
  ["demo", ...COMMERCIAL_PAID_PLAN_IDS];

export const getProductContextLabel = (productContext: ProductContext) =>
  "MIAR AI/FOOD";

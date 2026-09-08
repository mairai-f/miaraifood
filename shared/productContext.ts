export type ProductContext = "happycash";

const HAPPYCASH_PAID_PLAN_IDS = new Set(["fiado", "completo", "pro"]);

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

export const getPublicPlanIdsForProductContext = (productContext: ProductContext) =>
  ["demo", "fiado", "completo", "pro"] as const;

export const getProductContextLabel = (productContext: ProductContext) =>
  "HappyCash";

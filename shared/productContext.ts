export type ProductContext = "happycash" | "happycashfood";

const FOOD_PLAN_IDS = new Set(["food", "food_offline"]);
const HAPPYCASH_PAID_PLAN_IDS = new Set(["fiado", "completo", "pro"]);

export const normalizeProductContext = (value?: string | null): ProductContext =>
  value?.trim().toLowerCase() === "happycashfood" ? "happycashfood" : "happycash";

export const resolveProductContextFromPlanId = (planId?: string | null): ProductContext =>
  FOOD_PLAN_IDS.has((planId || "").trim().toLowerCase()) ? "happycashfood" : "happycash";

export const isPaidPlanAllowedForProductContext = (
  productContext: ProductContext,
  planId?: string | null,
) => {
  const normalizedPlanId = (planId || "").trim().toLowerCase();

  if (productContext === "happycashfood") {
    return FOOD_PLAN_IDS.has(normalizedPlanId);
  }

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
  productContext === "happycashfood"
    ? ["food", "food_offline"] as const
    : ["demo", "fiado", "completo", "pro"] as const;

export const getProductContextLabel = (productContext: ProductContext) =>
  productContext === "happycashfood" ? "HappyCashFood" : "HappyCash";

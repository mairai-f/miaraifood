export type ProductContext = "happycash";

const HAPPYCASH_PAID_PLAN_IDS = new Set(["fiado", "completo", "pro"]);
const HAPPYCASH_DESKTOP_PLAN_IDS = new Set(["pro"]);

export const normalizeProductContext = (_value?: string | null): ProductContext => "happycash";

export const resolveProductContextFromPlanId = (_planId?: string | null): ProductContext => "happycash";

export const isPaidPlanAllowedForProductContext = (
  _productContext: ProductContext,
  planId?: string | null,
) => HAPPYCASH_PAID_PLAN_IDS.has((planId || "").trim().toLowerCase());

export const isCurrentSubscriptionPlanAllowedForProductContext = (
  productContext: ProductContext,
  planId?: string | null,
) => {
  const normalizedPlanId = (planId || "").trim().toLowerCase();
  if (!normalizedPlanId) return false;
  if (normalizedPlanId === "demo") return true;
  return isPaidPlanAllowedForProductContext(productContext, normalizedPlanId);
};

export const isDesktopPlanAllowedForProductContext = (
  _productContext: ProductContext,
  planId?: string | null,
) => HAPPYCASH_DESKTOP_PLAN_IDS.has((planId || "").trim().toLowerCase());

export const getProductContextLabel = () => "MIAR AI/FOOD";

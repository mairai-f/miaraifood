export type ProductContext = "happycash" | "happycashfood" | "happycashagenda";

const FOOD_PLAN_IDS = new Set(["food", "food_offline"]);
const AGENDA_PLAN_IDS = new Set(["agenda"]);
const HAPPYCASH_PAID_PLAN_IDS = new Set(["fiado", "completo", "pro"]);

export const normalizeProductContext = (value?: string | null): ProductContext => {
  const normalizedValue = value?.trim().toLowerCase();
  if (normalizedValue === "happycashfood") return "happycashfood";
  if (normalizedValue === "happycashagenda") return "happycashagenda";
  return "happycash";
};

export const resolveProductContextFromPlanId = (planId?: string | null): ProductContext => {
  const normalizedPlanId = (planId || "").trim().toLowerCase();
  if (FOOD_PLAN_IDS.has(normalizedPlanId)) return "happycashfood";
  if (AGENDA_PLAN_IDS.has(normalizedPlanId)) return "happycashagenda";
  return "happycash";
};

export const isPaidPlanAllowedForProductContext = (
  productContext: ProductContext,
  planId?: string | null,
) => {
  const normalizedPlanId = (planId || "").trim().toLowerCase();

  if (productContext === "happycashfood") {
    return FOOD_PLAN_IDS.has(normalizedPlanId);
  }

  if (productContext === "happycashagenda") {
    return AGENDA_PLAN_IDS.has(normalizedPlanId);
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
    : productContext === "happycashagenda"
      ? ["agenda"] as const
      : ["demo", "fiado", "completo", "pro"] as const;

export const getProductContextLabel = (productContext: ProductContext) =>
  productContext === "happycashfood"
    ? "HappyCashFood"
    : productContext === "happycashagenda"
      ? "HappyCash Agenda"
      : "HappyCash";

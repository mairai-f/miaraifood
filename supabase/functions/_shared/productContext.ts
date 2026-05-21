export type ProductContext = "happycash" | "happycashfood" | "happycashagenda";

const FOOD_PLAN_IDS = new Set(["food", "food_offline"]);
const AGENDA_PLAN_IDS = new Set(["agenda"]);
const HAPPYCASH_PAID_PLAN_IDS = new Set(["fiado", "completo", "pro"]);
const HAPPYCASH_DESKTOP_PLAN_IDS = new Set(["pro"]);
const FOOD_DESKTOP_PLAN_IDS = new Set(["food_offline"]);

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

export const isDesktopPlanAllowedForProductContext = (
  productContext: ProductContext,
  planId?: string | null,
) => {
  const normalizedPlanId = (planId || "").trim().toLowerCase();

  if (productContext === "happycashfood") {
    return FOOD_DESKTOP_PLAN_IDS.has(normalizedPlanId);
  }

  if (productContext === "happycashagenda") {
    return false;
  }

  return HAPPYCASH_DESKTOP_PLAN_IDS.has(normalizedPlanId);
};

export const getProductContextLabel = (productContext: ProductContext) =>
  productContext === "happycashfood"
    ? "HappyCashFood"
    : productContext === "happycashagenda"
      ? "HappyCash Agenda"
      : "HappyCash";

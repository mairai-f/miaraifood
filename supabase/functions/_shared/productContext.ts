import { COMMERCIAL_PAID_PLAN_IDS } from "../../../shared/subscriptionPlanPricing.ts";

export type ProductContext = "happycash";

// Deriva da tabela canônica: uma lista paralela já bloqueou a compra dos
// planos com os nomes novos, que respondiam 403 em create-plan-charge.
const HAPPYCASH_PAID_PLAN_IDS = new Set<string>(COMMERCIAL_PAID_PLAN_IDS);
// "intermediario" e "pro" sao o mesmo produto com nomes de geracoes
// diferentes, entao liberam o Desktop igualmente.
const HAPPYCASH_DESKTOP_PLAN_IDS = new Set(["pro", "intermediario"]);

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

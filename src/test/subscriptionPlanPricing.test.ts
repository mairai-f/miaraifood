import { describe, expect, it } from "vitest";

import { publicPlanContent } from "../../miaraifoodsite/src/lib/subscriptionPlans";
import {
  COMMERCIAL_PAID_PLAN_IDS,
  commercialPaidPlanPricing,
} from "../../shared/subscriptionPlanPricing";

// create-plan-charge cobra pela tabela canonica e ignora o preco gravado em
// subscription_plans. Divergir do que o site anuncia e cobrar errado.
describe("commercial paid plan pricing", () => {
  it.each(COMMERCIAL_PAID_PLAN_IDS)("cobra do plano %s o que o site anuncia", (planId) => {
    const published = publicPlanContent[planId];
    const canonical = commercialPaidPlanPricing[planId];

    expect(published).toBeDefined();
    expect(published.price).toBe(canonical.monthlyPrice);
    expect(published.annualPrice).toBe(canonical.annualPrice);
  });

  it("mantem a tabela canonica cobrindo todo plano pago do site", () => {
    const publishedPaidPlanIds = Object.keys(publicPlanContent).filter((id) => id !== "demo");

    expect([...publishedPaidPlanIds].sort()).toEqual([...COMMERCIAL_PAID_PLAN_IDS].sort());
  });
});

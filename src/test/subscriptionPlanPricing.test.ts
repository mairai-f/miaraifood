import { describe, expect, it } from "vitest";

import { publicPlanContent } from "../../happycashsite/src/lib/subscriptionPlans";
import { commercialPaidPlanPricing } from "../../shared/subscriptionPlanPricing";

describe("commercial paid plan pricing", () => {
  it("keeps the public site catalog aligned with the canonical pricing table", () => {
    expect(publicPlanContent.fiado.price).toBe(commercialPaidPlanPricing.fiado.monthlyPrice);
    expect(publicPlanContent.fiado.annualPrice).toBe(commercialPaidPlanPricing.fiado.annualPrice);

    expect(publicPlanContent.completo.price).toBe(commercialPaidPlanPricing.completo.monthlyPrice);
    expect(publicPlanContent.completo.annualPrice).toBe(commercialPaidPlanPricing.completo.annualPrice);

    expect(publicPlanContent.pro.price).toBe(commercialPaidPlanPricing.pro.monthlyPrice);
    expect(publicPlanContent.pro.annualPrice).toBe(commercialPaidPlanPricing.pro.annualPrice);
  });
});

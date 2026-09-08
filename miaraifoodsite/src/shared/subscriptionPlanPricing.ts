export type CommercialPaidPlanId = "tiozao" | "inicial" | "intermediario" | "premium" | "fiado" | "completo" | "pro";

export interface CommercialPlanPricing {
  monthlyPrice: number;
  originalPrice: number;
  annualPrice: number;
  durationDays: number;
}

export const commercialPaidPlanPricing: Record<CommercialPaidPlanId, CommercialPlanPricing> = {
  tiozao: {
    monthlyPrice: 49,
    originalPrice: 99,
    annualPrice: 490,
    durationDays: 30,
  },
  inicial: {
    monthlyPrice: 99,
    originalPrice: 199,
    annualPrice: 990,
    durationDays: 30,
  },
  intermediario: {
    monthlyPrice: 199,
    originalPrice: 349,
    annualPrice: 1990,
    durationDays: 30,
  },
  premium: {
    monthlyPrice: 349,
    originalPrice: 599,
    annualPrice: 3490,
    durationDays: 30,
  },
  // Legacy compatibility fallbacks
  fiado: {
    monthlyPrice: 49,
    originalPrice: 99,
    annualPrice: 490,
    durationDays: 30,
  },
  completo: {
    monthlyPrice: 99,
    originalPrice: 199,
    annualPrice: 990,
    durationDays: 30,
  },
  pro: {
    monthlyPrice: 199,
    originalPrice: 349,
    annualPrice: 1990,
    durationDays: 30,
  },
};

export const isCommercialPaidPlanId = (value: string | null | undefined): value is CommercialPaidPlanId =>
  value === "tiozao" ||
  value === "inicial" ||
  value === "intermediario" ||
  value === "premium" ||
  value === "fiado" ||
  value === "completo" ||
  value === "pro";

export const getCommercialPaidPlanPricing = (value: string | null | undefined): CommercialPlanPricing | null =>
  isCommercialPaidPlanId(value) ? commercialPaidPlanPricing[value] : null;

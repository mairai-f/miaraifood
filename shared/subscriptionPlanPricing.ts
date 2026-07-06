export type CommercialPaidPlanId = "fiado" | "completo" | "pro" | "agenda";

export interface CommercialPlanPricing {
  monthlyPrice: number;
  annualPrice: number;
  durationDays: number;
}

export const commercialPaidPlanPricing: Record<CommercialPaidPlanId, CommercialPlanPricing> = {
  fiado: {
    monthlyPrice: 79.9,
    annualPrice: 799,
    durationDays: 30,
  },
  completo: {
    monthlyPrice: 119.99,
    annualPrice: 1199.9,
    durationDays: 30,
  },
  pro: {
    monthlyPrice: 159.99,
    annualPrice: 1599.9,
    durationDays: 30,
  },
  agenda: {
    monthlyPrice: 80,
    annualPrice: 800,
    durationDays: 30,
  },
};

export const isCommercialPaidPlanId = (value: string | null | undefined): value is CommercialPaidPlanId =>
  value === "fiado" ||
  value === "completo" ||
  value === "pro" ||
  value === "agenda";

export const getCommercialPaidPlanPricing = (value: string | null | undefined): CommercialPlanPricing | null =>
  isCommercialPaidPlanId(value) ? commercialPaidPlanPricing[value] : null;

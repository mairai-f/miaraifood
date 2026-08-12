export type CommercialPaidPlanId = "fiado" | "completo" | "pro";

export interface CommercialPlanPricing {
  monthlyPrice: number;
  annualPrice: number;
  durationDays: number;
}

export const commercialPaidPlanPricing: Record<CommercialPaidPlanId, CommercialPlanPricing> = {
  fiado: {
    monthlyPrice: 20,
    annualPrice: 200,
    durationDays: 30,
  },
  completo: {
    monthlyPrice: 70,
    annualPrice: 700,
    durationDays: 30,
  },
  pro: {
    monthlyPrice: 130,
    annualPrice: 1300,
    durationDays: 30,
  },
};

export const isCommercialPaidPlanId = (value: string | null | undefined): value is CommercialPaidPlanId =>
  value === "fiado" ||
  value === "completo" ||
  value === "pro";

export const getCommercialPaidPlanPricing = (value: string | null | undefined): CommercialPlanPricing | null =>
  isCommercialPaidPlanId(value) ? commercialPaidPlanPricing[value] : null;

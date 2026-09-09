// Tabela canônica de preços: create-plan-charge cobra por ela, ignorando o
// preço gravado em subscription_plans. Qualquer divergência aqui é cobrança
// errada, então ela precisa espelhar exatamente o que o site anuncia.
//
// Os planos têm duas gerações de identificador. "tiozao", "inicial",
// "intermediario" e "premium" são os nomes MIAR; "fiado", "completo" e "pro"
// são os identificadores legados dos três primeiros e continuam válidos para
// as assinaturas já criadas.
export type CommercialPaidPlanId =
  | "tiozao"
  | "inicial"
  | "intermediario"
  | "premium"
  | "fiado"
  | "completo"
  | "pro";

export interface CommercialPlanPricing {
  monthlyPrice: number;
  annualPrice: number;
  durationDays: number;
}

export const commercialPaidPlanPricing: Record<CommercialPaidPlanId, CommercialPlanPricing> = {
  tiozao: {
    monthlyPrice: 49,
    annualPrice: 490,
    durationDays: 30,
  },
  inicial: {
    monthlyPrice: 99,
    annualPrice: 990,
    durationDays: 30,
  },
  intermediario: {
    monthlyPrice: 199,
    annualPrice: 1990,
    durationDays: 30,
  },
  premium: {
    monthlyPrice: 349,
    annualPrice: 3490,
    durationDays: 30,
  },
  // Identificadores legados: mesmo produto, mesmo preço.
  fiado: {
    monthlyPrice: 49,
    annualPrice: 490,
    durationDays: 30,
  },
  completo: {
    monthlyPrice: 99,
    annualPrice: 990,
    durationDays: 30,
  },
  pro: {
    monthlyPrice: 199,
    annualPrice: 1990,
    durationDays: 30,
  },
};

export const COMMERCIAL_PAID_PLAN_IDS = Object.keys(
  commercialPaidPlanPricing,
) as CommercialPaidPlanId[];

export const isCommercialPaidPlanId = (value: string | null | undefined): value is CommercialPaidPlanId =>
  typeof value === "string" && value in commercialPaidPlanPricing;

export const getCommercialPaidPlanPricing = (value: string | null | undefined): CommercialPlanPricing | null =>
  isCommercialPaidPlanId(value) ? commercialPaidPlanPricing[value] : null;

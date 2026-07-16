import { commercialPaidPlanPricing } from "../../../shared/subscriptionPlanPricing";

export type PublicPlanId = "demo" | "fiado" | "completo" | "pro";
export type PaidPlanId = Exclude<PublicPlanId, "demo">;

export interface PublicPlanContent {
  id: PublicPlanId;
  name: string;
  price: number;
  annualPrice?: number;
  priceLabel: string;
  durationLabel: string;
  summary: string;
  description: string;
  features: string[];
}

export const publicPlanContent: Record<PublicPlanId, PublicPlanContent> = {
  demo: {
    id: "demo",
    name: "Demo 3 Dias",
    price: 0,
    priceLabel: "Grátis",
    durationLabel: "3 dias",
    summary: "Teste o sistema completo por 3 dias antes de escolher um plano pago.",
    description: "A demo libera tudo por 3 dias e depois o usuario pode seguir no plano que quiser.",
    features: [
      "Acesso completo por 3 dias",
      "Todas as funcionalidades liberadas",
      "Sem cartao de credito",
      "Depois escolha um plano de 30 dias",
    ],
  },
  fiado: {
    id: "fiado",
    name: "Plano Fiado",
    price: commercialPaidPlanPricing.fiado.monthlyPrice,
    annualPrice: commercialPaidPlanPricing.fiado.annualPrice,
    priceLabel: "R$ 20",
    durationLabel: `${commercialPaidPlanPricing.fiado.durationDays} dias`,
    summary: "Painel, clientes, produtos, excluidos, fiado e cobrancas por 30 dias.",
    description: "Ideal para quem precisa controlar fiado com operacao simples e sem configuracoes.",
    features: [
      "Painel inicial",
      "Clientes",
      "Produtos",
      "Excluidos",
      "Fiado e cobrancas",
      "Sem acesso as configuracoes",
      "Pagamento via Pix e debito / credito",
    ],
  },
  completo: {
    id: "completo",
    name: "Plano Completo",
    price: commercialPaidPlanPricing.completo.monthlyPrice,
    annualPrice: commercialPaidPlanPricing.completo.annualPrice,
    priceLabel: "R$ 70",
    durationLabel: `${commercialPaidPlanPricing.completo.durationDays} dias`,
    summary: "Tudo do Fiado com PDV, estoque, relatorios, caixa e configuracoes por 30 dias.",
    description: "Gestao completa do HappyCash no web com todos os recursos principais da operacao.",
    features: [
      "Tudo do Plano Fiado",
      "PDV",
      "Estoque",
      "Modulo de precificacao inteligente",
      "Relatorios",
      "Caixa",
      "Configuracoes da loja",
      "Pagamento via Pix e debito / credito",
    ],
  },
  pro: {
    id: "pro",
    name: "Plano PRO",
    price: commercialPaidPlanPricing.pro.monthlyPrice,
    annualPrice: commercialPaidPlanPricing.pro.annualPrice,
    priceLabel: "R$ 130",
    durationLabel: `${commercialPaidPlanPricing.pro.durationDays} dias`,
    summary: "Tudo do Completo com desktop PRO, chave por maquina, mobile e offline local por 5 dias.",
    description: "Plano para operar no web e no desktop PRO com ativacao por maquina e login de operador com usuario e PIN.",
    features: [
      "Tudo do Plano Completo",
      "Desktop para Windows e Linux",
      "Chave da empresa em cada maquina nova",
      "Login de operador com usuario e PIN",
      "Offline local por ate 5 dias",
      "App mobile",
      "Impressao Bematech",
      "Modulo Fiscal NFC-e opcional somente no Desktop PRO",
      "Mais desempenho no caixa",
      "Pagamento via Pix e debito / credito",
    ],
  },
};

export const publicPlanList: PublicPlanContent[] = [
  publicPlanContent.demo,
  publicPlanContent.fiado,
  publicPlanContent.completo,
  publicPlanContent.pro,
];

export const paidPlanIds: PaidPlanId[] = ["fiado", "completo", "pro"];

export const isPublicPlanId = (value: string | null | undefined): value is PublicPlanId =>
  value === "demo" ||
  value === "fiado" ||
  value === "completo" ||
  value === "pro";

export const isPaidPlanId = (value: string | null | undefined): value is PaidPlanId =>
  value === "fiado" ||
  value === "completo" ||
  value === "pro";

export type PublicPlanId = "demo" | "fiado" | "completo" | "pro";
export type PaidPlanId = Exclude<PublicPlanId, "demo">;

export interface PublicPlanContent {
  id: PublicPlanId;
  name: string;
  price: number;
  priceLabel: string;
  durationLabel: string;
  summary: string;
  description: string;
  features: string[];
}

export const publicPlanContent: Record<PublicPlanId, PublicPlanContent> = {
  demo: {
    id: "demo",
    name: "Demo 3 Horas",
    price: 0,
    priceLabel: "Grátis",
    durationLabel: "3 horas",
    summary: "Teste o sistema completo por 3 horas antes de escolher um plano pago.",
    description: "A demo libera tudo por 3 horas e depois o usuario pode seguir no plano que quiser.",
    features: [
      "Acesso completo por 3 horas",
      "Todas as funcionalidades liberadas",
      "Sem cartao de credito",
      "Depois escolha um plano de 30 dias",
    ],
  },
  fiado: {
    id: "fiado",
    name: "Plano Fiado",
    price: 100,
    priceLabel: "R$ 100",
    durationLabel: "30 dias",
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
    price: 230,
    priceLabel: "R$ 230",
    durationLabel: "30 dias",
    summary: "Tudo do Fiado com PDV, estoque, relatorios, caixa e configuracoes por 30 dias.",
    description: "Gestao completa do HappyCash no web com todos os recursos principais da operacao.",
    features: [
      "Tudo do Plano Fiado",
      "PDV",
      "Estoque",
      "Relatorios",
      "Caixa",
      "Configuracoes da loja",
      "Pagamento via Pix e debito / credito",
    ],
  },
  pro: {
    id: "pro",
    name: "Plano PRO",
    price: 347,
    priceLabel: "R$ 347",
    durationLabel: "30 dias",
    summary: "Tudo do Completo com desktop, mobile e recursos premium por 30 dias.",
    description: "Plano com mais valor para quem quer operar no web e preparar desktop, mobile e offline.",
    features: [
      "Tudo do Plano Completo",
      "Aplicativo desktop",
      "App mobile",
      "Fluxo preparado para offline",
      "Impressao Bematech",
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
  value === "demo" || value === "fiado" || value === "completo" || value === "pro";

export const isPaidPlanId = (value: string | null | undefined): value is PaidPlanId =>
  value === "fiado" || value === "completo" || value === "pro";

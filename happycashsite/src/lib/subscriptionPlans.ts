export type PublicPlanId = "demo" | "fiado" | "completo" | "pro" | "agenda";
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
    price: 189,
    priceLabel: "R$ 189",
    durationLabel: "30 dias",
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
    price: 250,
    priceLabel: "R$ 250",
    durationLabel: "30 dias",
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
      "Mais desempenho no caixa",
      "Pagamento via Pix e debito / credito",
    ],
  },
  agenda: {
    id: "agenda",
    name: "HappyCash Agenda",
    price: 80,
    priceLabel: "R$ 80",
    durationLabel: "30 dias",
    summary: "Agenda online para servicos com profissionais, WhatsApp, QR Code, pagamentos e relatorios.",
    description: "Modulo de agendamentos para barbearias, saloes, clinicas, pet shops, oficinas, consultorias e servicos em geral.",
    features: [
      "Agenda diaria, semanal e mensal",
      "Clientes, profissionais e servicos",
      "QR Code da empresa, profissional ou servico",
      "Personalizacao de nome, cores e identidade",
      "WhatsApp para confirmacao e lembretes",
      "Pagamentos Pix, cartao, dinheiro e link",
      "Fluxo Agenda -> check-in -> caixa -> relatorio",
      "Preparado para integracao com HappyCash PDV",
    ],
  },
};

export const publicPlanList: PublicPlanContent[] = [
  publicPlanContent.demo,
  publicPlanContent.fiado,
  publicPlanContent.completo,
  publicPlanContent.pro,
  publicPlanContent.agenda,
];

export const paidPlanIds: PaidPlanId[] = ["fiado", "completo", "pro", "agenda"];

export const isPublicPlanId = (value: string | null | undefined): value is PublicPlanId =>
  value === "demo" ||
  value === "fiado" ||
  value === "completo" ||
  value === "pro" ||
  value === "agenda";

export const isPaidPlanId = (value: string | null | undefined): value is PaidPlanId =>
  value === "fiado" ||
  value === "completo" ||
  value === "pro" ||
  value === "agenda";

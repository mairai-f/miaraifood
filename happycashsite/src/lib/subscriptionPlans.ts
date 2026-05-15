export type PublicPlanId = "demo" | "fiado" | "completo" | "pro" | "food" | "food_offline";
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
    name: "Demo 12 Horas",
    price: 0,
    priceLabel: "Grátis",
    durationLabel: "12 horas",
    summary: "Teste o sistema completo por 12 horas antes de escolher um plano pago.",
    description: "A demo libera tudo por 12 horas e depois o usuario pode seguir no plano que quiser.",
    features: [
      "Acesso completo por 12 horas",
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
  food: {
    id: "food",
    name: "HappyCashFood",
    price: 250,
    priceLabel: "R$ 250",
    durationLabel: "30 dias",
    summary: "Sistema restaurante web com mesas, comandas em modal, cozinha, caixa por mesa e estoque.",
    description: "Plano para restaurantes, bares, lanchonetes e pizzarias operarem no mesmo fluxo de conta e pagamento do HappyCash.",
    features: [
      "Tudo que o HappyCash libera no plano completo",
      "Mesas e comandas",
      "Cardapio da comanda por mesa",
      "Tela do garcom",
      "Cozinha KDS",
      "Caixa por mesa",
      "Delivery e caixa restaurante",
      "Sem executavel offline",
      "Pagamento via Pix e debito / credito",
    ],
  },
  food_offline: {
    id: "food_offline",
    name: "HappyCashFood Offline",
    price: 310,
    priceLabel: "R$ 310",
    durationLabel: "30 dias",
    summary: "HappyCashFood com sistema offline, executavel Windows, Linux, .deb e APK.",
    description: "Plano restaurante com o mesmo sistema Food e a liberacao dos executaveis offline para caixa e operacao local.",
    features: [
      "Tudo do HappyCashFood",
      "Executavel Windows",
      "Linux AppImage",
      "Pacote Linux .deb",
      "Android APK",
      "Chave por maquina",
      "Modo offline local",
      "Pagamento via Pix e debito / credito",
    ],
  },
};

export const publicPlanList: PublicPlanContent[] = [
  publicPlanContent.demo,
  publicPlanContent.fiado,
  publicPlanContent.completo,
  publicPlanContent.pro,
  publicPlanContent.food,
  publicPlanContent.food_offline,
];

export const paidPlanIds: PaidPlanId[] = ["fiado", "completo", "pro", "food", "food_offline"];

export const isPublicPlanId = (value: string | null | undefined): value is PublicPlanId =>
  value === "demo" ||
  value === "fiado" ||
  value === "completo" ||
  value === "pro" ||
  value === "food" ||
  value === "food_offline";

export const isPaidPlanId = (value: string | null | undefined): value is PaidPlanId =>
  value === "fiado" || value === "completo" || value === "pro" || value === "food" || value === "food_offline";

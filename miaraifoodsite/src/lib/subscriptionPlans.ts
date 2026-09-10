import { commercialPaidPlanPricing } from "../shared/subscriptionPlanPricing";

export type PublicPlanId = "demo" | "tiozao" | "inicial" | "intermediario" | "premium" | "fiado" | "completo" | "pro";
export type PaidPlanId = Exclude<PublicPlanId, "demo">;

export interface PublicPlanContent {
  id: PublicPlanId;
  name: string;
  badge?: string;
  price: number;
  originalPrice?: number;
  annualPrice?: number;
  priceLabel: string;
  durationLabel: string;
  summary: string;
  description: string;
  feedText: string;
  features: string[];
  excludedFeatures?: string[];
  ctaLink: string;
  buttonText: string;
}

export const publicPlanContent: Record<PublicPlanId, PublicPlanContent> = {
  demo: {
    id: "demo",
    name: "1 Mês Grátis",
    badge: "Teste Grátis",
    price: 0,
    priceLabel: "Grátis",
    durationLabel: "30 dias",
    summary: "Use o sistema completo por 30 dias antes da primeira cobrança.",
    description: "A promoção libera o plano escolhido por 30 dias, sem cobrança no primeiro mês.",
    feedText: "Acesso teste",
    features: [
      "Acesso completo por 30 dias",
      "Todas as funcionalidades liberadas",
      "Sem cartão de crédito",
      "A cobrança começa somente após o primeiro mês grátis",
    ],
    ctaLink: "/cadastro?plan=demo",
    buttonText: "Começar Grátis",
  },
  tiozao: {
    id: "tiozao",
    name: "Tiozão do Hotdog",
    badge: "Entrada Digital",
    price: 49,
    originalPrice: 99,
    annualPrice: 490,
    priceLabel: "R$ 49",
    durationLabel: "30 dias",
    summary: "Plano de entrada para operações pequenas que precisam começar a digitalizar o atendimento.",
    description: "Plano de entrada para operações pequenas que precisam começar a digitalizar o atendimento.",
    feedText: "Feed: Texto — Divulgação básica em texto no Feed Gastronômico MIAR.",
    features: [
      "Menu digital interativo",
      "Gestão de pedidos e mesas",
      "Caixa básico operacional",
      "Integração orgânica ao Ecossistema MIAR",
    ],
    excludedFeatures: [
      "Sem pagamento integrado",
      "Sem Inteligência Artificial (IA)",
      "Sem Câmeras / Computer Vision",
    ],
    ctaLink: "https://www.miaraifood.com.br/cadastro?plano=tiozao",
    buttonText: "Escolher Tiozão do Hotdog",
  },
  inicial: {
    id: "inicial",
    name: "Inicial",
    badge: "Operação Completa • 1º Mês Grátis",
    price: 99,
    originalPrice: 199,
    annualPrice: 990,
    priceLabel: "R$ 99",
    durationLabel: "30 dias",
    summary: "Para estabelecimentos que querem controlar a operação completa em um único sistema.",
    description: "Para estabelecimentos que querem controlar a operação completa em um único sistema.",
    feedText: "Feed: Texto + Imagem — Publique fotos dos pratos e novidades diretamente no Feed de Clientes.",
    features: [
      "Sistema completo de operação",
      "Mesas, Comandas e Balcão",
      "QR Code Inteligente por Mesa",
      "Gestão de Funcionários por PIN",
      "Estoque automático por Receita",
      "Pagamento integrado (Pix & Cartão no app)",
      "Descoberta Orgânica no Feed MIAR",
    ],
    excludedFeatures: [
      "Sem Recursos de IA",
    ],
    ctaLink: "https://www.miaraifood.com.br/cadastro?plano=inicial",
    buttonText: "Escolher Inicial",
  },
  intermediario: {
    id: "intermediario",
    name: "Intermediário",
    badge: "IA + Visão Computacional / Operação + Inteligência",
    price: 199,
    originalPrice: 349,
    annualPrice: 1990,
    priceLabel: "R$ 199",
    durationLabel: "30 dias",
    summary: "Para estabelecimentos que querem adicionar inteligência e automação comercial à operação.",
    description: "Para estabelecimentos que querem adicionar inteligência e automação comercial à operação.",
    feedText: "Feed: Texto + Imagem + Vídeo — Publique vídeos curtos no Feed MIAR e atraia clientes com alta conversão.",
    features: [
      "Tudo do plano Inicial",
      "IA INTEGRADA MIAR (DESTAQUE IA)",
      "VISÃO COMPUTACIONAL & CÂMERAS (SEÇÃO 27)",
      "Inteligência Comercial Preditiva",
      "FERRAMENTA DE IA PARA MARKETING (AUTOMAÇÃO)",
      "Criação automática de campanhas",
      "Recomendação por IA no Feed Gastronômico",
    ],
    ctaLink: "https://www.miaraifood.com.br/cadastro?plano=intermediario",
    buttonText: "Escolher Intermediário",
  },
  premium: {
    id: "premium",
    name: "Premium",
    badge: "Escala, Nightlife & Impulsionamento / Inteligência + Publicidade + Escala",
    price: 349,
    originalPrice: 599,
    annualPrice: 3490,
    priceLabel: "R$ 349",
    durationLabel: "30 dias",
    summary: "Para operações maiores, bares e casas noturnas que precisam de inteligência e escala no ecossistema.",
    description: "Para operações maiores, bares e casas noturnas que precisam de inteligência e escala no ecossistema.",
    feedText: "Feed: Texto + Imagem + Vídeo + Publicidade — Impulsionamento e destaque prioritário no Feed MIAR para milhares de clientes.",
    features: [
      "Tudo dos planos anteriores",
      "Operação completa + IA + Visão Computacional",
      "Inteligência comercial e Marketing por IA",
      "Campanhas e Promoções automatizadas",
      "Recursos avançados para operações maiores & Multi-Filiais",
      "PUBLICIDADE E IMPULSIONAMENTO PAGO NO FEED (BOOST ECOSSISTEMA)",
      "Suporte VIP 24/7 Dedicado com SLA Prioritário",
    ],
    ctaLink: "https://www.miaraifood.com.br/cadastro?plano=premium",
    buttonText: "Escolher Premium",
  },
  // Legacy aliases for backward compatibility
  fiado: {
    id: "fiado",
    name: "Tiozão do Hotdog",
    badge: "Entrada Digital",
    price: 49,
    originalPrice: 99,
    annualPrice: 490,
    priceLabel: "R$ 49",
    durationLabel: "30 dias",
    summary: "Plano de entrada para operações pequenas que precisam começar a digitalizar o atendimento.",
    description: "Plano de entrada para operações pequenas que precisam começar a digitalizar o atendimento.",
    feedText: "Feed: Texto — Divulgação básica em texto no Feed Gastronômico MIAR.",
    features: [
      "Menu digital interativo",
      "Gestão de pedidos e mesas",
      "Caixa básico operacional",
      "Integração orgânica ao Ecossistema MIAR",
    ],
    excludedFeatures: [
      "Sem pagamento integrado",
      "Sem Inteligência Artificial (IA)",
      "Sem Câmeras / Computer Vision",
    ],
    ctaLink: "https://www.miaraifood.com.br/cadastro?plano=tiozao",
    buttonText: "Escolher Tiozão do Hotdog",
  },
  completo: {
    id: "completo",
    name: "Inicial",
    badge: "Operação Completa • 1º Mês Grátis",
    price: 99,
    originalPrice: 199,
    annualPrice: 990,
    priceLabel: "R$ 99",
    durationLabel: "30 dias",
    summary: "Para estabelecimentos que querem controlar a operação completa em um único sistema.",
    description: "Para estabelecimentos que querem controlar a operação completa em um único sistema.",
    feedText: "Feed: Texto + Imagem — Publique fotos dos pratos e novidades diretamente no Feed de Clientes.",
    features: [
      "Sistema completo de operação",
      "Mesas, Comandas e Balcão",
      "QR Code Inteligente por Mesa",
      "Gestão de Funcionários por PIN",
      "Estoque automático por Receita",
      "Pagamento integrado (Pix & Cartão no app)",
      "Descoberta Orgânica no Feed MIAR",
    ],
    excludedFeatures: [
      "Sem Recursos de IA",
    ],
    ctaLink: "https://www.miaraifood.com.br/cadastro?plano=inicial",
    buttonText: "Escolher Inicial",
  },
  pro: {
    id: "pro",
    name: "Intermediário",
    badge: "IA + Visão Computacional / Operação + Inteligência",
    price: 199,
    originalPrice: 349,
    annualPrice: 1990,
    priceLabel: "R$ 199",
    durationLabel: "30 dias",
    summary: "Para estabelecimentos que querem adicionar inteligência e automação comercial à operação.",
    description: "Para estabelecimentos que querem adicionar inteligência e automação comercial à operação.",
    feedText: "Feed: Texto + Imagem + Vídeo — Publique vídeos curtos no Feed MIAR e atraia clientes com alta conversão.",
    features: [
      "Tudo do plano Inicial",
      "IA INTEGRADA MIAR (DESTAQUE IA)",
      "VISÃO COMPUTACIONAL & CÂMERAS (SEÇÃO 27)",
      "Inteligência Comercial Preditiva",
      "FERRAMENTA DE IA PARA MARKETING (AUTOMAÇÃO)",
      "Criação automática de campanhas",
      "Recomendação por IA no Feed Gastronômico",
    ],
    ctaLink: "https://www.miaraifood.com.br/cadastro?plano=intermediario",
    buttonText: "Escolher Intermediário",
  },
};

export const publicPlanList: PublicPlanContent[] = [
  publicPlanContent.tiozao,
  publicPlanContent.inicial,
  publicPlanContent.intermediario,
  publicPlanContent.premium,
];

export const paidPlanIds: PaidPlanId[] = ["tiozao", "inicial", "intermediario", "premium"];

export const isPublicPlanId = (value: string | null | undefined): value is PublicPlanId =>
  value === "demo" ||
  value === "tiozao" ||
  value === "inicial" ||
  value === "intermediario" ||
  value === "premium" ||
  value === "fiado" ||
  value === "completo" ||
  value === "pro";

export const isPaidPlanId = (value: string | null | undefined): value is PaidPlanId =>
  value === "tiozao" ||
  value === "inicial" ||
  value === "intermediario" ||
  value === "premium" ||
  value === "fiado" ||
  value === "completo" ||
  value === "pro";

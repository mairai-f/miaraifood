import { PortfolioData } from "@/types";

export const portfolioData: PortfolioData = {
  personal: {
    name: "HappyCash",
    title: "HAPPYCASH",
    subtitle:
      "O caixa, o fiado e o estoque da sua loja no mesmo lugar | Do balcão ao fechamento, sem improviso",
    bio: "HappyCash é a solução completa para gerenciar seu comércio. Sistema ERP moderno que organiza venda, cliente, produto, cobrança e relatório em uma rotina simples. Com mais de 500+ clientes acompanhados, 50K+ vendas registradas e 10K+ produtos controlados, oferecemos uma plataforma confiável que torna a operação visível e controlável em qualquer lugar.",
    avatar: "/telas/pdv.webp",
    location: "Brasil",
    email: "happycashsupport@gmail.com",
    phone: "+55 12 98891-8792",
    resumeUrl: "/termos",
    website: "https://www.happycashsite.com.br",
    languages: [
      { name: "Português", level: "Native" },
      { name: "English", level: "Professional" },
    ],
    socialLinks: [
      {
        platform: "WhatsApp",
        url: "https://wa.me/5512988918792",
        icon: "whatsapp",
        username: "HappyCash Support",
      },
      {
        platform: "Instagram",
        url: "https://www.instagram.com/happycasherp/",
        icon: "instagram",
        username: "happycasherp",
      },
      {
        platform: "Facebook",
        url: "https://www.facebook.com/happycash/",
        icon: "facebook",
        username: "HappyCash",
      },
    ],
  },
  projects: [
    {
  id: "project-1",
  slug: "pdv-caixa",
  title: "PDV e Caixa",
  image: "/telas/pdvfinalizandovenda.webp",

  description:
    "Frente de caixa completa para realizar vendas, controlar pagamentos e agilizar o atendimento da sua empresa.",

  longDescription:
    "O PDV do HappyCash foi desenvolvido para tornar o processo de venda mais rápido, simples e organizado. Registre produtos, controle pagamentos, acompanhe vendas e mantenha o estoque atualizado automaticamente em uma única plataforma.",

  techStack: [
    "Venda rápida",
    "Controle de pagamentos",
    "Integração com estoque",
    "Relatórios de vendas",
  ],

  tools: [
    "Caixa inteligente",
    "Controle financeiro",
    "Gestão de produtos",
    "Histórico de vendas",
  ],

  status: "completed",

  repoUrl: "#",

  demoUrl: "#",

  startDate: "2026-01-01",

  role: "Módulo ERP",

  customTimeline: "2026",

  team: "Equipe HappyCash",

  highlights: [
    "Venda rápida no caixa",
    "Menos erros operacionais",
    "Controle completo das vendas",
  ],

  category: "ERP & Gestão Empresarial",

      features: [
  {
    title: "Venda Simplificada",
    items: [
      "**Frente de caixa rápida**: Realize vendas de forma simples e organizada.",
      "**Diversas formas de pagamento**: Aceite diferentes métodos de pagamento em um único sistema.",
      "**Atendimento mais ágil**: Reduza filas e melhore a experiência dos clientes.",
    ],
  },

  {
    title: "Controle Inteligente",
    items: [
      "**Estoque atualizado automaticamente**: Produtos são atualizados conforme as vendas realizadas.",
      "**Histórico de vendas**: Consulte todas as movimentações da empresa.",
      "**Fechamento de caixa**: Tenha controle das entradas e saídas diariamente.",
    ],
  },

  {
    title: "Gestão da Empresa",
    items: [
      "**Dados organizados**: Todas as informações importantes centralizadas.",
      "**Mais segurança operacional**: Reduza erros manuais durante a rotina.",
      "**Decisões melhores**: Utilize informações reais para acompanhar o negócio.",
    ],
  },
],
      challengesAndSolutions: [
        {
          problem: "Processos de venda demorados",
    solution:
      "O PDV agiliza o atendimento permitindo registrar vendas de forma rápida e organizada.",
        },
        {
          problem: "Dificuldade no controle do caixa",
    solution:
      "O sistema mantém as movimentações financeiras organizadas e fáceis de acompanhar.",
        },
        {
          problem: "Falta de integração entre vendas e estoque",
    solution:
      "As informações são atualizadas automaticamente para evitar divergências.",
        },
      ],
    },
    {
      id: "project-2",
      slug: "fiado-digital",
      title: "Caderneta Fiado Digital",
      image: "/telas/clientes.webp",
      description:
        "Gestão completa de crédito com histórico por cliente, saldo visível e cobrança pronta via WhatsApp.",
      longDescription:
        "A Caderneta Fiado Digital do HappyCash transforma a operação de lojas que vivem de fiado. Elimina a necessidade de cadernos físicos oferecendo controle digital completo: clientes identificados, saldo sempre visível, histórico organizado e mensagens de cobrança prontas para enviar via WhatsApp. Ideal para pequenas e médias lojas que precisam gerenciar crédito com segurança.",

      techStack: [
        "Venda Rápida",
        "Controle Seguro",
        "Fácil de Usar",
        "Gestão Visual",
        "Sincronização Online",
        "Análise de Dados",
        "Relatórios Rápidos",
        "Cobrança via WhatsApp",
        "Histórico de Clientes",
        "Fechamento Automático",
        "Exportação de Dados",
      ],
      tools: ["Painel Administrativo", "Servidor Nuvem", "Integração", "Backup Diário"],
      status: "completed",
      repoUrl: "https://github.com/Arfazrll/Swarm-Agent-Orchestrator",
      demoUrl: "https://swarmagentblog.vercel.app/",
      startDate: "2025-03-01",
      role: "Módulo ERP",
      customTimeline: "March 2025",
      team: "Equipe HappyCash",

      highlights: [
        "Multi-Agent Orchestration",
        "70B LLM via Groq",
        "Professional PDF Export",
      ],
      category: "AI & Machine Learning",
      features: [
  {
    title: "Controle de Fiado",
    items: [
      "**Cadastro de clientes**: Organize todos os clientes que compram a prazo.",
      "**Saldo atualizado**: Saiba exatamente quanto cada cliente possui em aberto.",
      "**Histórico completo**: Consulte compras, pagamentos e movimentações.",
    ],
  },

  {
    title: "Cobrança Simplificada",
    items: [
      "**Mensagens pelo WhatsApp**: Envie lembretes de pagamento rapidamente.",
      "**Mais controle dos recebimentos**: Reduza esquecimentos e atrasos.",
      "**Relacionamento com clientes**: Mantenha uma comunicação mais organizada.",
    ],
  },

  {
    title: "Segurança e Organização",
    items: [
      "**Substitua o caderno físico**: Tenha todas as informações protegidas digitalmente.",
      "**Menos erros manuais**: Evite anotações perdidas ou informações incorretas.",
      "**Mais tranquilidade na gestão**: Acompanhe o crédito da empresa com facilidade.",
    ],
  },
],
      
      challengesAndSolutions: [
  {
    problem: "Perda de controle dos clientes que compram fiado",
    solution:
      "A Caderneta Fiado Digital organiza todos os clientes, valores pendentes e históricos em um único lugar.",
  },

  {
    problem: "Anotações em cadernos podem gerar erros",
    solution:
      "O sistema digital reduz falhas e mantém os registros sempre disponíveis.",
  },

  {
    problem: "Dificuldade para cobrar pagamentos",
    solution:
      "O HappyCash facilita o envio de mensagens de cobrança pelo WhatsApp.",
  },
],
    },
    {
      id: "project-3",
      slug: "controle-estoque",
      title: "Controle de Estoque",
      image: "/telas/estoque.webp",
      description:
        "Gestão inteligente de estoque com alertas de reposição, entradas, saídas e histórico completo.",
      longDescription:
        "O módulo de Controle de Estoque do HappyCash oferece visibilidade total sobre seus produtos. Registre entradas, acompanhe saídas, defina mínimos por produto e receba alertas claros quando algo precisar de reposição. Tudo integrado com o PDV para garantir que o estoque sempre reflita a realidade da operação.",

      techStack: [
  "Controle de produtos",
  "Entradas e saídas",
  "Alertas de reposição",
  "Estoque integrado ao PDV",
],
      tools: [
  "Cadastro de produtos",
  "Controle de movimentações",
  "Acompanhamento de estoque",
  "Gestão de reposição",
],
      status: "completed",
      demoUrl: "#",
repoUrl: "#",
      startDate: "2025-01-20",
      highlights: [
  "Estoque sempre atualizado",
  "Alertas de reposição",
  "Controle completo dos produtos",
], // Keep for backward compatibility if needed, or rely on features
      category: "ERP & Gestão Empresarial",
      features: [
  {
    title: "Controle de Produtos",
    items: [
      "**Cadastro organizado**: Mantenha todos os produtos da empresa registrados e fáceis de encontrar.",
      "**Controle de quantidade**: Saiba exatamente o que está disponível no estoque.",
      "**Informações centralizadas**: Tenha todos os dados dos produtos em um único lugar.",
    ],
  },

  {
    title: "Movimentação de Estoque",
    items: [
      "**Entrada de produtos**: Registre compras e reposições de forma simples.",
      "**Saída automática**: As vendas realizadas no PDV atualizam o estoque automaticamente.",
      "**Histórico completo**: Acompanhe todas as movimentações realizadas.",
    ],
  },

  {
    title: "Mais Controle para Empresa",
    items: [
      "**Alertas de reposição**: Identifique produtos próximos de acabar.",
      "**Redução de perdas**: Evite falta de produtos e compras desnecessárias.",
      "**Decisões melhores**: Tenha informações para planejar o estoque.",
    ],
  },
],
     challengesAndSolutions: [
  {
    problem: "Falta de controle dos produtos disponíveis",
    solution:
      "O HappyCash mantém o estoque organizado e atualizado conforme as movimentações da empresa.",
  },

  {
    problem: "Produtos acabam sem aviso",
    solution:
      "Alertas ajudam a identificar necessidades de reposição antes que faltem produtos.",
  },

  {
    problem: "Erros no controle manual",
    solution:
      "A integração com o PDV reduz falhas e mantém as informações sempre sincronizadas.",
  },
],
    },
    {
      id: "project-4",
      slug: "relatorios-analytics",
      title: "Relatórios & Análise",
      image: "/telas/relatorios.webp",
      description:
        "Dashboard executivo com DRE, margens, rankings e análise de tendências para decisões estratégicas.",
      longDescription:
        "Os Relatórios & Análise do HappyCash transformam dados brutos em insights acionáveis. Veja o desempenho do seu negócio através de DRE completo, margens de lucro por produto, rankings de vendas e tendências. Todos os dados sincronizados em tempo real para que você sempre tenha visibilidade sobre a operação.",

      techStack: [
  "Indicadores em tempo real",
  "DRE empresarial",
  "Análise de vendas",
  "Relatórios inteligentes",
],
      tools: [
  "Dashboard gerencial",
  "Gráficos de desempenho",
  "Controle financeiro",
  "Acompanhamento de resultados",
],
      status: "completed",
      repoUrl: "#",
      demoUrl: "#",
      startDate: "2025-01-01",
     customTimeline: "2026",
    team: "Equipe HappyCash",
     highlights: [
  "Decisões baseadas em dados",
  "Visão completa do negócio",
  "Relatórios rápidos e organizados",
],
      category: "ERP & Gestão Empresarial",
     features: [
  {
    title: "Análise do Negócio",
    items: [
      "**Dashboard completo**: Visualize os principais indicadores da empresa em um único lugar.",
      "**Desempenho de vendas**: Acompanhe resultados, produtos mais vendidos e evolução do negócio.",
      "**Dados organizados**: Transforme informações da operação em decisões mais inteligentes.",
    ],
  },

  {
    title: "Controle Financeiro",
    items: [
      "**DRE empresarial**: Tenha uma visão clara de receitas, despesas e resultados.",
      "**Análise de margens**: Identifique quais produtos geram melhores resultados.",
      "**Acompanhamento financeiro**: Controle melhor a saúde do negócio.",
    ],
  },

  {
    title: "Relatórios Inteligentes",
    items: [
      "**Indicadores em tempo real**: Acompanhe informações atualizadas da empresa.",
      "**Rankings de vendas**: Descubra produtos e períodos com melhor desempenho.",
      "**Mais segurança nas decisões**: Planeje ações com base em dados reais.",
    ],
  },
],
      challengesAndSolutions: [
  {
    problem: "Falta de visão sobre o desempenho da empresa",
    solution:
      "Os relatórios do HappyCash organizam os dados da operação para facilitar o acompanhamento dos resultados.",
  },

  {
    problem: "Decisões feitas sem informações precisas",
    solution:
      "Indicadores e análises ajudam o empresário a tomar decisões mais seguras.",
  },

  {
    problem: "Dificuldade em acompanhar vendas e resultados",
    solution:
      "Dashboards simples mostram as informações mais importantes do negócio em tempo real.",
  },
],
    },
    
      {
  id: "project-5",
  slug: "financeiro-controle-caixa",
  title: "Financeiro e Controle de Caixa",
  image: "/telas/Financeiro.webp",

  description:
    "Controle completo das movimentações financeiras, entradas, saídas e acompanhamento do caixa da empresa.",

  longDescription:
    "O módulo Financeiro e Controle de Caixa do HappyCash ajuda empresas a acompanhar toda a movimentação financeira de forma simples e organizada. Tenha visão das vendas realizadas, controle de entradas e despesas, acompanhe o fechamento do caixa e mantenha as informações da empresa sempre disponíveis para melhores decisões.",


  techStack: [
    "Gestão Financeira",
    "Controle de Caixa",
    "Relatórios",
    "Indicadores",
  ],

  tools: [
    "Dashboard",
    "PDV Integrado",
    "Sistema HappyCash",
  ],

  status: "completed",

  repoUrl: "#",
  demoUrl: "#",

  startDate: "2026-01-01",
  customTimeline: "2026",

  team: "Equipe HappyCash",

  role: "Módulo ERP",


  highlights: [
    "Controle de entradas e saídas",
    "Fechamento de caixa organizado",
    "Visão financeira do negócio",
  ],


  category: "ERP & Gestão Empresarial",


  features: [
    {
      title: "Controle Financeiro",
      items: [
        "**Entradas e Saídas**: Registre movimentações financeiras e acompanhe o dinheiro da empresa.",
        "**Organização Financeira**: Tenha informações centralizadas para evitar controles manuais.",
        "**Maior Visibilidade**: Saiba como está o desempenho financeiro do negócio.",
      ],
    },

    {
      title: "Gestão de Caixa",
      items: [
        "**Fechamento de Caixa**: Controle os valores movimentados durante o dia.",
        "**Conferência de Vendas**: Acompanhe vendas realizadas pelo PDV.",
        "**Redução de Erros**: Mais segurança no controle das operações.",
      ],
    },

    {
      title: "Indicadores e Análises",
      items: [
        "**Dados Organizados**: Informações prontas para análise da empresa.",
        "**Acompanhamento de Resultados**: Entenda melhor o desempenho do negócio.",
        "**Decisões Mais Seguras**: Utilize informações reais para planejar o crescimento.",
      ],
    },

    {
      title: "Integração com o ERP",
      items: [
        "**Integração com PDV**: As vendas refletem automaticamente na gestão.",
        "**Integração com Relatórios**: Dados financeiros conectados ao sistema.",
        "**Visão Completa da Operação**: Todos os setores trabalhando juntos.",
      ],
    },
  ],


  installation: [
    {
      title: "Acesso ao Sistema",
      code:
        "Entre no HappyCash\nAcesse o módulo Financeiro\nComece a controlar suas movimentações",
      type: "text",
    },

    {
      title: "Configuração Inicial",
      code:
        "Cadastre categorias financeiras\nConfigure usuários\nComece a registrar operações",
      type: "text",
    },
  ],


  challengesAndSolutions: [
    {
      problem:
        "Falta de controle sobre movimentações financeiras",

      solution:
        "O HappyCash organiza entradas, saídas e informações do caixa em um único sistema, reduzindo controles manuais.",
    },

    {
      problem:
        "Dificuldade para acompanhar resultados",

      solution:
        "Dados financeiros organizados permitem uma visão mais clara do desempenho da empresa.",
    },

    {
      problem:
        "Erros durante o fechamento do caixa",

      solution:
        "Processos organizados ajudam a melhorar a conferência e aumentar a segurança da operação.",
    },
  ],
},
   {
  id: "project-6",
  slug: "pdv-offline-first",
  title: "PDV Offline-First",

  description:
    "Sistema preparado para continuar funcionando mesmo sem internet, garantindo vendas e operações sem interrupções.",

  longDescription:
    "O modo Offline-First do HappyCash foi desenvolvido para empresas que não podem parar suas operações. Mesmo em momentos sem conexão com a internet, o sistema continua permitindo vendas, consultas e registros normalmente. Quando a conexão é restabelecida, os dados são sincronizados automaticamente, garantindo segurança e continuidade para o negócio.",

  techStack: [
    "Tecnologia Ágil",
    "Fácil de Usar",
    "Sistema Desktop",
    "SQLite",
    "Banco de Dados Nuvem",
  ],

  tools: [
    "Painel Administrativo",
    "Backup Diário",
  ],

  status: "completed",

  repoUrl: "#",
  demoUrl: "#",

  startDate: "2026-01-01",

  role: "Módulo ERP",

  customTimeline: "2026",

  team: "Equipe HappyCash",

  highlights: [
    "Venda mesmo sem internet",
    "Sincronização automática de dados",
    "Operação sem interrupções",
  ],

  category: "ERP & Gestão Empresarial",

  features: [
    {
      title: "Operação Offline",
      items: [
        "**Vendas sem Internet**: Continue realizando vendas mesmo quando a conexão estiver indisponível.",
        "**Acesso aos Produtos**: Consulte produtos e informações essenciais sem depender da internet.",
        "**Funcionamento Contínuo**: O caixa permanece disponível durante toda a operação.",
      ],
    },

    {
      title: "Sincronização Inteligente",
      items: [
        "**Sincronização Automática**: Os dados são atualizados assim que a conexão retorna.",
        "**Integração Online e Offline**: Trabalhe de forma flexível em qualquer cenário.",
        "**Dados Atualizados**: Mantenha informações da empresa sempre organizadas.",
      ],
    },

    {
      title: "Segurança Operacional",
      items: [
        "**Prevenção contra Perdas**: Evita que problemas de internet interrompam vendas.",
        "**Armazenamento Seguro**: Informações protegidas durante o período offline.",
        "**Maior Confiabilidade**: Mais estabilidade para operações que precisam funcionar todos os dias.",
      ],
    },

    {
      title: "Experiência do Usuário",
      items: [
        "**Processos Rápidos**: Operações continuam acontecendo sem atrasos causados pela conexão.",
        "**Interface Familiar**: O usuário continua utilizando o sistema normalmente.",
        "**Menos Dependência de Internet**: Mais liberdade para trabalhar em qualquer ambiente.",
      ],
    },
  ],

  installation: [
    {
      title: "Configuração Inicial",
      code: "Ative o modo offline no ambiente HappyCash e configure o dispositivo.",
      type: "text",
    },

    {
      title: "Sincronização",
      code: "Após conexão com a internet, os dados serão sincronizados automaticamente.",
      type: "text",
    },

    {
      title: "Operação",
      code: "Continue realizando vendas normalmente mesmo sem conexão.",
      type: "text",
    },
  ],

  challengesAndSolutions: [
    {
      problem: "Dependência da conexão com internet",
      solution:
        "Desenvolvido um funcionamento offline para permitir que empresas continuem vendendo mesmo durante quedas de conexão.",
    },

    {
      problem: "Risco de perda de informações",
      solution:
        "Implementado processo de armazenamento local e sincronização segura dos dados.",
    },

    {
      problem: "Interrupções durante vendas",
      solution:
        "Criada uma experiência contínua para que operadores mantenham a produtividade sem depender da internet.",
    },
  ],
}, 

      {
  id: "project-7",
  slug: "gestao-usuarios-permissoes",
  title: "Gestão de Usuários e Permissões",

  description:
    "Controle completo de colaboradores com níveis de acesso personalizados para uma operação mais segura.",

  longDescription:
    "O módulo de Gestão de Usuários e Permissões do HappyCash permite controlar quem pode acessar cada recurso do sistema. Defina funções, limite acessos e organize a operação de acordo com a responsabilidade de cada colaborador. Mais segurança para a empresa e mais controle sobre todas as atividades realizadas no sistema.",

  techStack: [
    "Tecnologia Ágil",
    "Fácil de Usar",
    "Banco de Dados Nuvem",
    "Relatórios",
  ],

  tools: [
    "Painel Administrativo",
    "Backup Diário",
    "Interface Simples",
  ],

  status: "completed",

  repoUrl: "#",
  demoUrl: "#",

  startDate: "2026-01-01",

  role: "Módulo ERP",

  customTimeline: "2026",

  team: "Equipe HappyCash",

  highlights: [
    "Controle de acesso por usuário",
    "Permissões personalizadas",
    "Mais segurança na operação",
  ],

  category: "ERP & Gestão Empresarial",

  features: [
    {
      title: "Controle de Usuários",
      items: [
        "**Cadastro de Colaboradores**: Adicione usuários da equipe para utilizar o sistema.",
        "**Organização por Função**: Defina responsabilidades conforme o cargo de cada colaborador.",
        "**Acompanhamento de Acessos**: Tenha mais controle sobre quem utiliza o sistema.",
      ],
    },

    {
      title: "Permissões Personalizadas",
      items: [
        "**Controle de Acesso**: Determine quais áreas cada usuário pode visualizar ou utilizar.",
        "**Restrição de Informações**: Proteja dados importantes da empresa contra acessos indevidos.",
        "**Configuração Flexível**: Ajuste permissões conforme a necessidade da operação.",
      ],
    },

    {
      title: "Segurança Operacional",
      items: [
        "**Menos Riscos**: Reduza alterações indevidas durante a rotina da empresa.",
        "**Maior Organização**: Cada colaborador acessa somente o que precisa.",
        "**Processos Mais Seguros**: Mantenha a operação padronizada e controlada.",
      ],
    },

    {
      title: "Gestão da Equipe",
      items: [
        "**Controle de Colaboradores**: Administre usuários de forma simples e eficiente.",
        "**Melhor Distribuição de Tarefas**: Cada funcionário trabalha com os recursos necessários.",
        "**Escalabilidade**: Prepare o sistema para equipes maiores conforme a empresa cresce.",
      ],
    },
  ],

  installation: [
    {
      title: "Cadastro de Usuários",
      code: "Adicione colaboradores e configure os acessos necessários.",
      type: "text",
    },

    {
      title: "Definição de Permissões",
      code: "Configure quais funcionalidades cada usuário poderá utilizar.",
      type: "text",
    },

    {
      title: "Utilização",
      code: "Cada colaborador acessará o sistema conforme sua função.",
      type: "text",
    },
  ],

  challengesAndSolutions: [
    {
      problem: "Todos os usuários possuem o mesmo acesso",
      solution:
        "Implementação de permissões individuais para controlar funcionalidades disponíveis para cada colaborador.",
    },

    {
      problem: "Risco de alterações indevidas",
      solution:
        "Criação de níveis de acesso para proteger informações importantes da empresa.",
    },

    {
      problem: "Dificuldade de organizar equipes maiores",
      solution:
        "Sistema preparado para gerenciar diferentes usuários e funções dentro da operação.",
    },
  ],
},
   {
  id: "project-8",
  slug: "integracoes-pagamento",
  title: "Integrações de Pagamento",

  description:
    "Receba pagamentos de diferentes formas com mais praticidade, segurança e controle dentro do sistema.",

  longDescription:
    "O módulo de Integrações de Pagamento do HappyCash facilita o recebimento das vendas conectando diferentes formas de pagamento ao sistema. Tenha mais agilidade no caixa, organize recebimentos e acompanhe as movimentações financeiras de forma centralizada.",

  techStack: [
    "Tecnologia Ágil",
    "Fácil de Usar",
    "Banco de Dados Nuvem",
    "APIs de Pagamento",
  ],

  tools: [
    "Painel Administrativo",
    "Backup Diário",
    "Interface Simples",
  ],

  status: "completed",

  repoUrl: "#",
  demoUrl: "#",

  startDate: "2026-01-01",

  role: "Módulo ERP",

  customTimeline: "2026",

  team: "Equipe HappyCash",

  highlights: [
    "Múltiplas formas de pagamento",
    "Recebimentos organizados",
    "Mais agilidade no caixa",
  ],

  category: "ERP & Gestão Empresarial",

  features: [
    {
      title: "Formas de Pagamento",
      items: [
        "**Pagamento Flexível**: Aceite diferentes formas de pagamento durante a venda.",
        "**Integração com Caixa**: Os pagamentos ficam registrados diretamente no sistema.",
        "**Mais Agilidade**: Reduza etapas durante o atendimento ao cliente.",
      ],
    },

    {
      title: "Controle de Recebimentos",
      items: [
        "**Registro Automático**: Mantenha histórico das movimentações realizadas.",
        "**Organização Financeira**: Facilite o acompanhamento dos valores recebidos.",
        "**Conferência Simplificada**: Tenha mais controle sobre as operações do caixa.",
      ],
    },

    {
      title: "Segurança nas Operações",
      items: [
        "**Processos Padronizados**: Evite erros durante o lançamento de pagamentos.",
        "**Dados Organizados**: Centralize informações financeiras da empresa.",
        "**Maior Confiabilidade**: Tenha mais segurança em cada transação realizada.",
      ],
    },

    {
      title: "Integração com o ERP",
      items: [
        "**Vendas Conectadas**: Pagamentos vinculados diretamente aos registros de venda.",
        "**Relatórios Atualizados**: Informações financeiras refletem a operação real.",
        "**Gestão Completa**: Venda, pagamento e financeiro trabalhando juntos.",
      ],
    },
  ],

  installation: [
    {
      title: "Configuração Inicial",
      code: "Configure as formas de pagamento utilizadas pela empresa.",
      type: "text",
    },

    {
      title: "Integração",
      code: "Conecte os meios de pagamento disponíveis no ambiente HappyCash.",
      type: "text",
    },

    {
      title: "Utilização",
      code: "Realize vendas e acompanhe os recebimentos diretamente pelo sistema.",
      type: "text",
    },
  ],

  challengesAndSolutions: [
    {
      problem: "Diversas formas de pagamento sem organização",
      solution:
        "Centralização dos recebimentos para facilitar controle e acompanhamento financeiro.",
    },

    {
      problem: "Processos manuais durante o pagamento",
      solution:
        "Integração das etapas de venda e recebimento para reduzir erros operacionais.",
    },

    {
      problem: "Dificuldade de acompanhar movimentações",
      solution:
        "Registro organizado das transações para melhorar a gestão financeira.",
    },
  ], 
},
{
    id: "project-9",
    slug: "cadastro-produtos",
    title: "Cadastro de Produtos",
    image: "/project/cadastroprodutos.webp",
    description: "Gerenciamento completo de produtos com preços, categorias, códigos de barras e informações organizadas.",
    longDescription: "O módulo de Produtos do HappyCash facilita o cadastro e gerenciamento dos itens vendidos pela empresa. Controle informações importantes como preço, estoque, categorias, códigos de barras e detalhes de cada produto em uma estrutura organizada.",

    techStack: [
        "Tecnologia Ágil",
        "Fácil de Usar",
        "Banco de Dados Nuvem",
        "Estoque Integrado",
    ],

    tools: ["Painel Administrativo", "Backup Diário"],

    status: "completed",

    highlights: [
        "Cadastro rápido de produtos",
        "Organização por categorias",
        "Controle integrado ao estoque",
    ],

    category: "ERP & Gestão Empresarial",

    features: [
        {
            title: "Gestão de Produtos",
            items: [
                "**Cadastro Completo**: Adicione produtos com nome, preço, categoria e informações importantes.",
                "**Código de Barras**: Facilite vendas utilizando identificação rápida dos produtos.",
                "**Categorias Organizadas**: Encontre produtos com mais facilidade durante a operação.",
            ],
        },
        {
            title: "Controle Operacional",
            items: [
                "**Atualização Automática**: Produtos sincronizados com estoque e vendas.",
                "**Alteração de Preços**: Atualize valores conforme necessidade do negócio.",
                "**Informações Centralizadas**: Todos os dados dos produtos em um único ambiente.",
            ],
        },
        {
            title: "Eficiência no Caixa",
            items: [
                "**Busca Rápida**: Localização ágil de produtos durante a venda.",
                "**Menos Erros Operacionais**: Dados organizados reduzem falhas no atendimento.",
                "**Mais Velocidade**: Agilidade para equipes que trabalham no caixa.",
            ],
        },
    ],
    startDate: ""
},
   
   {
       id: "project-11",
       slug: "compras-fornecedores",
       title: "Compras e Fornecedores",
       image: "/project/comprasfornecedores.webp",
       description: "Controle suas compras, fornecedores e reposição de produtos de forma organizada e eficiente.",
       longDescription: "O módulo de Compras e Fornecedores do HappyCash ajuda empresas a organizar todo o processo de aquisição de mercadorias. Controle fornecedores, registre compras, acompanhe entradas de produtos e mantenha o estoque sempre atualizado para evitar falta de produtos e melhorar o planejamento do negócio.",

       techStack: [
           "Tecnologia Ágil",
           "Fácil de Usar",
           "Banco de Dados Nuvem",
           "Estoque Integrado",
       ],

       tools: ["Painel Administrativo", "Backup Diário"],

       status: "completed",

       highlights: [
           "Controle de fornecedores",
           "Entrada de produtos organizada",
           "Reposição de estoque eficiente",
       ],

       category: "ERP & Gestão Empresarial",

       features: [
           {
               title: "Gestão de Compras",
               items: [
                   "**Registro de Compras**: Cadastre compras realizadas e mantenha histórico organizado das movimentações.",
                   "**Entrada de Produtos**: Atualize o estoque automaticamente ao registrar novas mercadorias.",
                   "**Controle de Custos**: Acompanhe valores de compra para melhorar a gestão financeira.",
               ],
           },
           {
               title: "Controle de Fornecedores",
               items: [
                   "**Cadastro de Fornecedores**: Organize informações dos parceiros comerciais em um único lugar.",
                   "**Histórico de Compras**: Consulte compras realizadas por fornecedor.",
                   "**Relacionamento Organizado**: Tenha mais controle sobre seus contatos e negociações.",
               ],
           },
           {
               title: "Planejamento de Estoque",
               items: [
                   "**Reposição Inteligente**: Identifique necessidades de compra para evitar falta de produtos.",
                   "**Produtos Mais Comprados**: Analise quais itens possuem maior movimentação.",
                   "**Operação Mais Organizada**: Reduza controles manuais e erros durante o processo.",
               ],
           },
       ],

       installation: [
           {
               title: "Configuração do Módulo",
               code: "Ativar módulo Compras e Fornecedores no painel administrativo.",
               type: "text",
           },
           {
               title: "Cadastro Inicial",
               code: "Cadastrar fornecedores, categorias e produtos para iniciar o controle de compras.",
               type: "text",
           },
       ],

       challengesAndSolutions: [
           {
               problem: "Falta de organização nas compras",
               solution: "Centralização das informações de fornecedores, produtos e movimentações para facilitar o acompanhamento da operação.",
           },
           {
               problem: "Diferenças entre estoque físico e sistema",
               solution: "Integração entre compras e estoque para manter os produtos atualizados após cada entrada.",
           },
           {
               problem: "Dificuldade em acompanhar custos",
               solution: "Registro histórico das compras permitindo melhor análise dos valores investidos no negócio.",
           },
       ],
       startDate: ""
   },
    {
  id: "project-12",
  slug: "gestao-clientes",

  title: "Gestão de Clientes",

  image: "/project/clientes.webp",

  description:
    "Centralize o cadastro de clientes, acompanhe histórico de compras, limite de crédito e fortaleça o relacionamento com sua base.",

  longDescription:
    "O módulo Gestão de Clientes do HappyCash reúne todas as informações importantes em um único lugar. Cadastre clientes, acompanhe o histórico de compras, visualize o saldo da caderneta de fiado, consulte contatos e mantenha um relacionamento mais próximo. Com dados organizados, sua empresa oferece um atendimento mais rápido, personalizado e eficiente.",

  techStack: [
    "Cadastro de Clientes",
    "Histórico de Compras",
    "Controle de Crédito",
    "Gestão de Relacionamento",
  ],

  tools: [
    "Cadastro Completo",
    "Consulta Rápida",
    "Histórico Integrado",
    "Controle de Clientes",
  ],

  status: "completed",

  repoUrl: "#",

  demoUrl: "#",

  startDate: "2026-01-01",

  role: "Módulo ERP",

  customTimeline: "2026",

  team: "Equipe HappyCash",

  highlights: [
    "Cadastro completo de clientes",
    "Histórico integrado",
    "Controle de crédito",
  ],

  category: "ERP & Gestão Empresarial",

  features: [
    {
      title: "Cadastro Inteligente",
      items: [
        "**Informações completas**: Registre dados pessoais, contatos e observações importantes.",
        "**Busca rápida**: Localize clientes em poucos segundos.",
        "**Cadastro organizado**: Todas as informações centralizadas em um único ambiente.",
      ],
    },

    {
      title: "Histórico do Cliente",
      items: [
        "**Compras realizadas**: Consulte todas as vendas efetuadas pelo cliente.",
        "**Movimentações financeiras**: Acompanhe pagamentos e pendências.",
        "**Caderneta integrada**: Visualize rapidamente valores em aberto.",
      ],
    },

    {
      title: "Relacionamento",
      items: [
        "**Atendimento personalizado**: Conheça o histórico antes de cada venda.",
        "**Maior fidelização**: Organize informações importantes sobre cada cliente.",
        "**Gestão eficiente**: Melhore o relacionamento comercial da empresa.",
      ],
    },
  ],

  challengesAndSolutions: [
    {
      problem: "Informações de clientes espalhadas em diferentes locais.",
      solution:
        "Centralização de todos os dados em um único cadastro integrado ao ERP.",
    },

    {
      problem: "Dificuldade para consultar o histórico de compras.",
      solution:
        "Histórico completo disponível em poucos segundos diretamente no sistema.",
    },

    {
      problem: "Falta de controle sobre clientes com crédito.",
      solution:
        "Integração com a Caderneta Fiado para acompanhar saldos e movimentações.",
    },
  ],
},
   {
  id: "project-14",

  slug: "happycash-gestao-de-clientes",

  title: "HappyCash Gestão de Clientes",

  description:
    "Controle completo dos clientes do seu comércio com histórico de compras, informações cadastrais e relacionamento simplificado.",

  longDescription:
    "O módulo de Gestão de Clientes da HappyCash permite organizar todas as informações dos consumidores em um único lugar. Tenha acesso ao histórico de compras, dados cadastrais, movimentações e relacionamento com cada cliente, facilitando o atendimento e ajudando seu negócio a criar melhores oportunidades de venda.",

  techStack: [
    "Tecnologia Ágil",
    "Fácil de Usar",
    "Banco de Dados Nuvem",
    "Estoque Integrado",
    "Offline Sync",
    "Responsive Design",
  ],

  tools: [
    "HappyCash ERP",
    "Dashboard Administrativo",
    "Sistema de Cadastro",
    "Relatórios Gerenciais",
  ],

  status: "completed",

  repoUrl: "#",

  demoUrl: "#",

  startDate: "2025-01-01",

  role: "Módulo ERP",

  customTimeline: "2025",

  team: "Equipe HappyCash",

  highlights: [
    "Cadastro completo de clientes",
    "Histórico de compras integrado",
    "Maior controle no relacionamento",
  ],

  category: "ERP & Customer Management",

  features: [
    {
      title: "Cadastro de Clientes",

      items: [
        "**Informações Centralizadas**: Organize dados dos clientes como nome, contato e informações importantes em um único ambiente.",
        "**Consulta Rápida**: Encontre clientes rapidamente durante o atendimento no sistema.",
        "**Dados Organizados**: Tenha uma base de clientes estruturada para facilitar a gestão do comércio.",
      ],
    },

    {
      title: "Histórico de Compras",

      items: [
        "**Acompanhamento de Consumo**: Consulte compras realizadas e movimentações de cada cliente.",
        "**Relacionamento Personalizado**: Entenda melhor o comportamento dos consumidores através do histórico.",
        "**Integração com Vendas**: As informações são conectadas diretamente ao fluxo do PDV.",
      ],
    },

    {
      title: "Integração com Fiado",

      items: [
        "**Controle de Crédito**: Visualize informações relacionadas aos clientes que utilizam a Caderneta Fiado.",
        "**Acompanhamento de Pendências**: Tenha maior controle sobre valores em aberto.",
        "**Gestão Simplificada**: Centralize vendas, clientes e pagamentos em uma única plataforma.",
      ],
    },

    {
      title: "Mais Controle para o Comércio",

      items: [
        "**Atendimento Mais Rápido**: Acesso fácil às informações importantes durante a venda.",
        "**Organização Empresarial**: Reduza controles manuais e mantenha os dados atualizados.",
        "**Decisões Mais Seguras**: Utilize informações do sistema para melhorar a gestão do negócio.",
      ],
    },
  ],

  installation: [
    {
      title: "Acesso ao Módulo",

      code:
        "Entre no HappyCash ERP\nAcesse o menu Clientes\nCadastre e gerencie seus consumidores",

      type: "code",
    },

    {
      title: "Utilização Integrada",

      code:
        "PDV > Cliente\nFiado > Cliente\nRelatórios > Histórico de compras",

      type: "code",
    },
  ],

  challengesAndSolutions: [
    {
      problem: "Comércios possuem dificuldade para organizar informações dos clientes",

      solution:
        "A HappyCash centraliza os dados dos consumidores, permitindo acesso rápido e organizado durante a operação.",
    },

    {
      problem: "Falta de histórico para entender os hábitos de compra",

      solution:
        "O sistema registra movimentações e compras, facilitando o acompanhamento do relacionamento com cada cliente.",
    },

    {
      problem: "Controle manual de clientes e vendas gera perda de informações",

      solution:
        "A integração entre clientes, PDV e Fiado mantém os dados conectados dentro do ERP.",
    },
  ],
},
   {
  id: "project-15",

  slug: "happycash-relatorios-inteligentes",

  title: "HappyCash Relatórios Gerenciais",

  description:
    "Sistema de relatórios para acompanhar vendas, estoque e desempenho do negócio em tempo real.",

  longDescription:
    "O módulo de Relatórios Gerenciais da HappyCash foi desenvolvido para oferecer uma visão completa da operação da empresa. Através de informações organizadas sobre vendas, produtos, movimentações e resultados, o sistema ajuda empresários a entenderem melhor o funcionamento do negócio e tomarem decisões mais eficientes.",

  techStack: [
    "Tecnologia Ágil",
    "Fácil de Usar",
    "Banco de Dados Nuvem",
    "Estoque Integrado",
    "Charts & Analytics",
    "Responsive Design",
  ],

  tools: [
    "HappyCash ERP",
    "Dashboard Administrativo",
    "Relatórios de Vendas",
    "Análise Operacional",
  ],

  status: "completed",

  repoUrl: "#",

  demoUrl: "#",

  startDate: "2025-01-01",

  role: "Módulo ERP",

  customTimeline: "2025",

  team: "Equipe HappyCash",

  highlights: [
    "Indicadores de desempenho",
    "Análise de vendas e produtos",
    "Controle completo da operação",
  ],

  category: "ERP & Business Intelligence",

  features: [
    {
      title: "Relatórios de Vendas",

      items: [
        "**Acompanhamento de Faturamento**: Visualize resultados de vendas e movimentações financeiras da empresa.",
        "**Análise por Período**: Consulte informações diárias, semanais e mensais para acompanhar o desempenho.",
        "**Controle Comercial**: Identifique produtos com maior saída e acompanhe a evolução das vendas.",
      ],
    },

    {
      title: "Indicadores do Negócio",

      items: [
        "**Visão Geral da Empresa**: Tenha acesso aos principais números da operação em um único painel.",
        "**Dados Organizados**: Transforme informações do sistema em relatórios fáceis de interpretar.",
        "**Apoio à Decisão**: Utilize dados reais para melhorar estratégias e resultados.",
      ],
    },

    {
      title: "Análise de Produtos e Estoque",

      items: [
        "**Produtos Mais Vendidos**: Identifique quais itens possuem maior desempenho comercial.",
        "**Controle de Movimentação**: Acompanhe entradas e saídas de produtos no estoque.",
        "**Melhor Planejamento**: Tenha informações para auxiliar compras e reposição de mercadorias.",
      ],
    },

    {
      title: "Gestão Simplificada",

      items: [
        "**Informações Centralizadas**: Todos os dados importantes do negócio dentro do ERP.",
        "**Acesso Rápido**: Consulte informações importantes sem depender de controles externos.",
        "**Mais Controle Operacional**: Reduza processos manuais e aumente a organização da empresa.",
      ],
    },
  ],

  installation: [
    {
      title: "Acesso aos Relatórios",

      code:
        "Entre no HappyCash ERP\nAcesse o menu Relatórios\nSelecione o indicador desejado",

      type: "code",
    },

    {
      title: "Consulta de Dados",

      code:
        "Relatórios > Vendas\nRelatórios > Produtos\nRelatórios > Movimentações",

      type: "code",
    },
  ],

  challengesAndSolutions: [
    {
      problem:
        "Empresas possuem informações importantes, mas dificuldade para interpretar os dados",

      solution:
        "A HappyCash organiza os dados da operação em relatórios claros para facilitar o acompanhamento do negócio.",
    },

    {
      problem:
        "Gestores precisam acompanhar vendas e resultados diariamente",

      solution:
        "O sistema reúne os principais indicadores em um único ambiente, permitindo uma visão rápida da empresa.",
    },

    {
      problem:
        "Controles manuais dificultam a gestão e aumentam erros",

      solution:
        "A automação dos relatórios reduz processos manuais e mantém as informações sempre atualizadas.",
    },
  ],
},
    {
  id: "project-16",

  slug: "happycash-controle-de-estoque",

  title: "HappyCash Controle de Estoque",

  description:
    "Sistema completo para controle de produtos, movimentações e organização do estoque do seu negócio.",

  longDescription:
    "O módulo de Controle de Estoque da HappyCash permite acompanhar produtos, entradas, saídas e movimentações em tempo real. Desenvolvido para facilitar a rotina de comerciantes, o sistema ajuda a evitar perdas, melhorar o controle de mercadorias e manter o negócio sempre organizado.",

  techStack: [
    "Tecnologia Ágil",
    "Fácil de Usar",
    "Banco de Dados Nuvem",
    "Estoque Integrado",
    "Barcode Integration",
    "Offline Sync",
  ],

  tools: [
    "HappyCash ERP",
    "PDV",
    "Cadastro de Produtos",
    "Gestão de Estoque",
  ],

  status: "completed",

  repoUrl: "#",

  demoUrl: "#",

  startDate: "2025-01-01",

  role: "Módulo ERP",

  customTimeline: "2025",

  team: "Equipe HappyCash",

  highlights: [
    "Controle de estoque em tempo real",
    "Gestão completa de produtos",
    "Integração com vendas no PDV",
  ],

  category: "ERP & Inventory Management",

  features: [
    {
      title: "Gestão de Produtos",

      items: [
        "**Cadastro Completo**: Organize produtos com informações como preço, categoria, código e quantidade disponível.",
        "**Controle Centralizado**: Todos os produtos gerenciados dentro de uma única plataforma.",
        "**Atualização Simplificada**: Ajuste informações rapidamente conforme a necessidade do negócio.",
      ],
    },

    {
      title: "Movimentação de Estoque",

      items: [
        "**Entrada e Saída Automática**: Atualização do estoque conforme movimentações realizadas no sistema.",
        "**Controle de Quantidades**: Acompanhe disponibilidade dos produtos em tempo real.",
        "**Redução de Perdas**: Tenha maior controle sobre mercadorias e reposições.",
      ],
    },

    {
      title: "Integração com PDV",

      items: [
        "**Baixa Automática de Produtos**: As vendas realizadas atualizam o estoque automaticamente.",
        "**Agilidade no Atendimento**: Produtos localizados rapidamente durante a venda.",
        "**Operação Integrada**: Estoque e vendas trabalhando juntos dentro do ERP.",
      ],
    },

    {
      title: "Organização do Negócio",

      items: [
        "**Mais Controle Operacional**: Reduza processos manuais e erros de cadastro.",
        "**Melhor Planejamento**: Saiba quando realizar reposições de produtos.",
        "**Gestão Simplificada**: Tenha uma visão clara da situação do estoque.",
      ],
    },
  ],

  installation: [
    {
      title: "Acesso ao Módulo",

      code:
        "Entre no HappyCash ERP\nAcesse Estoque\nCadastre e gerencie seus produtos",

      type: "code",
    },

    {
      title: "Integração Operacional",

      code:
        "Produtos > Cadastro\nPDV > Venda\nEstoque > Movimentações",

      type: "code",
    },
  ],

  challengesAndSolutions: [
    {
      problem:
        "Empresas possuem dificuldade para controlar mercadorias",

      solution:
        "A HappyCash centraliza o controle de estoque, permitindo acompanhar produtos e movimentações de forma organizada.",
    },

    {
      problem:
        "Vendas realizadas sem atualização correta do estoque",

      solution:
        "A integração com o PDV atualiza automaticamente as quantidades disponíveis.",
    },

    {
      problem:
        "Falta de informações para reposição de produtos",

      solution:
        "O sistema fornece uma visão clara das movimentações para auxiliar o planejamento.",
    },
  ],
},


{
  id: "project-17",

  slug: "happycash-controle-de-acessos",

  title: "HappyCash Controle de Usuários",

  description:
    "Gerenciamento de usuários, permissões e níveis de acesso para maior segurança na operação do sistema.",

  longDescription:
    "O módulo de Controle de Usuários da HappyCash permite administrar quem pode acessar cada área do sistema. Com permissões personalizadas, empresas conseguem organizar equipes, limitar acessos e garantir maior segurança durante a operação diária.",

  techStack: [
    "Tecnologia Ágil",
    "Fácil de Usar",
    "Supabase Auth",
    "Estoque Integrado",
    "Role Based Access Control",
  ],

  tools: [
    "HappyCash ERP",
    "Painel Administrativo",
    "Gestão de Usuários",
    "Controle de Permissões",
  ],

  status: "completed",

  repoUrl: "#",

  demoUrl: "#",

  startDate: "2025-01-01",

  role: "Módulo ERP",

  customTimeline: "2025",

  team: "Equipe HappyCash",

  highlights: [
    "Controle de permissões",
    "Segurança operacional",
    "Gestão de equipes",
  ],

  category: "ERP & Access Management",

  features: [
    {
      title: "Gestão de Usuários",

      items: [
        "**Cadastro de Colaboradores**: Adicione usuários da equipe para utilização do sistema.",
        "**Organização por Funções**: Defina responsabilidades dentro da operação.",
        "**Controle Administrativo**: Gerencie acessos diretamente pelo painel.",
      ],
    },

    {
      title: "Permissões Personalizadas",

      items: [
        "**Níveis de Acesso**: Configure quais áreas cada usuário pode visualizar ou utilizar.",
        "**Maior Segurança**: Evite alterações indevidas em informações importantes.",
        "**Controle por Perfil**: Adapte o sistema conforme a função de cada colaborador.",
      ],
    },

    {
      title: "Segurança da Operação",

      items: [
        "**Proteção de Dados**: Mantenha informações da empresa acessíveis apenas para usuários autorizados.",
        "**Rastreamento de Ações**: Tenha maior controle sobre atividades realizadas no sistema.",
        "**Gestão Profissional**: Estruture o uso do ERP dentro da empresa.",
      ],
    },

    {
      title: "Escalabilidade Empresarial",

      items: [
        "**Suporte a Equipes**: Ideal para empresas com múltiplos colaboradores.",
        "**Operação Organizada**: Cada usuário trabalha com as ferramentas necessárias.",
        "**Crescimento Seguro**: O sistema acompanha a evolução do negócio.",
      ],
    },
  ],

  installation: [
    {
      title: "Configuração Inicial",

      code:
        "Acesse HappyCash ERP\nEntre em Configurações\nCadastre usuários e permissões",

      type: "code",
    },

    {
      title: "Gerenciamento",

      code:
        "Usuários > Cadastro\nPermissões > Configuração\nEquipe > Controle de acesso",

      type: "code",
    },
  ],

  challengesAndSolutions: [
    {
      problem:
        "Empresas precisam controlar quem acessa informações importantes",

      solution:
        "O controle de permissões da HappyCash permite definir acessos conforme a função de cada colaborador.",
    },

    {
      problem:
        "Uso compartilhado do sistema gera riscos operacionais",

      solution:
        "Cada usuário possui seu próprio acesso, trazendo mais organização e segurança.",
    },

    {
      problem:
        "Empresas crescem e precisam organizar equipes",

      solution:
        "A gestão de usuários permite expandir a operação mantendo controle sobre o sistema.",
    },
  ],
},
    {
  id: "project-18",

  slug: "happycash-operacao-offline",

  title: "HappyCash Operação Offline",

  description:
    "Sistema preparado para manter a operação do comércio funcionando mesmo em situações de instabilidade de conexão.",

  longDescription:
    "A tecnologia Offline da HappyCash foi desenvolvida para garantir continuidade na operação dos estabelecimentos. Mesmo em ambientes com internet instável, o sistema permite realizar vendas e acessar informações essenciais, sincronizando os dados automaticamente quando a conexão é restabelecida. Uma solução criada para evitar interrupções e manter o comércio sempre funcionando.",

  techStack: [
    "Tecnologia Ágil",
    "Fácil de Usar",
    "Sistema Desktop",
    "Local Database",
    "Banco de Dados Nuvem",
    "Data Synchronization",
  ],

  tools: [
    "HappyCash Desktop",
    "HappyCash Mobile",
    "Sincronização de Dados",
    "Banco Local",
  ],

  status: "completed",

  repoUrl: "#",

  demoUrl: "#",

  startDate: "2025-01-01",

  role: "Módulo ERP",

  customTimeline: "2025",

  team: "Equipe HappyCash",

  highlights: [
    "Operação sem interrupções",
    "Sincronização automática",
    "Maior confiabilidade para vendas",
  ],

  category: "ERP & Offline Technology",

  features: [
    {
      title: "Operação sem Internet",

      items: [
        "**Continuidade das Vendas**: Realize operações mesmo quando a conexão estiver indisponível.",
        "**Funcionamento Local**: Informações essenciais ficam disponíveis para manter o atendimento funcionando.",
        "**Maior Confiabilidade**: Reduza perdas causadas por falhas temporárias de internet.",
      ],
    },

    {
      title: "Sincronização Inteligente",

      items: [
        "**Atualização Automática**: Dados são sincronizados assim que a conexão retorna.",
        "**Integridade das Informações**: Controle seguro das movimentações realizadas durante o período offline.",
        "**Operação Integrada**: Mantenha vendas, produtos e informações atualizadas no sistema.",
      ],
    },

    {
      title: "Tecnologia para Comércio",

      items: [
        "**Ideal para Pequenos Negócios**: Funciona em ambientes onde a internet pode apresentar instabilidades.",
        "**Atendimento Mais Rápido**: Evita paradas durante momentos de maior movimento.",
        "**Mais Segurança Operacional**: O comércio continua funcionando sem depender totalmente da conexão.",
      ],
    },

    {
      title: "Gestão Simplificada",

      items: [
        "**Controle Centralizado**: Informações organizadas dentro do ecossistema HappyCash.",
        "**Experiência Fluida**: Usuários trabalham normalmente sem perceber interrupções de conexão.",
        "**Preparado para Crescimento**: Estrutura criada para acompanhar a evolução do negócio.",
      ],
    },
  ],

  installation: [
    {
      title: "Ativação do Sistema",

      code:
        "Instale o HappyCash Desktop\nConfigure o ambiente local\nConecte sua conta HappyCash",

      type: "code",
    },

    {
      title: "Funcionamento Offline",

      code:
        "Venda > Operação Local\nInternet indisponível > Continuidade da operação\nConexão restaurada > Sincronização automática",

      type: "code",
    },
  ],

  challengesAndSolutions: [
    {
      problem:
        "Comércios podem perder vendas durante falhas de internet",

      solution:
        "A tecnologia offline da HappyCash mantém a operação ativa mesmo sem conexão temporária.",
    },

    {
      problem:
        "Dados realizados offline precisam permanecer seguros",

      solution:
        "O sistema utiliza sincronização controlada para garantir que as informações sejam atualizadas corretamente.",
    },

    {
      problem:
        "Empresas precisam de sistemas confiáveis para atendimento rápido",

      solution:
        "A HappyCash combina desempenho local e sincronização online para oferecer maior estabilidade operacional.",
    },
  ],
},
    {
  id: "project-19",

  slug: "happycash-gestao-financeira",

  title: "HappyCash Gestão Financeira",

  description:
    "Controle financeiro integrado ao ERP para acompanhar entradas, saídas e resultados do negócio.",

  longDescription:
    "O módulo de Gestão Financeira da HappyCash foi desenvolvido para ajudar empresas a organizarem suas movimentações financeiras de forma simples e eficiente. Com controle de receitas, despesas, vendas e indicadores do negócio, o sistema oferece uma visão mais clara da saúde financeira da empresa, auxiliando empresários no planejamento e na tomada de decisões.",

  techStack: [
    "Tecnologia Ágil",
    "Fácil de Usar",
    "Banco de Dados Nuvem",
    "Estoque Integrado",
    "Financial Analytics",
    "Responsive Design",
  ],

  tools: [
    "HappyCash ERP",
    "Dashboard Financeiro",
    "Relatórios Gerenciais",
    "Controle de Movimentações",
  ],

  status: "completed",

  repoUrl: "#",

  demoUrl: "#",

  startDate: "2025-01-01",

  role: "Módulo ERP",

  customTimeline: "2025",

  team: "Equipe HappyCash",

  highlights: [
    "Controle financeiro simplificado",
    "Visão completa do negócio",
    "Acompanhamento de resultados",
  ],

  category: "ERP & Financial Management",

  features: [
    {
      title: "Controle Financeiro",

      items: [
        "**Entradas e Saídas**: Registre e acompanhe todas as movimentações financeiras da empresa.",
        "**Organização Financeira**: Centralize informações importantes para facilitar o controle do negócio.",
        "**Visão Atualizada**: Acompanhe a movimentação financeira de forma simples e organizada.",
      ],
    },

    {
      title: "Análise de Resultados",

      items: [
        "**Acompanhamento de Vendas**: Visualize o impacto das vendas no desempenho financeiro da empresa.",
        "**Indicadores do Negócio**: Tenha informações que ajudam no planejamento e controle.",
        "**Decisões Mais Seguras**: Utilize dados reais para melhorar a gestão.",
      ],
    },

    {
      title: "Integração com ERP",

      items: [
        "**Dados Conectados**: Informações financeiras integradas com vendas e operações do sistema.",
        "**Controle Centralizado**: Reduza planilhas e processos manuais.",
        "**Maior Organização**: Tenha uma visão completa da operação em um único ambiente.",
      ],
    },

    {
      title: "Planejamento Empresarial",

      items: [
        "**Melhor Controle de Gastos**: Acompanhe despesas e movimentações com mais clareza.",
        "**Previsibilidade Financeira**: Entenda melhor o funcionamento financeiro da empresa.",
        "**Gestão Profissional**: Tenha recursos para administrar o negócio com mais eficiência.",
      ],
    },
  ],

  installation: [
    {
      title: "Acesso ao Financeiro",

      code:
        "Entre no HappyCash ERP\nAcesse o módulo Financeiro\nConfigure suas movimentações",

      type: "code",
    },

    {
      title: "Utilização Integrada",

      code:
        "Vendas > Financeiro\nMovimentações > Controle\nRelatórios > Resultados",

      type: "code",
    },
  ],

  challengesAndSolutions: [
    {
      problem:
        "Empresas possuem dificuldade para acompanhar sua situação financeira",

      solution:
        "A HappyCash organiza as movimentações financeiras em um único sistema, facilitando o controle diário.",
    },

    {
      problem:
        "Uso de controles externos gera informações desencontradas",

      solution:
        "A integração entre vendas e financeiro mantém os dados conectados dentro do ERP.",
    },

    {
      problem:
        "Empresários precisam tomar decisões sem informações claras",

      solution:
        "Os relatórios e indicadores ajudam a compreender resultados e planejar os próximos passos.",
    },
  ],
},
    {
  id: "project-20",

  slug: "happycash-caderneta-fiado",

  title: "HappyCash Caderneta Fiado",

  description:
    "Controle de vendas a prazo para acompanhar clientes, valores pendentes e histórico de pagamentos.",

  longDescription:
    "A Caderneta Fiado da HappyCash foi desenvolvida para facilitar o controle de vendas realizadas a prazo. O sistema permite registrar compras dos clientes, acompanhar valores em aberto e manter um histórico organizado de pagamentos. Uma solução criada para pequenos e médios comerciantes que precisam oferecer crédito aos seus clientes com mais segurança e organização.",

  techStack: [
    "Tecnologia Ágil",
    "Fácil de Usar",
    "Banco de Dados Nuvem",
    "Estoque Integrado",
    "Offline Sync",
    "Responsive Design",
  ],

  tools: [
    "HappyCash ERP",
    "PDV",
    "Gestão de Clientes",
    "Controle Financeiro",
  ],

  status: "completed",

  repoUrl: "#",

  demoUrl: "#",

  startDate: "2025-01-01",

  role: "Módulo ERP",

  customTimeline: "2025",

  team: "Equipe HappyCash",

  highlights: [
    "Controle de vendas a prazo",
    "Histórico de clientes",
    "Acompanhamento de pagamentos",
  ],

  category: "ERP & Customer Credit Management",

  features: [
    {
      title: "Controle de Vendas Fiado",

      items: [
        "**Registro de Compras**: Lance vendas realizadas a prazo diretamente pelo sistema.",
        "**Controle de Valores Pendentes**: Acompanhe quanto cada cliente possui em aberto.",
        "**Organização Financeira**: Substitua anotações manuais por um controle digital seguro.",
      ],
    },

    {
      title: "Gestão de Clientes",

      items: [
        "**Histórico Completo**: Consulte compras realizadas e movimentações de cada cliente.",
        "**Informações Centralizadas**: Tenha todos os dados do cliente organizados em um único lugar.",
        "**Atendimento Personalizado**: Conheça melhor o relacionamento com cada consumidor.",
      ],
    },

    {
      title: "Acompanhamento de Pagamentos",

      items: [
        "**Registro de Recebimentos**: Atualize pagamentos realizados pelos clientes.",
        "**Controle de Pendências**: Identifique facilmente valores em aberto.",
        "**Mais Segurança nas Vendas**: Tenha maior controle antes de liberar novas compras.",
      ],
    },

    {
      title: "Integração com o ERP",

      items: [
        "**Conectado ao PDV**: As vendas realizadas podem ser vinculadas diretamente aos clientes.",
        "**Dados Atualizados**: Informações sincronizadas dentro do ecossistema HappyCash.",
        "**Gestão Simplificada**: Clientes, vendas e pagamentos em uma única plataforma.",
      ],
    },
  ],

  installation: [
    {
      title: "Ativação da Caderneta",

      code:
        "Entre no HappyCash ERP\nAcesse Clientes\nAtive o controle de vendas fiado",

      type: "code",
    },

    {
      title: "Operação no Sistema",

      code:
        "PDV > Selecionar Cliente\nVenda > Registrar Fiado\nClientes > Consultar Pendências",

      type: "code",
    },
  ],

  challengesAndSolutions: [
    {
      problem:
        "Comerciantes utilizam cadernetas manuais para controlar vendas a prazo",

      solution:
        "A HappyCash digitaliza esse processo, mantendo todas as informações organizadas e acessíveis.",
    },

    {
      problem:
        "Dificuldade para acompanhar clientes inadimplentes",

      solution:
        "O sistema permite visualizar valores pendentes e histórico de pagamentos.",
    },

    {
      problem:
        "Falta de integração entre vendas e controle de clientes",

      solution:
        "A Caderneta Fiado conecta clientes, vendas e pagamentos dentro do ERP.",
    },
  ],
},
    ],
  experiences: [
  // DESENVOLVIMENTO DA PLATAFORMA (prof-)
  {
    id: 'prof-pdv',
    company: 'HappyCash ERP',
    position: 'Lançamento do PDV Ágil',
    description: 'Implementação de uma frente de caixa ultra rápida para atender comerciantes de alto volume.',
    responsibilities: [
      'Desenvolvimento do módulo de vendas rápidas com suporte a múltiplos pagamentos.',
      'Emissão de comprovantes não fiscais instantâneos.',
      'Sincronização em tempo real com o controle de estoque.'
    ],
    skills: ['PDV', 'Vendas Rápida', 'Frente de Caixa'],
    startDate: '2025-01-01',
    endDate: '2025-03-01',
    isOngoing: false,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  },
  {
    id: 'prof-estoque',
    company: 'HappyCash ERP',
    position: 'Controle de Estoque Inteligente',
    description: 'Sistema completo para gestão de entradas, saídas e movimentações de produtos.',
    responsibilities: [
      'Cadastro de produtos com variações e fotos.',
      'Sistema de alerta para estoque baixo e reposição.',
      'Movimentação e histórico detalhado por operação.'
    ],
    skills: ['Estoque', 'Inventário', 'Gestão'],
    startDate: '2025-04-01',
    endDate: '2025-06-01',
    isOngoing: false,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  },
  {
    id: 'prof-fiado',
    company: 'HappyCash ERP',
    position: 'Caderneta de Fiado Digital',
    description: 'O fim do calote e do caderninho de papel. Gestão de clientes com cobrança integrada.',
    responsibilities: [
      'Lançamento de compras a prazo integradas ao PDV.',
      'Cobrança automatizada direto para o WhatsApp do cliente.',
      'Histórico de pagamentos parciais e limite de crédito.'
    ],
    skills: ['Controle de Crédito', 'Clientes', 'Cobrança'],
    startDate: '2025-07-01',
    endDate: '2025-09-01',
    isOngoing: false,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  },

  // DADOS E GESTÃO (lead-)
  {
    id: 'lead-dash',
    company: 'HappyCash ERP',
    position: 'Dashboards Analíticos',
    description: 'Visualização de dados para acompanhamento da saúde financeira do negócio.',
    responsibilities: [
      'Criação de gráficos interativos de lucro e despesas.',
      'Ranking de produtos mais vendidos.',
      'Visualização de ticket médio e metas de vendas.'
    ],
    skills: ['Análise de Dados', 'BI', 'Gráficos'],
    startDate: '2025-10-01',
    endDate: '2025-12-01',
    isOngoing: false,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  },
  {
    id: 'lead-precificacao',
    company: 'HappyCash ERP',
    position: 'Precificação Inteligente',
    description: 'Ferramenta para cálculo exato de margem de lucro.',
    responsibilities: [
      'Cálculo de preço de custo e margem sugerida.',
      'Atualização em lote de preços de produtos.',
      'Análise de impacto em campanhas promocionais.'
    ],
    skills: ['Gestão de Preços', 'Margem de Lucro'],
    startDate: '2026-01-01',
    endDate: '2026-03-01',
    isOngoing: false,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  },
  {
    id: 'lead-dre',
    company: 'HappyCash ERP',
    position: 'Automação de Relatórios e DRE',
    description: 'Simplificação de fechamentos contábeis e fluxo de caixa.',
    responsibilities: [
      'Geração de Demonstrativo de Resultados (DRE) simplificado.',
      'Exportação de relatórios em PDF e Excel.',
      'Fluxo de caixa projetado e realizado.'
    ],
    skills: ['Finanças', 'Fluxo de Caixa', 'Relatórios'],
    startDate: '2026-04-01',
    endDate: '2026-06-01',
    isOngoing: false,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  },

  // INFRAESTRUTURA E TECNOLOGIA (vol-)
  {
    id: 'vol-cloud',
    company: 'HappyCash ERP',
    position: 'Sincronização Nuvem e Offline',
    description: 'Arquitetura resiliente para que o caixa nunca pare, mesmo sem internet.',
    responsibilities: [
      'Desenvolvimento de engine offline-first para o PDV.',
      'Sincronização em background transparente.',
      'Prevenção de duplicidade de dados.'
    ],
    skills: ['Cloud', 'Offline-First', 'Sincronização'],
    startDate: '2025-07-01',
    endDate: '2025-09-01',
    isOngoing: false,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  },
  {
    id: 'vol-multi',
    company: 'HappyCash ERP',
    position: 'Suporte Multiplataforma',
    description: 'O HappyCash na palma da mão ou no balcão da loja.',
    responsibilities: [
      'Responsividade extrema para smartphones e tablets.',
      'Aplicativo otimizado para economia de bateria.',
      'Compatibilidade com navegadores legados e maquininhas.'
    ],
    skills: ['Mobile', 'Tablet', 'Responsividade'],
    startDate: '2025-10-01',
    endDate: '2025-12-01',
    isOngoing: false,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  },
  {
    id: 'vol-sec',
    company: 'HappyCash ERP',
    position: 'Reforço de Segurança',
    description: 'Garantia de integridade e proteção total dos dados dos comerciantes.',
    responsibilities: [
      'Criptografia de ponta a ponta nas movimentações financeiras.',
      'Backups automáticos horários redundantes.',
      'Auditoria completa de acessos de colaboradores (quem fez o que).'
    ],
    skills: ['Segurança', 'Backups', 'Auditoria'],
    startDate: '2026-01-01',
    isOngoing: true,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  },

  // ATUALIZAÇÕES E MELHORIAS (cert-)
  {
    id: 'cert-theme',
    company: 'HappyCash ERP',
    position: 'Lançamento do Tema Claro (Gelo)',
    description: 'Nova identidade visual e refinamento do design system.',
    responsibilities: [
      'Implementação do suporte a Light/Dark mode.',
      'Adoção da estética Glassmorphism.',
      'Melhoria na legibilidade em ambientes muito iluminados (lojas físicas).'
    ],
    skills: ['Design System', 'Acessibilidade', 'UI/UX'],
    startDate: '2026-02-01',
    endDate: '2026-03-01',
    isOngoing: false,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  },
  {
    id: 'cert-whats',
    company: 'HappyCash ERP',
    position: 'Integração Nativa com WhatsApp',
    description: 'Comunicação sem atrito com clientes.',
    responsibilities: [
      'Envio de recibos em PDF via WhatsApp.',
      'Mensagens de cobrança personalizadas para fiados.',
      'Alertas de promoções para clientes cadastrados.'
    ],
    skills: ['Integração', 'CRM', 'Comunicação'],
    startDate: '2026-04-01',
    endDate: '2026-06-01',
    isOngoing: false,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  },
  {
    id: 'cert-perf',
    company: 'HappyCash ERP',
    position: 'Otimização Extrema de Performance',
    description: 'Velocidade incomparável em qualquer dispositivo.',
    responsibilities: [
      'Conversão de todo o acervo de imagens para WebP.',
      'Redução do tamanho do pacote de carregamento.',
      'Otimização do banco de dados para buscas instantâneas.'
    ],
    skills: ['Performance', 'Otimização', 'Web Vitals'],
    startDate: '2026-07-01',
    isOngoing: true,
    location: 'Brasil',
    type: 'contract',
    logo: '/happycash-logo.webp',
    logoBg: 'bg-black'
  }
],
  education: [
    {
      id: "edu-1",
      institution: "Telkom University",
      degree: "Bachelor of Technology",
      major: "Information Technology",
      startDate: "2023-08-01",
      isOngoing: true,
      gpa: "3.8/4.0",
      activities: [
        "GDSC ML Path",
        "CPS Lab Researcher",
        "HMIT Academic",
        "Data Science Competitions",
      ],
      achievements: [],
    },
  ],
  achievements: [
    {
      id: "help-1",
      title: "Como realizar uma venda no PDV",
      issuer: "Suporte HappyCash",
      date: "2026-08-01",
      description: "Aprenda a operar a frente de caixa, buscar produtos rapidamente e finalizar a venda com emissão de NFC-e e impressão do DANFE HTML.",
      category: "PDV",
      type: "Tutorial",
      image: "/telas/pdvfinalizandovenda.webp"
    },
    {
      id: "help-2",
      title: "Fechamento de Caixa e Relatórios por E-mail",
      issuer: "Suporte HappyCash",
      date: "2026-08-01",
      description: "Veja como encerrar seu turno. Ao fechar o caixa, um relatório financeiro completo é gerado e disparado automaticamente para o e-mail do gestor.",
      category: "Financeiro",
      type: "Manual",
      image: "/telas/fechamentodecaixa.webp"
    },
    {
      id: "help-3",
      title: "Gestão do Fiado Digital com Senha",
      issuer: "Suporte HappyCash",
      date: "2026-08-01",
      description: "Diga adeus ao caderno físico. O sistema exige a senha do Administrador para confirmar baixas e impede pagamentos acima do valor da dívida.",
      category: "Clientes e Fiado",
      type: "Guia",
      image: "/telas/clientes.webp"
    },
    {
      id: "help-4",
      title: "Cobranças com um clique via WhatsApp",
      issuer: "Suporte HappyCash",
      date: "2026-08-01",
      description: "Acelere os recebimentos do fiado enviando mensagens padronizadas de cobrança diretamente para o WhatsApp do cliente através do nosso sistema.",
      category: "Clientes e Fiado",
      type: "Tutorial",
      image: "/telas/clientes.webp"
    },
    {
      id: "help-5",
      title: "Cadastro de Produtos e Lixeira (Excluídos)",
      issuer: "Suporte HappyCash",
      date: "2026-08-01",
      description: "Cadastre produtos de forma ágil, acompanhe seu estoque e recupere itens apagados acidentalmente através do Histórico de Excluídos.",
      category: "Estoque",
      type: "Manual",
      image: "/telas/produtos.webp"
    },
    {
      id: "help-6",
      title: "Passo 1: Crie sua conta e acesse o painel",
      issuer: "Suporte HappyCash",
      date: "2026-08-01",
      description: "Tudo começa aqui no site! Preencha seus dados, aceite os termos, informe os dados da sua empresa e o endereço. Assim que finalizar, sua conta será criada e você terá acesso ao Painel de Controle (Dashboard).",
      category: "Começando no HappyCash",
      type: "Tutorial",
      image: "/telas/cadastro.webp"
    },
    {
      id: "help-7",
      title: "Passo 2: Baixe o sistema e pegue sua Chave",
      issuer: "Suporte HappyCash",
      date: "2026-08-01",
      description: "No seu Dashboard, você gerencia seu plano (ativo, PRO, validade) e encontra os botões para baixar o sistema (Windows, Linux, Android). IMPORTANTE: Copie a sua 'Chave da empresa' que aparece na tela, você vai precisar dela para ativar o aplicativo no seu computador.",
      category: "Começando no HappyCash",
      type: "Tutorial",
      image: "/telas/dashboard.webp"
    },
    {
      id: "help-8",
      title: "Passo 3: Ativando sua Licença Desktop",
      issuer: "Suporte HappyCash",
      date: "2026-08-01",
      description: "Ao abrir o aplicativo HappyCash pela primeira vez no seu computador ou celular, ele pedirá a Chave da Licença. Cole a chave que você copiou no passo anterior, aceite os termos e clique em 'Validar e continuar'. Isso vinculará o dispositivo à sua loja.",
      category: "Começando no HappyCash",
      type: "Tutorial",
      image: "/telas/ativacao.webp"
    },
    {
      id: "help-9",
      title: "Passo 4: Login e Acesso (Admin x Operacional)",
      issuer: "Suporte HappyCash",
      date: "2026-08-01",
      description: "Bem-vindo de volta! Agora basta fazer login. Selecione 'Administrador' (acesso total) ou 'Operacional' (acesso restrito ao caixa), digite o seu usuário e senha e clique em Entrar. Você pode marcar 'Lembrar minha conta' para facilitar os próximos acessos.",
      category: "Começando no HappyCash",
      type: "Tutorial",
      image: "/telas/login_desktop.webp"
    }
  ],
  techStack: [
    {
      name: "Tecnologia Ágil",
      icon: "https://cdn.simpleicons.org/react",
      category: "framework",
    },
    {
      name: "Fácil de Usar",
      icon: "https://cdn.simpleicons.org/typescript",
      category: "language",
    },
    {
      name: "Vite",
      icon: "https://cdn.simpleicons.org/vite",
      category: "tool",
    },
    {
      name: "Sistema Desktop",
      icon: "https://cdn.simpleicons.org/electron",
      category: "framework",
    },
    {
      name: "Banco de Dados Nuvem",
      icon: "https://cdn.simpleicons.org/supabase",
      category: "database",
    },
    {
      name: "Estoque Integrado",
      icon: "https://cdn.simpleicons.org/postgresql",
      category: "database",
    },
    {
      name: "Segurança",
      icon: "https://cdn.simpleicons.org/docker",
      category: "tool",
    },
  ],
  hardSkills: [
    {
      name: "Pix",
      level: "expert",
      category: "pagamentos",
      description: "Receba pagamentos via Pix e facilite o fechamento das vendas diretamente na operação do caixa.",
    },
    {
      name: "Asaas",
      level: "advanced",
      category: "pagamentos",
      description: "Integração para facilitar cobranças e operações financeiras do seu negócio.",
    },
    {
      name: "Mercado Pago",
      level: "advanced",
      category: "pagamentos",
      description: "Conecte seus recebimentos ao ecossistema do HappyCash e simplifique a operação de pagamentos.",
    },
    {
      name: "NFC-e",
      level: "expert",
      category: "fiscal",
      description: "Emita documentos fiscais eletrônicos diretamente nas vendas do PDV, quando configurado para sua operação.",
    },
    {
      name: "NF-e",
      level: "advanced",
      category: "fiscal",
      description: "Integração para emissão de notas fiscais eletrônicas para as operações que exigem esse tipo de documento.",
    },
    {
      name: "Impressoras Térmicas",
      level: "expert",
      category: "fiscal",
      description: "Compatibilidade com impressoras térmicas para impressão de comprovantes e documentos da operação.",
    },
    {
      name: "ESC/POS",
      level: "intermediate",
      category: "fiscal",
      description: "Suporte ao padrão utilizado por diversas impressoras térmicas para impressão rápida no PDV.",
    },
    {
      name: "Frente de Caixa — PDV",
      level: "expert",
      category: "operacao",
      description: "Realize vendas rapidamente, consulte produtos, aplique descontos e acompanhe a movimentação do caixa.",
    },
    {
      name: "Controle de Estoque",
      level: "expert",
      category: "operacao",
      description: "Atualize automaticamente o estoque conforme as vendas e acompanhe entradas, saídas e movimentações.",
    },
    {
      name: "Fiado Digital",
      level: "advanced",
      category: "operacao",
      description: "Gerencie vendas a prazo, clientes, limites de crédito, pagamentos e histórico de movimentações.",
    },
    {
      name: "Comandas e Mesas",
      level: "intermediate",
      category: "operacao",
      description: "Organize pedidos e consumo por comandas e mesas, facilitando a operação de estabelecimentos que trabalham com atendimento no local.",
    },
    {
      name: "Operação Offline",
      level: "expert",
      category: "conectividade",
      description: "Continue utilizando recursos essenciais do sistema mesmo quando a conexão com a internet estiver indisponível, com sincronização posterior conforme a configuração da operação.",
    },
    {
      name: "Desktop",
      level: "advanced",
      category: "conectividade",
      description: "Utilize o HappyCash no computador para uma operação mais completa e integrada ao ambiente do estabelecimento.",
    },
    {
      name: "Mobile",
      level: "intermediate",
      category: "conectividade",
      description: "Tenha acesso às funcionalidades compatíveis do sistema pelo celular ou tablet.",
    },
    {
      name: "Sincronização de Dados",
      level: "advanced",
      category: "conectividade",
      description: "Mantenha as informações da operação sincronizadas entre os dispositivos conectados ao ambiente do HappyCash.",
    },
  ],
  softSkills: [
    {
      name: "Problem Solving",
      description: "Innovative debugging and algorithmic optimization",
    },
    {
      name: "Systemic Thinking",
      description: "Designing robust, scalable end-to-end architectures",
    },
    {
      name: "Critical Thinking",
      description:
        "Analytical approach to solving complex engineering challenges",
    },
    {
      name: "Continuous Learning",
      description: "Staying updated with state-of-the-art AI research",
    },
    {
      name: "Analytical Thinking",
      description: "Breaking down complex data into actionable insights",
    },
    {
      name: "Adaptability",
      description: "Quickly mastering new frameworks and AI models",
    },
    {
      name: "Leadership",
      description: "Leading engineering teams and managing complex projects",
    },
    {
      name: "Communication",
      description: "Translating complex AI concepts for stakeholders",
    },
    {
      name: "Teamwork",
      description: "Collaborative development in cross-functional agile teams",
    },
    {
      name: "Research Skills",
      description: "In-depth literature review and academic contribution",
    },
  ],
  tools: [
    {
      name: "Windows",
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/windows8/windows8-original.svg",
      category: "plataforma",
    },
    {
      name: "Android",
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/android/android-original.svg",
      category: "plataforma",
    },
    {
      name: "Pix Integrado",
      icon: "https://cdn.simpleicons.org/pix/32BCAD",
      category: "pagamento",
    },
    {
      name: "Apple (iOS)",
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/apple/apple-original.svg",
      category: "plataforma",
    },
    {
      name: "Nuvem AWS",
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/amazonwebservices/amazonwebservices-original-wordmark.svg",
      category: "infra",
    },
    {
      name: "Linux PDV",
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linux/linux-original.svg",
      category: "plataforma",
    },
    {
      name: "Navegador Web",
      icon: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/chrome/chrome-original.svg",
      category: "web",
    },
    {
      name: "Wi-Fi (Offline)",
      icon: "https://cdn.simpleicons.org/wi-fi",
      category: "infra",
    },
    {
      name: "WhatsApp API",
      icon: "https://cdn.simpleicons.org/whatsapp/25D366",
      category: "comunicacao",
    },
    {
      name: "Telegram API",
      icon: "https://cdn.simpleicons.org/telegram/26A5E4",
      category: "comunicacao",
    },
  ],
  faqs: [
    {
      question: "What services do you offer?",
      answer:
        "I specialize in Full Stack Development (React, Next.js, Node.js), AI/ML Development (TensorFlow, Computer Vision, NLP), Data Science, and Blockchain/Web3 development (Solidity, Smart Contracts, DApps).",
    },
    {
      question: "What technologies are you exploring?",
      answer:
        "Currently diving deep into AI Agents, Blockchain technology (Solidity, Smart Contracts), and MLOps for production-ready AI systems.",
    },
    {
      question: "Are you available for opportunities?",
      answer:
        "Yes! I'm open to internships, collaborations, and exciting projects in AI, Data Science, Full Stack Development, and Blockchain. Feel free to reach out!",
    },
  ],
  blogs: [
    {
      id: "blog-1",
      slug: "como-organizar-o-estoque",
      title: "Como organizar o estoque e evitar perdas no seu negócio",
      excerpt: "Um guia prático para entender entradas, saídas, produtos parados, reposição e controle de estoque.",
      content: `
        <h2 id="intro" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">A Base de Tudo</h2>
        <p class="mb-8">O estoque é o coração do seu negócio. Ter o produto certo na hora certa significa vender mais. Por outro lado, produtos parados representam dinheiro preso que poderia estar sendo investido no crescimento da empresa.</p>
        <p class="mb-8">Muitos empresários começam utilizando cadernos ou planilhas. Mas quando o movimento cresce, a gestão manual leva a erros de contagem, perdas por validade e falta de mercadorias populares.</p>
        
        <h2 id="curva-abc" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Curva ABC</h2>
        <p class="mb-8">A Curva ABC é um método de classificação que ajuda a entender quais produtos trazem mais lucro e giro. Ela funciona assim:</p>
        <ul class="mb-8 space-y-2">
            <li><strong>Produtos A:</strong> São os 20% dos produtos que representam 80% do seu faturamento. Nunca podem faltar!</li>
            <li><strong>Produtos B:</strong> Têm giro médio. Demandam atenção mensal.</li>
            <li><strong>Produtos C:</strong> Representam a maior parte dos itens, mas trazem pouca receita. Fique de olho para não comprar em excesso.</li>
        </ul>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "Um estoque organizado não é apenas arrumar prateleiras, é ter total clareza sobre onde está o seu dinheiro."
        </blockquote>

        <h2 id="tecnologia" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Apoio da Tecnologia</h2>
        <p class="mb-8">Usar um ERP como o HappyCash permite que cada venda feita no caixa (PDV) dê baixa automática no estoque. Você não precisa contar nada no final do dia. O sistema também avisa quando um produto está acabando, sugerindo o momento ideal de compra.</p>
      `,
      toc: [
        { id: "intro", label: "A Base de Tudo" },
        { id: "curva-abc", label: "Curva ABC" },
        { id: "tecnologia", label: "Apoio da Tecnologia" }
      ],
      image: "/telas/estoque.webp",
      date: "2026-03-20",
      category: "estoque",
      tags: ["Estoque", "Gestão", "Prevenção de Perdas"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "5",
    },
    {
      id: "blog-2",
      slug: "como-controlar-estoque-mercearia",
      title: "Como controlar o estoque de uma mercearia",
      excerpt: "Estratégias práticas para acompanhar produtos de alto giro e evitar falta de mercadorias.",
      content: `
        <h2 id="giro" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Entendendo o Alto Giro</h2>
        <p class="mb-8">Mercearias lidam com milhares de pequenos produtos todos os dias. Desde pão até produtos de limpeza. O grande desafio é o <strong>giro rápido</strong>. Como controlar algo que entra e sai da prateleira dezenas de vezes por dia?</p>
        
        <h2 id="pereciveis" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Controle de Perecíveis (PEPS)</h2>
        <p class="mb-8">A regra de ouro na mercearia é o <strong>PEPS</strong>: Primeiro a Entrar, Primeiro a Sair. Ao repor a prateleira, os produtos com validade mais curta (que chegaram antes) devem ficar sempre na frente. Isso reduz o desperdício radicalmente.</p>
        <p class="mb-8">Faça inventários rotativos semanais. Escolha uma categoria por semana (ex: Laticínios) e confira se a quantidade física bate com o sistema. Assim, você não precisa fechar a loja para contar o estoque todo.</p>
        
        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "Produto vencido na prateleira não é apenas prejuízo financeiro, é prejuízo na imagem do seu negócio."
        </blockquote>

        <h2 id="pdv" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">A Importância do Leitor de Código de Barras</h2>
        <p class="mb-8">Um bom PDV integrado com leitor de código de barras é obrigatório. Vender "de cabeça" ou digitando preços manualmente destrói qualquer controle de estoque. O HappyCash permite bipar o produto e já atualizar o estoque na mesma hora.</p>
      `,
      toc: [
        { id: "giro", label: "Entendendo o Alto Giro" },
        { id: "pereciveis", label: "Controle de Perecíveis" },
        { id: "pdv", label: "Importância do PDV" }
      ],
      image: "/telas/produtos.webp",
      date: "2026-03-15",
      category: "estoque",
      tags: ["Mercearia", "Varejo", "Produtos"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "4",
    },
    {
      id: "blog-3",
      slug: "organizar-fluxo-de-caixa",
      title: "Como organizar o fluxo de caixa de uma pequena empresa",
      excerpt: "Dicas essenciais para nunca perder o controle das suas entradas e saídas de dinheiro.",
      content: `
        <h2 id="conceito" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">O que é Fluxo de Caixa?</h2>
        <p class="mb-8">Fluxo de caixa é o registro de todo o dinheiro que entra e sai da empresa num determinado período. Parece simples, mas muitos empresários confundem o dinheiro da empresa com o dinheiro pessoal (a famosa retirada não registrada), o que quebra o negócio silenciosamente.</p>
        
        <h2 id="registro" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Registre TUDO</h2>
        <p class="mb-8">A regra de ouro é: comprou um café para a loja? Registre. Pagou um fornecedor? Registre. Fez uma venda no dinheiro? Registre. Apenas com o registro de 100% das movimentações é possível ter previsibilidade.</p>
        <ul class="mb-8 space-y-2">
            <li><strong>Entradas:</strong> Vendas à vista, recebimentos de vendas a prazo (cartão, fiado).</li>
            <li><strong>Saídas:</strong> Pagamento de fornecedores, contas de consumo (água, luz), folha de pagamento, impostos.</li>
        </ul>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "Faturamento é vaidade, lucro é sanidade, mas o caixa é a realidade."
        </blockquote>

        <h2 id="sistema" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Abandone o Caderninho</h2>
        <p class="mb-8">Controlar no caderno gera erros de cálculo e impossibilita cruzar informações (ex: quanto vendi de cartão vs quanto realmente caiu na conta). Com o módulo financeiro do HappyCash, as vendas do PDV geram receitas automaticamente, e você só precisa lançar as despesas. O saldo é calculado na hora.</p>
      `,
      toc: [
        { id: "conceito", label: "O que é Fluxo de Caixa?" },
        { id: "registro", label: "Registre TUDO" },
        { id: "sistema", label: "Abandone o Caderninho" }
      ],
      image: "/telas/Financeiro.webp",
      date: "2026-03-10",
      category: "financeiro",
      tags: ["Financeiro", "Caixa", "Gestão"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "6",
    },
    {
      id: "blog-4",
      slug: "controlar-vendas-fiado",
      title: "Fiado: como controlar as vendas a prazo sem perder dinheiro",
      excerpt: "Como estruturar uma caderneta digital e garantir que todos os clientes paguem em dia.",
      content: `
        <h2 id="cultura" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">A Cultura do Fiado</h2>
        <p class="mb-8">Em muitas cidades e bairros, vender fiado não é uma opção, é uma necessidade cultural para manter os clientes. O problema não é vender a prazo, é <strong>não controlar</strong>. O caderninho de papel rasga, molha, soma errado e, pior, não te avisa quem está devendo há meses.</p>
        
        <h2 id="limites" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Estabeleça Limites e Datas</h2>
        <p class="mb-8">Para o fiado funcionar, você deve tratar como um crediário de loja grande:</p>
        <ul class="mb-8 space-y-2">
            <li><strong>Cadastro Completo:</strong> Nome, telefone (WhatsApp) e endereço. Nada de "João do pão".</li>
            <li><strong>Limite de Crédito:</strong> Estipule um valor máximo (ex: R$ 200). Chegou no limite? Só compra se pagar uma parte.</li>
            <li><strong>Data Fixa:</strong> Defina um dia de vencimento fixo (ex: dia 05 ou dia 20).</li>
        </ul>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "Vender e não receber é pior do que não vender. Seu produto foi embora e o dinheiro não entrou."
        </blockquote>

        <h2 id="digitalizacao" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Caderneta Digital no HappyCash</h2>
        <p class="mb-8">O HappyCash possui a funcionalidade de controle de crediário/fiado integrada. Quando você finaliza a venda no PDV e escolhe "Fiado", a dívida vai direto para o cadastro do cliente. O sistema soma tudo automaticamente e você pode enviar a cobrança via WhatsApp direto pelo sistema. Profissionalismo puro!</p>
      `,
      toc: [
        { id: "cultura", label: "A Cultura do Fiado" },
        { id: "limites", label: "Limites e Datas" },
        { id: "digitalizacao", label: "Caderneta Digital" }
      ],
      image: "/telas/clientes.webp",
      date: "2026-03-05",
      category: "vendas",
      tags: ["Fiado", "Vendas", "Cobrança"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "5",
    },
    {
      id: "blog-5",
      slug: "erros-controle-estoque",
      title: "5 erros que prejudicam o controle de estoque",
      excerpt: "Evite os erros mais comuns que fazem sua empresa perder dinheiro e produtos.",
      content: `
        <h2 id="erros" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Pequenos erros, grandes prejuízos</h2>
        <p class="mb-8">Muitos empreendedores culpam a crise ou a falta de clientes, quando na verdade o dinheiro da empresa está escorrendo pelo ralo do estoque. Veja os 5 erros mais comuns e como evitá-los.</p>
        
        <h2 id="lista" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Os 5 Grandes Erros</h2>
        <ul class="mb-8 space-y-4">
            <li><strong>1. Não registrar devoluções e trocas:</strong> O cliente devolve um produto, você dá o dinheiro de volta, mas esquece de relançar o produto no estoque. O sistema fica "furado".</li>
            <li><strong>2. Confiar apenas na memória:</strong> "Acho que ainda temos três daquele vermelho lá no fundo". Achismo leva a prometer produtos indisponíveis aos clientes.</li>
            <li><strong>3. Ignorar o Inventário Físico:</strong> O sistema diz que tem 10, mas fisicamente tem 8. Essas divergências acontecem (roubo, quebra, erro de registro). É preciso fazer contagens mensais.</li>
            <li><strong>4. Comprar sem analisar o giro:</strong> Comprar em excesso porque "estava na promoção". Estoque parado é dinheiro que não rende juros.</li>
            <li><strong>5. Falta de padrão no cadastro:</strong> Cadastrar "Coca-Cola 2L", "Refrigerante Cola 2", "Coca Dois Litros". Você acaba criando 3 produtos diferentes para a mesma coisa, perdendo o histórico de vendas.</li>
        </ul>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "A precisão do estoque é o reflexo da organização do dono."
        </blockquote>

        <h2 id="solucao" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">A Solução Definitiva</h2>
        <p class="mb-8">Use um sistema centralizado. Com o HappyCash, os cadastros são únicos, as entradas via Nota Fiscal atualizam o estoque na hora, e as trocas geram estornos automáticos. O controle deixa de ser uma dor de cabeça e passa a ser uma rotina fácil.</p>
      `,
      toc: [
        { id: "erros", label: "Pequenos erros, grandes prejuízos" },
        { id: "lista", label: "Os 5 Grandes Erros" },
        { id: "solucao", label: "A Solução Definitiva" }
      ],
      image: "/telas/buscadordevendas.webp",
      date: "2026-02-28",
      category: "estoque",
      tags: ["Erros", "Estoque", "Dicas"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "4",
    },
    {
      id: "blog-6",
      slug: "calcular-preco-de-venda",
      title: "Como calcular o preço de venda dos seus produtos",
      excerpt: "Entenda custos, despesas e margem de lucro para formar preços justos e rentáveis.",
      content: `
        <h2 id="o-mito" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">O mito do "multiplicar por dois"</h2>
        <p class="mb-8">O maior erro do pequeno empresário é comprar uma mercadoria por R$ 50 e vender por R$ 100 achando que lucrou R$ 50 (100% de lucro). Isso está matematicamente errado e pode quebrar a empresa.</p>
        
        <h2 id="conceitos" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Custos, Despesas e Margem</h2>
        <p class="mb-8">Para precificar, você precisa entender:</p>
        <ul class="mb-8 space-y-2">
            <li><strong>Custo do Produto:</strong> Valor pago ao fornecedor + frete + impostos de compra.</li>
            <li><strong>Despesas Variáveis:</strong> Impostos sobre a venda, taxa da maquininha de cartão, comissão de vendedor.</li>
            <li><strong>Despesas Fixas:</strong> Aluguel, água, luz, salários. Elas devem ser rateadas e entrar na composição do preço (Markup).</li>
            <li><strong>Margem de Lucro:</strong> O dinheiro limpo que a empresa efetivamente ganhará após pagar TUDO.</li>
        </ul>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "Preço de venda não é o quanto o cliente quer pagar, é o quanto a sua empresa precisa cobrar para se manter viva e crescer."
        </blockquote>

        <h2 id="calculo" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Usando Markup</h2>
        <p class="mb-8">O ideal é utilizar um índice chamado Markup. O sistema HappyCash ajuda você a preencher o custo de compra, a margem que deseja obter e os impostos, sugerindo imediatamente o Preço de Venda ideal para que você nunca pague para trabalhar.</p>
      `,
      toc: [
        { id: "o-mito", label: "O mito do multiplicar por 2" },
        { id: "conceitos", label: "Custos e Despesas" },
        { id: "calculo", label: "Usando Markup" }
      ],
      image: "/telas/precificaçao.webp",
      date: "2026-02-20",
      category: "gestao",
      tags: ["Precificação", "Lucro", "Vendas"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "7",
    },
    {
      id: "blog-7",
      slug: "organizar-fechamento-caixa",
      title: "Como organizar o fechamento de caixa",
      excerpt: "Um passo a passo seguro para fechar o caixa do dia sem dor de cabeça.",
      content: `
        <h2 id="importancia" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">O Momento da Verdade</h2>
        <p class="mb-8">O fechamento de caixa é o processo de conferir se o dinheiro físico, as filipetas de cartão e os comprovantes de Pix batem exatamente com as vendas registradas no sistema. Se sobra dinheiro, houve erro de troco ou venda sem registro. Se falta, houve erro, perda ou desvio.</p>
        
        <h2 id="passos" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Passo a Passo do Fechamento</h2>
        <ol class="mb-8 space-y-4 list-decimal pl-6">
            <li><strong>Fundo de Troco:</strong> Retire e separe o dinheiro do troco (ex: R$ 100) que começou o dia. Ele deve ir para o dia seguinte.</li>
            <li><strong>Soma do Dinheiro:</strong> Some todo o dinheiro vivo restante.</li>
            <li><strong>Conferência de Cartões:</strong> Tire o relatório (Fechamento) nas maquininhas (Stone, Mercado Pago, etc) e some Débito e Crédito separadamente.</li>
            <li><strong>Conferência Pix:</strong> Verifique o total de recebimentos na conta bancária ou extrato do sistema.</li>
            <li><strong>Comparação:</strong> Compare os totais (Dinheiro + Cartão + Pix) com o relatório de "Vendas do Turno" do sistema.</li>
        </ol>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "Furo no caixa não resolvido no mesmo dia vira mistério eterno. Feche o caixa todos os dias."
        </blockquote>

        <h2 id="happycash" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Fechamento Cego no HappyCash</h2>
        <p class="mb-8">Uma das melhores práticas é o "Fechamento Cego". O operador de caixa digita no sistema o quanto ele contou, sem saber o que o sistema espera. O HappyCash fará a comparação e apontará a diferença exata (sobra ou quebra), gerando um relatório gerencial. Muito mais segurança para você.</p>
      `,
      toc: [
        { id: "importancia", label: "O Momento da Verdade" },
        { id: "passos", label: "Passo a Passo" },
        { id: "happycash", label: "Fechamento Cego" }
      ],
      image: "/telas/fechamentodecaixa.webp",
      date: "2026-02-15",
      category: "financeiro",
      tags: ["Caixa", "PDV", "Fechamento"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "4",
    },
    {
      id: "blog-8",
      slug: "o-que-e-dre",
      title: "O que é DRE e por que ela é importante para sua empresa",
      excerpt: "Desmistificando a Demonstração do Resultado do Exercício para pequenos negócios.",
      content: `
        <h2 id="conceito" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Muito Além do Saldo Bancário</h2>
        <p class="mb-8">Muitos empresários acham que se tem dinheiro na conta bancária, a empresa está dando lucro. Isso é um erro gravíssimo (você pode ter atrasado o pagamento de fornecedores, por exemplo). A única forma real de saber se a empresa deu Lucro ou Prejuízo é a DRE.</p>
        
        <h2 id="estrutura" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">A Estrutura Simples da DRE</h2>
        <p class="mb-8">A DRE (Demonstração do Resultado do Exercício) parece complexa, mas no fundo é uma conta matemática básica de "cascata":</p>
        <ul class="mb-8 space-y-2">
            <li><strong>Receita Bruta:</strong> Tudo o que vendeu.</li>
            <li>(-) Impostos e Devoluções</li>
            <li><strong>= Receita Líquida</strong></li>
            <li>(-) Custo da Mercadoria Vendida (CMV)</li>
            <li><strong>= Lucro Bruto</strong></li>
            <li>(-) Despesas Fixas (Aluguel, salários) e Variáveis (água, luz)</li>
            <li><strong>= Lucro Líquido (O que sobrou no bolso!)</strong></li>
        </ul>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "A DRE é o raio-X da saúde da sua empresa. Sem ela, você está pilotando no escuro."
        </blockquote>

        <h2 id="automacao" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">DRE Automática</h2>
        <p class="mb-8">Fazer essa conta na mão ou na planilha todo mês é cansativo e sujeito a erros. O HappyCash gera a DRE Gerencial automaticamente com base nas vendas do PDV, custo dos produtos e contas pagas cadastradas no módulo financeiro. Com um clique, você sabe a resposta que mais importa: "Estou tendo lucro?"</p>
      `,
      toc: [
        { id: "conceito", label: "Além do Saldo Bancário" },
        { id: "estrutura", label: "A Estrutura Simples" },
        { id: "automacao", label: "DRE Automática" }
      ],
      image: "/telas/relatorios.webp",
      date: "2026-02-10",
      category: "financeiro",
      tags: ["DRE", "Finanças", "Relatórios"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "6",
    },
    {
      id: "blog-9",
      slug: "reduzir-perdas-produtos-parados",
      title: "Como reduzir perdas e produtos parados",
      excerpt: "Estratégias de vendas e organização para dar saída em mercadorias esquecidas.",
      content: `
        <h2 id="problema" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">O Custo Invisível</h2>
        <p class="mb-8">Olhe para o fundo das prateleiras do seu estoque. Aquele lote de produtos que não vende há 4 meses não é apenas um espaço ocupado. É dinheiro vivo que você desembolsou, que não está rendendo juros e, pior, está desvalorizando ou perto do vencimento.</p>
        
        <h2 id="estrategias" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Estratégias para "Girar" o Estoque</h2>
        <ul class="mb-8 space-y-4">
            <li><strong>Promoções Inteligentes:</strong> Faça ofertas combinadas (Cross-Selling). Leve produto A (alto giro) + Produto B (encalhado) com 15% de desconto.</li>
            <li><strong>Mudança de Layout:</strong> A famosa "Ponta de Gôndola" ou o caixa. Muitas vezes o produto não vende porque o cliente simplesmente não o vê.</li>
            <li><strong>Oferta para Clientes Fiéis:</strong> Se você tem cadastro dos clientes, mande um WhatsApp oferecendo aquele lote específico a um preço de custo (melhor recuperar o custo do que perder tudo no vencimento).</li>
        </ul>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "Produto parado é pior do que caixa vazio. Pelo menos no caixa vazio você sabe exatamente o que precisa fazer."
        </blockquote>

        <h2 id="prevencao" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Identificando com o ERP</h2>
        <p class="mb-8">Você não precisa adivinhar o que está encalhado. O relatório de <em>Produtos sem Movimentação</em> do HappyCash te mostra exatamente os itens que não tiveram vendas nos últimos 30, 60 ou 90 dias. A informação na sua mão, na hora certa, para tomar uma atitude rápida!</p>
      `,
      toc: [
        { id: "problema", label: "O Custo Invisível" },
        { id: "estrategias", label: "Estratégias para Girar" },
        { id: "prevencao", label: "Identificando com ERP" }
      ],
      image: "/telas/estoque.webp",
      date: "2026-02-05",
      category: "estoque",
      tags: ["Estoque", "Vendas", "Promoções"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "5",
    },
    {
      id: "blog-10",
      slug: "escolher-sistema-pdv",
      title: "PDV: o que observar antes de escolher um sistema",
      excerpt: "Os recursos essenciais que um bom sistema de Frente de Caixa precisa ter.",
      content: `
        <h2 id="agilidade" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Agilidade é Tudo</h2>
        <p class="mb-8">O PDV (Ponto de Venda ou Frente de Caixa) é a vitrine da sua operação. É ali que o cliente decide se volta ou não, baseado na fila e no tempo de espera. Um sistema lento trava toda a loja.</p>
        
        <h2 id="recursos" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Recursos Inegociáveis</h2>
        <p class="mb-8">Antes de contratar um sistema, verifique se ele possui:</p>
        <ul class="mb-8 space-y-4">
            <li><strong>Operação Rápida via Teclado:</strong> Uso de atalhos (F2, F4, etc) para não depender apenas do mouse.</li>
            <li><strong>Busca Inteligente:</strong> Bipar código de barras, buscar por nome parcial ou código interno.</li>
            <li><strong>Integrações:</strong> Comunicação fácil com balanças (mercados/padarias) e impressoras térmicas (Daruma, Bematech, Elgin).</li>
            <li><strong>Funcionamento Offline:</strong> Se a internet cair, o sistema deve permitir continuar vendendo e sincronizar depois.</li>
        </ul>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "A experiência do cliente na fila do caixa define a lembrança final que ele terá da sua loja."
        </blockquote>

        <h2 id="happycash-pdv" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">O PDV HappyCash</h2>
        <p class="mb-8">Nossa Frente de Caixa foi construída exatamente com foco em hiper-velocidade. Interface limpa, grandes botões (caso use telas touch) e total aderência a atalhos de teclado. Além disso, integração direta para impressão rápida de NFC-e ou recibos não fiscais.</p>
      `,
      toc: [
        { id: "agilidade", label: "Agilidade é Tudo" },
        { id: "recursos", label: "Recursos Inegociáveis" },
        { id: "happycash-pdv", label: "O PDV HappyCash" }
      ],
      image: "/telas/pdv.webp",
      date: "2026-01-25",
      category: "pdv",
      tags: ["PDV", "Sistema", "Automação"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "6",
    },
    {
      id: "blog-11",
      slug: "digitalizar-gestao",
      title: "Como começar a digitalizar a gestão do seu negócio",
      excerpt: "Os primeiros passos para largar o caderno e usar a tecnologia a seu favor.",
      content: `
        <h2 id="medo" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Vencendo o Medo do Novo</h2>
        <p class="mb-8">A transição do caderno/planilha para um sistema de gestão completo (ERP) assusta muitos empreendedores. O pensamento comum é: "meu negócio é pequeno, não preciso disso" ou "é muito complexo para mim". Mas a digitalização é o único caminho para escalar sem enlouquecer.</p>
        
        <h2 id="passos" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Passos Práticos</h2>
        <p class="mb-8">Não tente fazer tudo em um dia. Siga este roteiro:</p>
        <ol class="mb-8 space-y-4 list-decimal pl-6">
            <li><strong>Cadastros Básicos:</strong> Comece cadastrando os produtos mais vendidos (sua curva A) com preços de custo e venda corretos.</li>
            <li><strong>Operação de Caixa:</strong> Comece a registrar TODAS as vendas no sistema (PDV). Pare de anotar no caderno.</li>
            <li><strong>Lançamento de Despesas:</strong> Após dominar as vendas, comece a lançar as contas de água, luz, internet e fornecedores no módulo financeiro.</li>
            <li><strong>Análise:</strong> Ao final do primeiro mês operando 100% via sistema, sente e veja seus primeiros relatórios gerenciais!</li>
        </ol>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "Sistemas não dão trabalho. Eles exigem um esforço inicial de organização que vai lhe devolver centenas de horas de paz mental no futuro."
        </blockquote>

        <h2 id="suporte" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Suporte Importa</h2>
        <p class="mb-8">No HappyCash, sabemos que a implementação é a parte crítica. Por isso, nosso sistema é 100% visual e intuitivo, feito para que qualquer pessoa (mesmo sem grande conhecimento de informática) consiga operar no primeiro dia de uso, com auxílio do nosso time de suporte.</p>
      `,
      toc: [
        { id: "medo", label: "Vencendo o Medo" },
        { id: "passos", label: "Passos Práticos" },
        { id: "suporte", label: "Suporte Importa" }
      ],
      image: "/telas/tutorialinicial.webp",
      date: "2026-01-15",
      category: "gestao",
      tags: ["Inovação", "Gestão Digital", "Tecnologia"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "5",
    },
    {
      id: "blog-12",
      slug: "nfc-e-o-que-e",
      title: "NFC-e: o que é e quando sua empresa precisa emitir",
      excerpt: "Tudo o que você precisa saber sobre a Nota Fiscal de Consumidor Eletrônica.",
      content: `
        <h2 id="o-que-e" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">O Que é NFC-e?</h2>
        <p class="mb-8">A NFC-e (Nota Fiscal de Consumidor Eletrônica) é o documento fiscal eletrônico emitido nas vendas presenciais (no varejo) ou com entrega em domicílio para o consumidor final. Ela substituiu o antigo Cupom Fiscal (ECF).</p>
        
        <h2 id="vantagens" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Vantagens e Obrigatoriedades</h2>
        <p class="mb-8">Hoje, quase todos os estados brasileiros obrigam estabelecimentos comerciais a emitir NFC-e, inclusive MEI em caso de vendas para empresas. Mas ela traz vantagens pro empresário:</p>
        <ul class="mb-8 space-y-4">
            <li><strong>Economia:</strong> Não exige equipamentos fiscais caros e lacrados como as antigas impressoras ECF. Uma impressora térmica comum resolve.</li>
            <li><strong>Agilidade:</strong> A transmissão é feita pela internet instantaneamente.</li>
            <li><strong>Meio Ambiente e Praticidade:</strong> Pode ser enviada via e-mail ou WhatsApp (Danfe NFC-e Ecológico), economizando papel.</li>
        </ul>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "Estar em dia com o Fisco é garantir a tranquilidade jurídica para focar apenas no que importa: as vendas."
        </blockquote>

        <h2 id="emissao" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Emissão Simplificada</h2>
        <p class="mb-8">Para emitir, você só precisa de um Certificado Digital (A1 ou A3), internet e um ERP emissor. Com o HappyCash, a emissão acontece de forma invisível. Você finaliza a venda no PDV e o sistema se encarrega de assinar, comunicar com a SEFAZ, pegar a autorização e imprimir o cupom com o QR Code. Tudo em milissegundos.</p>
      `,
      toc: [
        { id: "o-que-e", label: "O Que é NFC-e?" },
        { id: "vantagens", label: "Vantagens" },
        { id: "emissao", label: "Emissão Simplificada" }
      ],
      image: "/telas/notafiscal.webp",
      date: "2026-01-10",
      category: "pdv",
      tags: ["Fiscal", "NFC-e", "Impostos"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "4",
    },
    {
      id: "blog-13",
      slug: "acompanhar-desempenho-vendas",
      title: "Como acompanhar o desempenho das vendas",
      excerpt: "Descubra as métricas essenciais para saber se seu negócio está realmente crescendo.",
      content: `
        <h2 id="metricas" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Faturamento x Desempenho</h2>
        <p class="mb-8">Olhar apenas para o faturamento total do mês esconde informações valiosas. Vender R$ 50 mil atendendo 1.000 clientes é diferente de vender os mesmos R$ 50 mil atendendo apenas 100 clientes. Você precisa analisar as métricas corretas.</p>
        
        <h2 id="kpis" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Os 3 KPIs de Varejo essenciais</h2>
        <ul class="mb-8 space-y-4">
            <li><strong>Ticket Médio:</strong> Quanto cada cliente gasta, em média, na sua loja (Faturamento Total / Nº de Clientes). Se o ticket médio sobe, seu esforço de vendas em cada atendimento está valendo a pena.</li>
            <li><strong>Taxa de Conversão:</strong> Quantas pessoas entraram na loja X quantas realmente compraram. Ajuda a avaliar a vitrine, os preços e o atendimento.</li>
            <li><strong>Produtos por Atendimento (PA):</strong> Quantos itens um cliente leva por compra. Essencial para avaliar se a loja está fazendo Cross-Selling (ex: oferecendo cinto na compra de uma calça).</li>
        </ul>

        <blockquote class="border-l-4 border-primary pl-6 my-12 italic text-xl font-medium text-foreground">
            "Não se gerencia o que não se mede, não se mede o que não se define, não se define o que não se entende."
        </blockquote>

        <h2 id="dashboard" class="text-3xl font-bold mb-6 text-foreground scroll-mt-32">Dashboards Inteligentes</h2>
        <p class="mb-8">Ter esses números na ponta do lápis seria inviável. É por isso que um sistema moderno como o HappyCash ERP traz Dashboards visuais. Assim que você loga no sistema, os gráficos apontam o Ticket Médio, comparativo com meses anteriores e o ranqueamento dos produtos mais vendidos. Gestão visual é gestão ágil!</p>
      `,
      toc: [
        { id: "metricas", label: "Faturamento x Desempenho" },
        { id: "kpis", label: "3 KPIs de Varejo" },
        { id: "dashboard", label: "Dashboards Inteligentes" }
      ],
      image: "/telas/operaçoes.webp",
      date: "2026-01-05",
      category: "vendas",
      tags: ["Resultados", "Métricas", "Vendas"],
      author: { name: "Equipe HappyCash", avatar: "/telas/pdv.webp" },
      readTime: "6",
    }
  ],
  gallery: [
    {
      id: "gal-1",
      title: "Frente de Caixa Inteligente",
      description:
        "PDV ágil, desenhado para tornar o processo de vendas rápido e sem filas.",
      date: "2026-01-20",
      type: "image",
      url: "/telas/pdv.webp",
      category: "vendas",
    },
    {
      id: "gal-2",
      title: "Controle de Estoque",
      description:
        "Tenha total controle sobre seus produtos, desde a entrada até a saída.",
      date: "2026-01-21",
      type: "image",
      url: "/telas/estoque.webp",
      category: "gestao",
    },
    {
      id: "gal-3",
      title: "Gestão Financeira",
      description:
        "Acompanhe o fluxo de caixa, despesas e receitas em tempo real.",
      date: "2026-01-22",
      type: "image",
      url: "/telas/Financeiro.webp",
      category: "financeiro",
    },
    {
      id: "gal-4",
      title: "Controle de Comandas",
      description: "Organize o atendimento por mesas ou comandas com facilidade.",
      date: "2026-01-23",
      type: "image",
      url: "/telas/comandas.webp",
      category: "vendas",
    },
    {
      id: "gal-5",
      title: "Dashboard de Relatórios",
      description: "Tome decisões melhores com dados e gráficos visuais do seu negócio.",
      date: "2026-01-24",
      type: "image",
      url: "/telas/relatorios.webp",
      category: "gestao",
    },
  ],
};

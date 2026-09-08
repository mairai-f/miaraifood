import screenshotGestao from "@/assets/pdv-principal-carrinho.webp";
import SolutionPage from "@/components/landing/SolutionPage";

const SistemaGestaoNegocios = () => {
  return (
    <SolutionPage
      seo={{
        title: "HappyCash ERP | Sistema de gestão para comércio",
        description:
          "HappyCash é um ERP e sistema de gestão para comércio pequeno, médio e grande porte. Controle fiado, PDV, estoque, clientes, RH, cobranças e relatórios.",
        path: "/sistema-de-gestao-de-negocios",
        image: screenshotGestao,
        keywords: [
          "happycash sistema",
          "HappyCash ERP",
          "erp sistema",
          "sistema ERP",
          "happycash gestão de negócios",
          "sistema de gestão de negócios",
          "sistema de gestão para pequenos negócios",
          "sistema de gestão para comércio pequeno médio e grande porte",
          "sistema de gestão para comércio médio",
          "sistema de gestão para comércio grande",
          "sistema de gestão para comércio",
          "sistema de gestão de vendas",
          "sistema de gestão de RH",
          "sistema para mercearia",
          "sistema para adega",
          "controle de fiado",
          "sistema pdv com estoque",
        ],
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "HappyCash",
          alternateName: ["HappyCash Sistema", "HappyCash ERP", "HappyCash Gestão de Negócios"],
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, Windows, Linux",
          url: "https://www.happycashsite.com.br/sistema-de-gestao-de-negocios",
          description:
            "ERP e sistema de gestão para comércio pequeno, médio e grande porte com controle de fiado, PDV, estoque, clientes, RH, cobranças e relatórios.",
        },
      }}
      eyebrow="ERP e sistema de gestão"
      title="HappyCash ERP para comércio pequeno, médio e grande porte"
      description="Organize fiado, vendas, estoque, clientes, caixa, RH e relatórios em um só lugar. O HappyCash ajuda comércios a sair do caderno e da planilha sem transformar a rotina em burocracia."
      highlightItems={[
        "Controle de fiado e clientes",
        "PDV para venda no balcão",
        "Estoque, RH e relatórios",
        "Cobrança pelo WhatsApp",
      ]}
      imageSrc={screenshotGestao}
      imageAlt="Tela do HappyCash sistema de gestão para negócios"
      promiseTitle="Gestão ERP para vender, cobrar, acompanhar e crescer"
      promiseDescription="O foco do HappyCash é juntar as partes importantes da operação em uma experiência direta: quem comprou, o que vendeu, quem deve, quanto entrou no caixa, quais produtos precisam de atenção e quais rotinas de equipe precisam de controle."
      promiseCards={[
        {
          title: "Menos controle espalhado",
          description: "Troque caderno, conversa antiga e planilha paralela por uma base organizada para clientes, vendas e estoque.",
        },
        {
          title: "Mais visão do negócio",
          description: "Acompanhe fiado, recebimentos, caixa, produtos, RH e relatórios para decidir com mais segurança no dia a dia.",
        },
        {
          title: "Rotina fácil de adotar",
          description: "O sistema foi pensado para comércio pequeno, médio e grande, com fluxo simples para balcão, cobrança, conferência e gestão interna.",
        },
      ]}
      workflowTitle="Como o sistema ajuda na gestão da loja"
      workflowDescription="A rotina começa no atendimento e termina com mais clareza sobre caixa, estoque e clientes."
      workflowSteps={[
        {
          title: "Cadastre a base",
          description: "Inclua clientes, produtos, preços e dados principais da loja para começar com organização.",
        },
        {
          title: "Venda e registre",
          description: "Use o PDV, registre fiado quando necessário e mantenha o histórico do cliente atualizado.",
        },
        {
          title: "Acompanhe resultados",
          description: "Veja cobranças, estoque, caixa, RH e relatórios sem precisar juntar informação manualmente.",
        },
      ]}
      featureTitle="Recursos de gestão que o HappyCash concentra"
      featureDescription="A proposta é dar controle para o comércio crescer sem exigir implantação complicada."
      featureCards={[
        {
          title: "Caderneta digital de fiado",
          description: "Controle dívidas, pagamentos, histórico por cliente e mensagens de cobrança pelo WhatsApp.",
        },
        {
          title: "Sistema PDV integrado",
          description: "Registre vendas, formas de pagamento, caixa e movimentação de balcão em poucos cliques.",
        },
        {
          title: "Controle de estoque",
          description: "Organize produtos, preços, entradas, saídas e estoque mínimo para reduzir perda de informação.",
        },
        {
          title: "Gestão de RH",
          description: "Centralize funcionários, permissões, ponto, escalas, férias, documentos e portal do funcionário.",
        },
        {
          title: "Relatórios para gestão",
          description: "Tenha uma visão mais clara da operação para entender vendas, recebimentos e rotina financeira.",
        },
      ]}
      faqs={[
        {
          question: "O HappyCash serve como sistema de gestão de negócios?",
          answer: "Sim. O HappyCash reúne controle de fiado, PDV, estoque, clientes, RH, cobranças e relatórios para comércios de pequeno, médio e grande porte.",
        },
        {
          question: "Consigo usar sem experiência com sistema?",
          answer: "A proposta é justamente ser simples para a rotina do comércio, reduzindo dependência de caderno e planilha.",
        },
        {
          question: "Esse sistema ajuda mercearia, adega, bar e loja?",
          answer: "Ajuda principalmente operações que vendem no balcão, controlam clientes no fiado e precisam acompanhar estoque e caixa.",
        },
      ]}
    />
  );
};

export default SistemaGestaoNegocios;

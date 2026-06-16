import screenshotGestao from "@/assets/pdv-principal-carrinho.webp";
import SolutionPage from "@/components/landing/SolutionPage";

const SistemaGestaoNegocios = () => {
  return (
    <SolutionPage
      seo={{
        title: "HappyCash sistema de gestão | Fiado, PDV, estoque e relatórios",
        description:
          "HappyCash é um sistema de gestão de negócios para comércio pequeno. Controle fiado, vendas no PDV, estoque, clientes e cobranças em uma rotina simples.",
        path: "/sistema-de-gestao-de-negocios",
        image: screenshotGestao,
        keywords: [
          "happycash sistema",
          "happycash gestão de negócios",
          "sistema de gestão de negócios",
          "sistema de gestão para pequenos negócios",
          "sistema de gestão para comércio",
          "sistema de gestão de vendas",
          "sistema para mercearia",
          "sistema para adega",
          "controle de fiado",
          "sistema pdv com estoque",
        ],
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "HappyCash",
          alternateName: ["HappyCash Sistema", "HappyCash Gestão de Negócios"],
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, Windows, Linux",
          url: "https://www.happycashsite.com.br/sistema-de-gestao-de-negocios",
          description:
            "Sistema de gestão para pequenos negócios com controle de fiado, PDV, estoque, clientes, cobranças e relatórios.",
        },
      }}
      eyebrow="Sistema de gestão"
      title="HappyCash sistema de gestão para pequenos negócios"
      description="Organize fiado, vendas, estoque, clientes e caixa em um só lugar. O HappyCash ajuda comércios pequenos a sair do caderno e da planilha sem transformar a rotina em burocracia."
      highlightItems={[
        "Controle de fiado e clientes",
        "PDV para venda no balcão",
        "Estoque e relatórios",
        "Cobrança pelo WhatsApp",
      ]}
      imageSrc={screenshotGestao}
      imageAlt="Tela do HappyCash sistema de gestão para negócios"
      promiseTitle="Gestão simples para vender, cobrar e acompanhar melhor"
      promiseDescription="O foco do HappyCash é juntar as partes importantes da operação em uma experiência direta: quem comprou, o que vendeu, quem deve, quanto entrou no caixa e quais produtos precisam de atenção."
      promiseCards={[
        {
          title: "Menos controle espalhado",
          description: "Troque caderno, conversa antiga e planilha paralela por uma base organizada para clientes, vendas e estoque.",
        },
        {
          title: "Mais visão do negócio",
          description: "Acompanhe fiado, recebimentos, caixa, produtos e relatórios para decidir com mais segurança no dia a dia.",
        },
        {
          title: "Rotina fácil de adotar",
          description: "O sistema foi pensado para comércio pequeno, com fluxo simples para balcão, cobrança e conferência.",
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
          description: "Veja cobranças, estoque, caixa e relatórios sem precisar juntar informação manualmente.",
        },
      ]}
      featureTitle="Recursos de gestão que o HappyCash concentra"
      featureDescription="A proposta é dar controle para pequenos negócios sem exigir implantação complicada."
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
          title: "Relatórios para gestão",
          description: "Tenha uma visão mais clara da operação para entender vendas, recebimentos e rotina financeira.",
        },
      ]}
      faqs={[
        {
          question: "O HappyCash serve como sistema de gestão de negócios?",
          answer: "Sim. O HappyCash reúne controle de fiado, PDV, estoque, clientes, cobranças e relatórios para pequenos negócios.",
        },
        {
          question: "Consigo usar sem experiência com sistema?",
          answer: "A proposta é justamente ser simples para a rotina do comércio pequeno, reduzindo dependência de caderno e planilha.",
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

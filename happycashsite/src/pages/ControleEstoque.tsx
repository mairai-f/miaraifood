import screenshotEstoque from "@/assets/estoque-painel.png";
import SolutionPage from "@/components/landing/SolutionPage";

const ControleEstoque = () => {
  return (
    <SolutionPage
      seo={{
        title: "Controle de estoque online | Entradas, saídas e estoque mínimo",
        description:
          "Tenha controle de estoque em tempo real sem depender de planilha. Acompanhe entradas, saídas, estoque mínimo e giro dos produtos com o HappyCash.",
        path: "/controle-de-estoque",
        image: screenshotEstoque,
        keywords: [
          "controle de estoque online",
          "sistema de estoque",
          "controle de entradas e saídas",
          "estoque mínimo",
          "estoque em tempo real",
        ],
      }}
      eyebrow="Controle de Estoque"
      title="Controle de estoque em tempo real sem planilha e sem susto"
      description="Acompanhe entradas, saídas e estoque mínimo para saber o que está girando, o que está acabando e o que precisa de reposição antes de virar problema."
      highlightItems={[
        "Entradas e saídas registradas",
        "Produtos com estoque mínimo",
        "Visão ligada ao PDV",
        "Mais clareza para comprar melhor",
      ]}
      imageSrc={screenshotEstoque}
      imageAlt="Tela de controle de estoque do HappyCash"
      promiseTitle="Pare de descobrir falta de produto tarde demais"
      promiseDescription="Quando o estoque é controlado no improviso, sobra ruptura, compra errada e dinheiro parado. A ideia aqui é dar visão rápida para decidir melhor."
      promiseCards={[
        {
          title: "Saiba o que está acabando",
          description: "O alerta de estoque mínimo ajuda a agir antes que o produto falte na prateleira ou no balcão.",
        },
        {
          title: "Enxergue entradas e saídas",
          description: "Cada movimentação fica registrada para você entender de onde veio e para onde foi o produto.",
        },
        {
          title: "Conecte venda e estoque",
          description: "Com o PDV integrado, a venda alimenta o controle e reduz o retrabalho de atualização manual.",
        },
      ]}
      workflowTitle="Controle simples para quem precisa decidir rápido"
      workflowDescription="Em vez de depender de memória ou papel, o estoque passa a ter um fluxo claro para acompanhar o que entra, sai e precisa ser reposto."
      workflowSteps={[
        {
          title: "Cadastre os produtos",
          description: "Organize nome, categoria, preço e dados principais para montar uma base consistente.",
        },
        {
          title: "Acompanhe as movimentações",
          description: "Registre entradas, saídas e consumo para o saldo refletir o que está acontecendo na operação.",
        },
        {
          title: "Compre com mais segurança",
          description: "Use a visão do estoque mínimo e do giro para repor com mais confiança e menos desperdício.",
        },
      ]}
      featureTitle="O que esse controle de estoque ajuda a resolver"
      featureDescription="O foco é reduzir perda de informação e melhorar a leitura da operação para comprar, vender e repor com mais segurança."
      featureCards={[
        {
          title: "Estoque mínimo por produto",
          description: "Acompanhe rapidamente quais itens precisam de atenção e priorize a reposição do que não pode faltar.",
        },
        {
          title: "Cadastro centralizado",
          description: "Mantenha código, nome, categoria e preço em um só lugar para reduzir erro operacional.",
        },
        {
          title: "Movimentações organizadas",
          description: "Entradas e saídas ficam registradas para facilitar conferência, auditoria e entendimento do saldo atual.",
        },
        {
          title: "Base para relatórios melhores",
          description: "Quando o estoque está organizado, fica mais fácil interpretar vendas, compras e desempenho dos produtos.",
        },
      ]}
      faqs={[
        {
          question: "Preciso usar planilha junto com o sistema?",
          answer: "Não. A proposta é justamente centralizar o controle no HappyCash para você não depender de planilhas paralelas.",
        },
        {
          question: "O estoque conversa com as vendas do PDV?",
          answer: "Sim. A operação do sistema foi pensada para que o controle da loja fique mais conectado e com menos retrabalho.",
        },
        {
          question: "Dá para testar esse controle antes de pagar?",
          answer: "Sim. Você pode criar sua conta e usar a demo grátis para validar se o fluxo encaixa na rotina da loja.",
        },
      ]}
    />
  );
};

export default ControleEstoque;

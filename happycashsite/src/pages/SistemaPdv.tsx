import screenshotPdv from "@/assets/pdv-principal-carrinho.png";
import SolutionPage from "@/components/landing/SolutionPage";

const SistemaPdv = () => {
  return (
    <SolutionPage
      seo={{
        title: "Sistema PDV online | Frente de caixa simples para vender rápido",
        description:
          "Organize sua frente de caixa com um sistema PDV simples. Registre vendas, acompanhe caixa, formas de pagamento e relatórios em um só lugar.",
        path: "/sistema-pdv",
        image: screenshotPdv,
        keywords: [
          "sistema pdv",
          "frente de caixa online",
          "pdv simples",
          "controle de caixa",
          "sistema para vender no balcão",
        ],
      }}
      eyebrow="Sistema PDV"
      title="Venda rápido no balcão com um sistema PDV simples e organizado"
      description="Abra o caixa, registre vendas, acompanhe dinheiro, Pix, cartão e fechamento sem depender de improviso. Tudo em um fluxo pensado para o dia a dia do balcão."
      highlightItems={[
        "Fechamento de caixa organizado",
        "Recebimentos por Pix, crédito e débito",
        "Resumo de vendas em tempo real",
        "Integração com estoque e relatórios",
      ]}
      imageSrc={screenshotPdv}
      imageAlt="Tela do sistema PDV do HappyCash"
      promiseTitle="Mais agilidade para vender, menos confusão no caixa"
      promiseDescription="O PDV do HappyCash ajuda a vender com velocidade, sem perder controle de pagamento, troco, caixa e histórico de operação."
      promiseCards={[
        {
          title: "Caixa mais rápido",
          description: "Atenda com poucos cliques e reduza atrito na hora de registrar os itens e concluir a venda.",
        },
        {
          title: "Menos erro no fechamento",
          description: "O sistema organiza abertura, vendas, saídas e saldo final para você fechar o caixa com confiança.",
        },
        {
          title: "Tudo conectado",
          description: "As vendas alimentam estoque, relatórios e visão do negócio sem retrabalho em outra planilha.",
        },
      ]}
      workflowTitle="Um fluxo direto para quem precisa vender bem"
      workflowDescription="A proposta do PDV é simples: registrar a venda sem travar a operação e sem perder a leitura do caixa."
      workflowSteps={[
        {
          title: "Abra o caixa",
          description: "Defina a abertura e deixe o turno preparado para receber vendas com mais controle.",
        },
        {
          title: "Registre a venda",
          description: "Adicione produtos, selecione a forma de pagamento e finalize com agilidade no balcão.",
        },
        {
          title: "Feche com segurança",
          description: "Confira resumo do período, saídas, saldo final e histórico para encerrar o caixa sem surpresas.",
        },
      ]}
      featureTitle="O que o PDV do HappyCash entrega no dia a dia"
      featureDescription="Além da venda em si, o sistema apoia o controle da loja para que o caixa não vire um ponto cego."
      featureCards={[
        {
          title: "Múltiplas formas de pagamento",
          description: "Receba em Pix, dinheiro, crédito ou débito com o registro certo para cada venda.",
        },
        {
          title: "Fechamento de caixa com recibo",
          description: "Organize abertura, saídas e vendas do período para ter um fechamento mais claro e auditável.",
        },
        {
          title: "Produtos e preços integrados",
          description: "Use o cadastro da loja no PDV para vender sem digitação repetitiva e com mais consistência.",
        },
        {
          title: "Relatórios para enxergar o movimento",
          description: "Acompanhe total vendido, desempenho por período e visão financeira sem depender de planilha paralela.",
        },
      ]}
      faqs={[
        {
          question: "Esse sistema PDV funciona em computador e celular?",
          answer: "Sim. O HappyCash funciona online e pode ser usado no computador, tablet e celular, dependendo da rotina da loja.",
        },
        {
          question: "O PDV também ajuda no fechamento do caixa?",
          answer: "Ajuda. O sistema organiza abertura, vendas, saídas e saldo final para deixar o fechamento mais claro.",
        },
        {
          question: "Posso testar antes de escolher um plano?",
          answer: "Sim. Você pode criar a conta e usar a demo grátis para validar o fluxo antes de avançar para um plano pago.",
        },
      ]}
    />
  );
};

export default SistemaPdv;

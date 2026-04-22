import screenshotFiado from "@/assets/screenshot-2.png";
import SolutionPage from "@/components/landing/SolutionPage";

const FiadoDigital = () => {
  return (
    <SolutionPage
      seo={{
        title: "Caderneta de Fiado Digital | Controle clientes e cobranças no WhatsApp",
        description:
          "Pare de usar caderno para controlar fiado. Cadastre clientes, veja quem te deve em tempo real e envie cobrança pronta pelo WhatsApp com o HappyCash.",
        path: "/caderneta-de-fiado-digital",
        image: screenshotFiado,
        keywords: [
          "caderneta de fiado digital",
          "controle de fiado",
          "controle de clientes fiado",
          "cobrança por whatsapp",
          "sistema para fiado",
        ],
      }}
      eyebrow="Caderneta de Fiado Digital"
      title="Controle seus clientes no fiado em segundos e pare de usar caderno"
      description="Registre cada venda fiada, acompanhe o saldo devedor do cliente em tempo real e envie a cobrança pronta pelo WhatsApp sem ficar procurando anotação perdida."
      highlightItems={[
        "Saldo devedor atualizado na hora",
        "Histórico completo por cliente",
        "Cobrança pronta pelo WhatsApp",
        "Funciona no celular e no computador",
      ]}
      imageSrc={screenshotFiado}
      imageAlt="Tela da caderneta de fiado digital do HappyCash"
      promiseTitle="Mais controle para quem vende no fiado todos os dias"
      promiseDescription="Se você anota no papel, esquece pagamento parcial ou demora para cobrar, essa página resolve o problema com um fluxo simples e visual."
      promiseCards={[
        {
          title: "Pare de perder informação",
          description: "Cada item lançado fica salvo no histórico do cliente, com data, valor e andamento do pagamento.",
        },
        {
          title: "Veja quem te deve agora",
          description: "Abra o cliente e enxergue saldo, itens pendentes, pagamentos e cobranças sem montar conta manualmente.",
        },
        {
          title: "Receba mais rápido",
          description: "O sistema monta a mensagem de cobrança para o WhatsApp, encurtando o caminho entre vender e receber.",
        },
      ]}
      workflowTitle="Do lançamento à cobrança em poucos passos"
      workflowDescription="O objetivo é tirar atrito da rotina. Você registra rápido, acompanha o valor em aberto e cobra sem perder tempo."
      workflowSteps={[
        {
          title: "Cadastre o cliente",
          description: "Salve nome e telefone uma vez e mantenha o histórico organizado por pessoa.",
        },
        {
          title: "Lance os produtos",
          description: "Adicione os itens vendidos no fiado e deixe o saldo devedor atualizado automaticamente.",
        },
        {
          title: "Cobre no WhatsApp",
          description: "Abra a conversa com resumo pronto e acompanhe os pagamentos diretamente no sistema.",
        },
      ]}
      featureTitle="Recursos pensados para o controle de fiado de verdade"
      featureDescription="Não é só uma lista bonita. É uma rotina prática para quem precisa registrar, acompanhar e receber."
      featureCards={[
        {
          title: "Histórico detalhado por cliente",
          description: "Veja tudo o que foi lançado, pago, editado ou removido, com contexto suficiente para não depender da memória.",
        },
        {
          title: "Pagamentos totais ou parciais",
          description: "Registre parcial ou quitação completa e mantenha o saldo correto sem fazer conta por fora.",
        },
        {
          title: "Mensagens personalizadas",
          description: "O nome da empresa e do cliente entram no texto da cobrança para a conversa já sair pronta.",
        },
        {
          title: "Consulta rápida do que está pendente",
          description: "Em segundos você descobre quem está devendo, quanto falta receber e quais itens seguem em aberto.",
        },
      ]}
      faqs={[
        {
          question: "Esse controle de fiado funciona no celular?",
          answer: "Sim. O HappyCash foi pensado para funcionar bem no celular, tablet e computador, então você pode lançar e cobrar de onde estiver.",
        },
        {
          question: "Consigo cobrar o cliente pelo WhatsApp?",
          answer: "Sim. O sistema abre o WhatsApp com a mensagem pronta para cobrança, incluindo resumo do cliente e saldo atualizado.",
        },
        {
          question: "Posso testar antes de pagar?",
          answer: "Pode. Existe uma demo grátis para você ver a rotina funcionando antes de escolher um plano pago.",
        },
      ]}
    />
  );
};

export default FiadoDigital;

import screenshotFiado from "@/assets/fiado-digital-clientes.png";
import SeoContentPage from "@/components/landing/SeoContentPage";
import { createSiteUrl } from "@/lib/siteSeo";

const path = "/app-para-fiado";
const title = "App para fiado: controle clientes, dívidas e cobranças";
const description = "O HappyCash ajuda comércio pequeno a controlar fiado com cadastro de clientes, histórico de dívidas e pagamentos sem depender de planilha.";

const AppParaFiado = () => (
  <SeoContentPage
    seo={{
      title: "App para fiado | Controle clientes e dívidas no HappyCash",
      description,
      path,
      image: "/favicon.png",
      keywords: ["app para fiado", "aplicativo de fiado", "controle fiado celular", "caderneta digital", "app controle de clientes"],
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "HappyCash",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, Windows, Linux",
        url: createSiteUrl(path),
        description,
        offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
      },
    }}
    eyebrow="App para fiado"
    title={title}
    description={description}
    imageSrc={screenshotFiado}
    imageAlt="Tela do app HappyCash com cadastro de clientes para fiado"
    quickWins={[
      "Cadastro de clientes com telefone e dados úteis para cobrança.",
      "Histórico de compras fiadas e pagamentos consultável em poucos cliques.",
      "Ideal para quem quer sair do caderno sem contratar um sistema difícil.",
    ]}
    sections={[
      {
        title: "O que um app para fiado precisa resolver",
        paragraphs: [
          "Um app para fiado não pode ser apenas um bloco de notas bonito. Ele precisa ajudar o comerciante a vender rápido, registrar a dívida corretamente e encontrar a informação quando chegar a hora de cobrar. Se a ferramenta exige muitos passos, a equipe volta para o caderno. Se registra pouco detalhe, a cobrança continua confusa.",
          "O HappyCash foi criado para simplificar esse processo. A rotina começa no cadastro do cliente e segue com o registro das dívidas e pagamentos. Assim, o dono do comércio enxerga quem deve, quanto deve e o que já foi quitado, sem procurar em conversas antigas ou planilhas separadas.",
        ],
      },
      {
        title: "Aplicativo de fiado para o dia a dia do balcão",
        paragraphs: [
          "No comércio pequeno, a ferramenta precisa acompanhar o ritmo do balcão. O cliente pede, o atendente registra, a venda entra no controle e o próximo atendimento continua. Por isso, a experiência do HappyCash evita uma lógica burocrática e foca no que realmente importa para a operação: cliente, valor, data, dívida e pagamento.",
          "Isso faz diferença principalmente em negócios onde o fiado é recorrente. Quando a informação está organizada, o comerciante consegue negociar melhor, identificar clientes que acumulam muito saldo e manter um relacionamento mais transparente.",
        ],
        bullets: [
          "Menos retrabalho no fechamento do caixa.",
          "Menos risco de esquecer venda pequena.",
          "Mais clareza para negociar pagamento com o cliente.",
        ],
      },
      {
        title: "Por que app é melhor que planilha para fiado",
        paragraphs: [
          "A planilha funciona no começo, mas costuma falhar quando o movimento aumenta. Ela depende de digitação manual, fórmulas corretas e disciplina para não misturar clientes. Também é comum a planilha ficar no computador de uma pessoa, enquanto a venda acontece no balcão com outra pessoa atendendo.",
          "Um app pensado para fiado reduz essa fricção. Ele organiza o fluxo em telas próprias, diminui campos soltos e deixa a consulta mais simples. O objetivo não é deixar a operação sofisticada demais, e sim tornar o básico confiável todos os dias.",
        ],
      },
      {
        title: "Quando vale começar a usar o HappyCash",
        paragraphs: [
          "Vale começar quando o caderno já não mostra a situação real do caixa, quando clientes perguntam valores e ninguém tem certeza, ou quando você percebe que parte do lucro fica presa em dívidas mal acompanhadas. Não precisa esperar o comércio crescer para organizar o fiado. Pelo contrário: quanto mais cedo o controle começa, menos histórico bagunçado será necessário corrigir depois.",
          "O HappyCash permite começar pequeno, com poucos clientes, e evoluir junto com a loja. Além do fiado, o sistema também tem recursos de PDV e estoque, o que ajuda a conectar venda, produto e recebimento em uma rotina mais completa.",
        ],
      },
    ]}
    faqs={[
      {
        question: "O HappyCash é só para celular?",
        answer: "O HappyCash pode ser usado pela web e também tem executáveis para computador, dependendo da operação que você quer montar.",
      },
      {
        question: "Consigo cadastrar clientes antigos?",
        answer: "Sim. Você pode começar cadastrando os principais clientes e migrar o controle aos poucos.",
      },
      {
        question: "App para fiado ajuda na cobrança?",
        answer: "Ajuda porque mostra saldo e histórico com clareza. Isso torna a cobrança mais objetiva e evita discussão sobre valores.",
      },
    ]}
    relatedLinks={[
      {
        title: "Controle de fiado",
        href: "/controle-de-fiado",
        description: "Entenda a estrutura ideal para controlar vendas fiadas.",
      },
      {
        title: "Planilha de fiado vs app",
        href: "/blog/planilha-de-fiado-vs-app",
        description: "Compare as duas formas de controle antes de decidir.",
      },
      {
        title: "Sistema PDV",
        href: "/sistema-pdv",
        description: "Veja como o controle de fiado se conecta com a venda no caixa.",
      },
    ]}
  />
);

export default AppParaFiado;

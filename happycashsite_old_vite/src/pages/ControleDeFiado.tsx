import screenshotFiado from "@/assets/fiado-digital-dividas-agrupadas.webp";
import SeoContentPage from "@/components/landing/SeoContentPage";
import { createSiteUrl } from "@/lib/siteSeo";

const path = "/controle-de-fiado";
const title = "Controle de fiado para vender sem perder dinheiro";
const description = "Veja como organizar vendas fiadas, clientes, pagamentos parciais e cobranças no HappyCash sem depender de caderno ou planilha.";

const ControleDeFiado = () => (
  <SeoContentPage
    seo={{
      title: "Controle de fiado | Sistema para vender fiado sem caderno",
      description,
      path,
      image: "/favicon.webp",
      keywords: [
        "controle de fiado",
        "sistema de fiado",
        "caderneta de fiado digital",
        "fiado para mercadinho",
        "controle de clientes fiado",
      ],
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: title,
          description,
          url: createSiteUrl(path),
          inLanguage: "pt-BR",
          isPartOf: { "@type": "WebSite", name: "HappyCash", url: createSiteUrl("/") },
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Como controlar fiado sem caderno?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Use um sistema que registre cliente, valor, data, histórico de pagamentos e saldo em aberto. Assim cada venda fica vinculada ao cliente certo e a cobrança não depende de memória.",
              },
            },
            {
              "@type": "Question",
              name: "O HappyCash serve para mercado, bar e mercearia?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Sim. O HappyCash foi pensado para comércios pequenos que precisam controlar fiado, PDV e estoque de forma simples.",
              },
            },
          ],
        },
      ],
    }}
    eyebrow="Controle de fiado"
    title={title}
    description={description}
    imageSrc={screenshotFiado}
    imageAlt="Tela do HappyCash mostrando dívidas fiadas agrupadas por cliente"
    quickWins={[
      "Registre cada venda fiada no nome do cliente certo, com histórico e saldo sempre visíveis.",
      "Controle pagamentos parciais sem apagar a dívida original nem perder o caminho da cobrança.",
      "Troque o caderno por uma rotina mais profissional para mercadinho, bar, padaria e adega.",
    ]}
    sections={[
      {
        title: "Por que o controle de fiado precisa sair do improviso",
        paragraphs: [
          "O fiado ajuda a manter clientes próximos, mas também pode virar um buraco no caixa quando fica espalhado em caderno, foto de WhatsApp, bilhete e memória. O problema não é vender fiado. O problema é não saber exatamente quem deve, quanto deve, quando comprou e quais pagamentos já foram feitos.",
          "Um bom controle de fiado organiza o relacionamento com o cliente sem criar constrangimento. O comerciante consegue consultar o saldo, explicar a dívida com clareza e receber aos poucos quando for necessário. Para quem vende no balcão todos os dias, essa clareza reduz discussão, evita duplicidade e protege o dinheiro que já saiu em produto.",
        ],
        bullets: [
          "Cliente, telefone, limite e histórico de compras em um só lugar.",
          "Valor em aberto atualizado depois de cada pagamento.",
          "Consulta rápida para cobrar sem depender de páginas rasuradas.",
        ],
      },
      {
        title: "Como o HappyCash organiza vendas fiadas",
        paragraphs: [
          "No HappyCash, a venda fiada deixa de ser uma anotação solta. Ela passa a fazer parte do fluxo do comércio: o cliente é cadastrado, a dívida é criada com data e valor, e os pagamentos entram no histórico. Isso ajuda tanto no atendimento do dia quanto no fechamento do mês.",
          "Essa estrutura também melhora a confiança. Quando o cliente pergunta quanto está devendo, você não precisa procurar em várias páginas. O sistema mostra as dívidas agrupadas, os pagamentos registrados e o total pendente. Para o dono, isso significa menos tempo conferindo papel e mais tempo vendendo.",
        ],
      },
      {
        title: "Controle de fiado para mercadinho, bar, adega e padaria",
        paragraphs: [
          "Cada tipo de comércio tem uma rotina diferente, mas a dor do fiado costuma ser parecida: venda rápida, cliente conhecido, pagamento depois. Em mercadinhos e mercearias, o volume de pequenas compras aumenta a chance de esquecer valores. Em bares e adegas, a cobrança costuma acontecer depois de vários pedidos. Em padarias, o movimento rápido no balcão torna o caderno ainda mais sujeito a erro.",
          "Com o HappyCash, a ideia é manter a simplicidade do atendimento e melhorar o controle por trás dele. Você registra o que foi vendido, escolhe o cliente e acompanha o saldo. O resultado é uma caderneta de fiado digital com mais organização, sem exigir processo complicado.",
        ],
      },
      {
        title: "O que observar antes de escolher um sistema de fiado",
        paragraphs: [
          "Antes de trocar o caderno por um sistema, verifique se ele resolve o básico de verdade: cadastro de cliente, histórico de dívidas, baixa de pagamentos, busca rápida e acesso fácil no dia a dia. Também vale observar se o sistema conversa com PDV e estoque, porque o fiado não acontece separado da venda.",
          "O HappyCash junta esses pontos em uma experiência única. Isso facilita para quem quer começar simples e depois evoluir o controle do comércio, sem usar uma ferramenta para clientes, outra para caixa e outra para produtos.",
        ],
        bullets: [
          "Evite soluções que só guardam texto livre e não calculam saldo.",
          "Prefira histórico claro para resolver dúvidas com clientes.",
          "Busque uma rotina que funcione durante o movimento do balcão.",
        ],
      },
    ]}
    faqs={[
      {
        question: "Controle de fiado digital substitui o caderno?",
        answer: "Sim. A função é substituir a anotação manual por cadastro, histórico e saldo atualizado, mantendo a venda fiada organizada e consultável.",
      },
      {
        question: "Dá para registrar pagamento parcial?",
        answer: "Dá. O controle ideal registra o pagamento sem apagar a dívida original, preservando o histórico para conferência.",
      },
      {
        question: "Preciso ter loja grande para usar?",
        answer: "Não. O HappyCash é pensado principalmente para comércio pequeno que precisa sair do improviso sem complicar a operação.",
      },
    ]}
    relatedLinks={[
      {
        title: "Caderneta de fiado digital",
        href: "/caderneta-de-fiado-digital",
        description: "Conheça a página principal da solução de fiado do HappyCash.",
      },
      {
        title: "App para fiado",
        href: "/app-para-fiado",
        description: "Veja como controlar clientes e dívidas com uma rotina mais prática.",
      },
      {
        title: "Como controlar fiado no mercadinho",
        href: "/blog/como-controlar-fiado-no-mercadinho",
        description: "Guia prático para reduzir perdas com vendas fiadas.",
      },
    ]}
  />
);

export default ControleDeFiado;

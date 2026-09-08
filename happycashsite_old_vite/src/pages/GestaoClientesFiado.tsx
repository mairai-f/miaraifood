import screenshotHistorico from "@/assets/fiado-digital-historico-agrupado.webp";
import SeoContentPage from "@/components/landing/SeoContentPage";
import { createSiteUrl } from "@/lib/siteSeo";

const path = "/gestao-de-clientes-fiado";
const title = "Gestão de clientes no fiado para vender com mais segurança";
const description = "Organize clientes que compram fiado, acompanhe histórico, saldo aberto e pagamentos para reduzir perdas no comércio.";

const GestaoClientesFiado = () => (
  <SeoContentPage
    seo={{
      title: "Gestão de clientes fiado | Histórico e cobrança no HappyCash",
      description,
      path,
      image: "/favicon.webp",
      keywords: ["gestão de clientes fiado", "clientes fiado", "controle de clientes", "cobrança de fiado", "histórico de fiado"],
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: title,
        description,
        url: createSiteUrl(path),
        inLanguage: "pt-BR",
      },
    }}
    eyebrow="Clientes no fiado"
    title={title}
    description={description}
    imageSrc={screenshotHistorico}
    imageAlt="Tela do HappyCash com histórico de dívidas fiadas agrupado"
    quickWins={[
      "Veja quais clientes concentram maior saldo em aberto.",
      "Use histórico para negociar pagamento com informação clara.",
      "Evite venda fiada sem contexto sobre compras anteriores.",
    ]}
    sections={[
      {
        title: "Fiado começa no relacionamento com o cliente",
        paragraphs: [
          "Controlar fiado não é apenas somar dívidas. É gerir clientes. Cada pessoa tem um histórico, uma frequência de compra, um padrão de pagamento e um nível de confiança. Quando essas informações ficam soltas, o comerciante decide no escuro e pode continuar vendendo para quem já está com saldo alto demais.",
          "A gestão de clientes no fiado ajuda a transformar relacionamento em informação. Com cadastro, telefone, histórico e saldo em aberto, fica mais fácil decidir quando vender, quando cobrar e quando combinar um pagamento parcial.",
        ],
      },
      {
        title: "Histórico evita cobrança confusa",
        paragraphs: [
          "Uma das maiores fontes de atrito no fiado é a dúvida sobre o valor. O cliente acha que pagou, o atendente não lembra, o caderno tem rasura e a conversa fica ruim. Quando o histórico está organizado, a cobrança deixa de ser uma opinião e passa a ser uma conferência.",
          "No HappyCash, a ideia é manter as informações importantes reunidas para que o dono do comércio tenha segurança ao conversar com o cliente. Isso não elimina a necessidade de bom senso, mas dá base para uma relação mais transparente.",
        ],
        bullets: [
          "Compras e pagamentos registrados por cliente.",
          "Saldo em aberto mais fácil de acompanhar.",
          "Menos dependência de memória ou anotação manual.",
        ],
      },
      {
        title: "Como usar dados para reduzir perdas",
        paragraphs: [
          "Quando você enxerga a carteira de clientes fiados, consegue agir antes que o problema cresça. Clientes com saldo alto podem receber uma cobrança antes de novas vendas. Clientes que pagam bem podem continuar comprando com mais tranquilidade. Clientes parados podem ser recuperados com uma mensagem simples.",
          "Esse acompanhamento também ajuda o caixa. O dinheiro que está no fiado é parte da operação, mas ainda não entrou. Se esse valor fica invisível, o comércio pode comprar estoque, pagar fornecedor e fazer promoção sem considerar o que está preso em recebíveis informais.",
        ],
      },
      {
        title: "Gestão simples, sem burocracia",
        paragraphs: [
          "A gestão de clientes no fiado precisa ser simples o suficiente para virar hábito. O HappyCash procura fazer isso com telas objetivas, foco no saldo e integração com a rotina de venda. A proposta é organizar o essencial sem transformar o pequeno comércio em uma operação pesada.",
          "Com o tempo, esse hábito cria um histórico valioso. O comerciante passa a conhecer melhor quem compra, quem paga e onde estão os riscos. Isso melhora a tomada de decisão e deixa o fiado mais saudável para os dois lados.",
        ],
      },
    ]}
    faqs={[
      {
        question: "Preciso colocar limite para cada cliente?",
        answer: "Não é obrigatório, mas acompanhar saldo em aberto ajuda a decidir quando pausar novas vendas fiadas para determinado cliente.",
      },
      {
        question: "Histórico de fiado ajuda em cobrança pelo WhatsApp?",
        answer: "Sim. Com valores e pagamentos organizados, a conversa fica mais objetiva e profissional.",
      },
      {
        question: "Posso começar só com os clientes que mais compram fiado?",
        answer: "Pode. Uma migração gradual costuma ser mais fácil e já resolve os maiores riscos primeiro.",
      },
    ]}
    relatedLinks={[
      {
        title: "Controle de fiado",
        href: "/controle-de-fiado",
        description: "Veja a estrutura completa para organizar vendas fiadas.",
      },
      {
        title: "App para fiado",
        href: "/app-para-fiado",
        description: "Entenda como usar um app para clientes e dívidas.",
      },
      {
        title: "Controle de estoque",
        href: "/controle-de-estoque",
        description: "Conecte venda fiada com produto e reposição.",
      },
    ]}
  />
);

export default GestaoClientesFiado;

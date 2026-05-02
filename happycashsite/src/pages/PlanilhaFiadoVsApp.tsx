import screenshotFiado from "@/assets/fiado-digital-clientes.webp";
import SeoContentPage from "@/components/landing/SeoContentPage";
import { createSiteUrl } from "@/lib/siteSeo";

const path = "/blog/planilha-de-fiado-vs-app";
const title = "Planilha de fiado ou app: qual é melhor para controlar clientes?";
const description = "Compare planilha de fiado e app de controle para entender quando vale trocar o Excel por um sistema como o HappyCash.";

const PlanilhaFiadoVsApp = () => (
  <SeoContentPage
    seo={{
      title: "Planilha de fiado vs app | O que é melhor para controlar fiado",
      description,
      path,
      type: "article",
      image: "/favicon.webp",
      keywords: ["planilha de fiado", "app de fiado", "controle de fiado excel", "sistema de fiado", "controle clientes fiado"],
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        url: createSiteUrl(path),
        datePublished: "2026-04-30",
        dateModified: "2026-04-30",
        inLanguage: "pt-BR",
        author: { "@type": "Organization", name: "HappyCash" },
        publisher: { "@type": "Organization", name: "HappyCash" },
      },
    }}
    eyebrow="Comparativo"
    title={title}
    description={description}
    imageSrc={screenshotFiado}
    imageAlt="Tela do HappyCash com lista de clientes para controle de fiado"
    quickWins={[
      "Planilha ajuda no começo, mas exige disciplina e conferência manual.",
      "App reduz erro porque já organiza cliente, dívida, pagamento e saldo.",
      "Sistema conectado ao PDV evita que o fiado fique separado da venda real.",
    ]}
    sections={[
      {
        title: "Quando a planilha de fiado funciona",
        paragraphs: [
          "A planilha de fiado pode funcionar quando o comércio tem poucos clientes, pouco movimento e apenas uma pessoa responsável pelos lançamentos. Ela é barata, flexível e conhecida por muita gente. Para começar a sair do caderno, pode parecer uma boa ponte.",
          "O problema aparece quando a rotina cresce. A planilha depende de campos bem preenchidos, fórmulas intactas e atualização constante. Se alguém esquece de lançar uma compra ou altera uma fórmula sem perceber, o saldo deixa de ser confiável. Em fiado, saldo errado vira perda de dinheiro ou conflito com cliente.",
        ],
      },
      {
        title: "Onde a planilha começa a falhar",
        paragraphs: [
          "A planilha não foi feita especificamente para o balcão. Ela não guia o atendente, não impede tantos erros de digitação e nem sempre fica disponível para todas as pessoas que vendem. Também é comum ter versões diferentes do arquivo, cópias antigas e linhas duplicadas.",
          "Outro ponto é o histórico. Quando um cliente paga uma parte, alguém precisa decidir como registrar: cria nova linha, edita saldo, adiciona observação ou risca valor? Sem padrão, cada pessoa faz de um jeito. Depois de alguns meses, entender a dívida vira um trabalho cansativo.",
        ],
        bullets: [
          "Risco de apagar fórmula ou alterar saldo manualmente.",
          "Dificuldade para consultar histórico por cliente.",
          "Pouca conexão com caixa, estoque e venda no PDV.",
        ],
      },
      {
        title: "Por que um app de fiado é mais confiável",
        paragraphs: [
          "Um app de fiado foi desenhado para uma rotina específica. Em vez de uma tabela vazia, ele oferece telas para clientes, dívidas, pagamentos e consulta de saldo. Isso reduz decisões improvisadas e ajuda a equipe a seguir sempre o mesmo processo.",
          "No HappyCash, o controle de fiado também pode caminhar junto com PDV e estoque. Essa conexão é importante porque a dívida nasce de uma venda real. Quando o fiado fica isolado em uma planilha, o comerciante perde visão sobre produto vendido, caixa e recebimento.",
        ],
      },
      {
        title: "Quando trocar a planilha por um sistema",
        paragraphs: [
          "A troca vale a pena quando você já confere a planilha mais do que usa, quando clientes questionam valores com frequência, quando há mais de uma pessoa vendendo fiado ou quando o saldo em aberto começa a pesar no caixa. Esses sinais mostram que a planilha deixou de ser solução e virou risco operacional.",
          "Migrar não precisa ser difícil. Comece pelos clientes ativos, registre os saldos atuais e passe a lançar as novas vendas no app. Aos poucos, o histórico novo fica mais confiável que o antigo e a equipe ganha segurança para abandonar o improviso.",
        ],
      },
    ]}
    faqs={[
      {
        question: "Planilha de fiado é ruim?",
        answer: "Não necessariamente. Ela pode servir no começo, mas fica limitada quando o volume cresce ou mais pessoas precisam lançar vendas.",
      },
      {
        question: "App de fiado substitui Excel?",
        answer: "Sim, quando o app oferece cadastro de clientes, histórico, pagamentos e saldo atualizado com menos risco de erro manual.",
      },
      {
        question: "Consigo migrar aos poucos para o HappyCash?",
        answer: "Sim. Você pode cadastrar os clientes principais e usar o sistema para novas vendas enquanto organiza o histórico antigo.",
      },
    ]}
    relatedLinks={[
      {
        title: "App para fiado",
        href: "/app-para-fiado",
        description: "Veja como funciona uma rotina mais prática que a planilha.",
      },
      {
        title: "Controle de fiado",
        href: "/controle-de-fiado",
        description: "Entenda os recursos essenciais para vender fiado com segurança.",
      },
      {
        title: "Sistema PDV",
        href: "/sistema-pdv",
        description: "Conecte o controle de fiado ao caixa da loja.",
      },
    ]}
    ctaTitle="Quer sair da planilha sem complicar a loja?"
  />
);

export default PlanilhaFiadoVsApp;

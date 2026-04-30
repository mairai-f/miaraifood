import screenshotPdvFiado from "@/assets/pdv-finalizar-venda-fiado.png";
import SeoContentPage from "@/components/landing/SeoContentPage";
import { createSiteUrl } from "@/lib/siteSeo";

const path = "/blog/como-controlar-fiado-no-mercadinho";
const title = "Como controlar fiado no mercadinho sem perder dinheiro";
const description = "Aprenda uma rotina simples para registrar clientes, compras fiadas, pagamentos e cobranças no mercadinho com mais segurança.";

const ComoControlarFiadoMercadinho = () => (
  <SeoContentPage
    seo={{
      title: "Como controlar fiado no mercadinho | Guia HappyCash",
      description,
      path,
      type: "article",
      image: "/favicon.png",
      keywords: ["como controlar fiado no mercadinho", "fiado mercadinho", "controle de fiado mercado", "caderneta de fiado", "cobrança de fiado"],
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
    eyebrow="Guia para mercadinho"
    title={title}
    description={description}
    imageSrc={screenshotPdvFiado}
    imageAlt="Tela de finalização de venda fiada no HappyCash"
    quickWins={[
      "Crie uma regra clara para vender fiado e evite exceções no impulso.",
      "Registre a venda no momento do atendimento, não no fim do dia.",
      "Faça cobranças pequenas e frequentes antes que a dívida fique alta.",
    ]}
    sections={[
      {
        title: "1. Comece cadastrando os clientes principais",
        paragraphs: [
          "O primeiro passo para controlar fiado no mercadinho é saber exatamente quem compra dessa forma. Não adianta anotar apenas um primeiro nome no caderno, porque logo aparecem clientes com nomes parecidos, familiares comprando na mesma conta e valores que ninguém consegue conferir.",
          "Cadastre nome, telefone e, se possível, uma observação sobre a rotina de pagamento. Esse cadastro não precisa ser burocrático. Ele só precisa permitir que a dívida fique vinculada à pessoa certa. No HappyCash, essa base de clientes ajuda a organizar compras, pagamentos e histórico em um só fluxo.",
        ],
      },
      {
        title: "2. Registre cada compra fiada na hora",
        paragraphs: [
          "O erro mais comum é deixar para anotar depois. No movimento do mercadinho, uma venda pequena parece fácil de lembrar, mas várias vendas pequenas somadas criam uma diferença grande no caixa. Quando o registro acontece no momento da venda, o risco de esquecimento cai bastante.",
          "A rotina ideal é simples: cliente pediu para colocar na conta, você seleciona o cliente, registra a venda e confirma o valor. O sistema guarda data e saldo. Isso cria um histórico que pode ser consultado quando o cliente voltar ou quando chegar o dia combinado de pagamento.",
        ],
        bullets: [
          "Não misture compras de clientes diferentes na mesma anotação.",
          "Evite deixar vendas para registrar no fechamento.",
          "Confira o nome do cliente antes de salvar a dívida.",
        ],
      },
      {
        title: "3. Combine pagamento e acompanhe saldo",
        paragraphs: [
          "Fiado sem combinado vira cobrança desconfortável. Mesmo quando o cliente é conhecido, vale alinhar uma data ou uma frequência de pagamento. Pode ser semanal, quinzenal ou no dia em que ele recebe. O importante é que o saldo não cresça sem acompanhamento.",
          "Com o saldo visível, o dono do mercadinho consegue tomar decisões melhores. Se o cliente já está devendo muito, talvez seja hora de pedir um pagamento parcial antes de liberar novas compras. Se ele paga sempre em dia, a relação continua saudável.",
        ],
      },
      {
        title: "4. Use pagamento parcial sem perder histórico",
        paragraphs: [
          "Muitos clientes não quitam tudo de uma vez. Por isso, o controle precisa aceitar pagamento parcial. O ponto importante é registrar o valor pago sem apagar a dívida original, porque o histórico ajuda a explicar o que aconteceu e evita dúvidas depois.",
          "No caderno, pagamentos parciais costumam virar risco: risca valor, escreve outro, passa página, esquece data. Em um sistema, o pagamento entra como movimento e o saldo é recalculado. A operação fica mais limpa e mais fácil de conferir.",
        ],
      },
      {
        title: "5. Faça cobrança com informação, não com pressão",
        paragraphs: [
          "Cobrar fiado faz parte da rotina, mas a forma de cobrar muda tudo. Quando você tem informação clara, pode enviar uma mensagem objetiva: valor em aberto, data das compras e possibilidade de pagamento parcial. Isso é mais profissional do que uma cobrança genérica baseada em memória.",
          "O HappyCash ajuda nessa organização porque mantém o histórico do cliente acessível. O sistema não substitui o relacionamento, mas dá ao comerciante uma base confiável para conversar, negociar e receber.",
        ],
      },
    ]}
    faqs={[
      {
        question: "Mercadinho pequeno precisa de sistema para fiado?",
        answer: "Se já existe venda fiada recorrente, um sistema ajuda mesmo em operação pequena, porque evita perda por esquecimento e facilita cobrança.",
      },
      {
        question: "Devo acabar com o fiado?",
        answer: "Nem sempre. Para muitos comércios, o fiado fideliza clientes. O melhor é controlar melhor, definir regras e acompanhar saldo.",
      },
      {
        question: "O HappyCash serve para começar aos poucos?",
        answer: "Sim. Você pode cadastrar primeiro os clientes que mais compram fiado e migrar o restante conforme a rotina evoluir.",
      },
    ]}
    relatedLinks={[
      {
        title: "Controle de fiado",
        href: "/controle-de-fiado",
        description: "Página principal sobre organização de vendas fiadas.",
      },
      {
        title: "Gestão de clientes no fiado",
        href: "/gestao-de-clientes-fiado",
        description: "Aprenda a acompanhar clientes, saldo e histórico.",
      },
      {
        title: "Caderneta de fiado digital",
        href: "/caderneta-de-fiado-digital",
        description: "Veja como o HappyCash substitui o caderno manual.",
      },
    ]}
    ctaTitle="Pronto para organizar o fiado do mercadinho?"
  />
);

export default ComoControlarFiadoMercadinho;

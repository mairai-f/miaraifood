import { BarChart3, BookOpen, Clock3, MessageCircle } from "lucide-react";

const outcomes = [
  {
    icon: BookOpen,
    title: "Cliente identificado",
    description: "Nome, telefone, saldo e historico aparecem sem procurar caderno.",
    tone: "bg-amber-50 border-amber-200 dark:bg-amber-950/25 dark:border-amber-900/60",
  },
  {
    icon: Clock3,
    title: "Venda registrada",
    description: "Produto, quantidade, forma de pagamento e fiado entram no mesmo fluxo.",
    tone: "bg-sky-50 border-sky-200 dark:bg-sky-950/25 dark:border-sky-900/60",
  },
  {
    icon: MessageCircle,
    title: "Cobranca pronta",
    description: "A mensagem sai organizada para cobrar sem digitar tudo de novo.",
    tone: "bg-green-50 border-green-200 dark:bg-green-950/25 dark:border-green-900/60",
  },
  {
    icon: BarChart3,
    title: "Caixa conferido",
    description: "Pix, debito, credito, dinheiro e saidas ficam separados para fechar melhor.",
    tone: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/25 dark:border-indigo-900/60",
  },
];

const OutcomeHighlights = () => {
  return (
    <section className="relative bg-gradient-to-b from-background via-[#f1fbff] to-background py-20 dark:via-[#071729] md:py-24">
      <div className="container">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1fr] lg:items-center">
          <div>
            <span className="inline-block text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              Rotina mais simples
            </span>
            <h2 className="mt-4 font-heading text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
              Do balcão ao fechamento, sem improviso.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-muted-foreground">
              A proposta visual agora acompanha a rotina de uma loja: vender rapido, controlar quem deve, cobrar melhor e conferir o dinheiro no fim do dia.
            </p>
          </div>

          <ol className="relative grid gap-3 md:grid-cols-2">
            {outcomes.map((item, index) => (
              <li key={item.title} className={`rounded-lg border p-5 shadow-sm ${item.tone}`}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span className="font-heading text-3xl font-bold text-primary/20">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="font-heading text-xl font-bold leading-snug">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
};

export default OutcomeHighlights;

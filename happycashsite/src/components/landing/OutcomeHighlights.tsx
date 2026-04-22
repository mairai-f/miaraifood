import { BarChart3, BookOpen, Clock3, MessageCircle } from "lucide-react";

const outcomes = [
  {
    icon: BookOpen,
    title: "Controle seus clientes no fiado em segundos",
    description: "Cadastre o cliente, lance o produto e acompanhe o saldo devedor sem depender de caderno.",
  },
  {
    icon: Clock3,
    title: "Pare de usar caderno e planilha",
    description: "Centralize vendas, pagamentos e histórico em um painel simples de usar no celular ou computador.",
  },
  {
    icon: BarChart3,
    title: "Veja quem te deve em tempo real",
    description: "Descubra rápido quem está devendo, quanto falta receber e quais clientes já pagaram.",
  },
  {
    icon: MessageCircle,
    title: "Cobre pelo WhatsApp com 1 clique",
    description: "Abra a conversa com a mensagem pronta para cobrança e ganhe velocidade na hora de receber.",
  },
];

const OutcomeHighlights = () => {
  return (
    <section className="relative py-20 md:py-24">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />

      <div className="container relative z-10">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="inline-block text-sm font-semibold uppercase tracking-[0.28em] text-primary">
            Valor na prática
          </span>
          <h2 className="mt-4 font-heading text-3xl font-bold leading-tight md:text-4xl lg:text-5xl">
            Menos improviso. Mais controle sobre fiado, vendas e estoque.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            O HappyCash foi feito para quem precisa controlar clientes no fiado, vender rápido no PDV e enxergar o negócio sem perder tempo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {outcomes.map((item) => (
            <article
              key={item.title}
              className="rounded-3xl border border-border/70 bg-card/70 p-6 shadow-lg shadow-black/5 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1 hover:border-primary/40"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <item.icon size={22} />
              </div>
              <h3 className="font-heading text-lg font-semibold leading-snug">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OutcomeHighlights;

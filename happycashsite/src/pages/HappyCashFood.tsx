import {
  BadgeDollarSign,
  ChefHat,
  CheckCircle2,
  Clock,
  Download,
  LayoutDashboard,
  MonitorDown,
  Package,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Truck,
  Utensils,
} from "lucide-react";
import foodLogo from "@/assets/happycashfood.webp";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SiteSeo from "@/components/seo/SiteSeo";

const modules = [
  { icon: LayoutDashboard, title: "Mesas e comandas", text: "Abertura de mesa, consumo em tempo real, transferencia, juncao e fechamento." },
  { icon: ChefHat, title: "Cozinha KDS", text: "Pedidos por praca com status recebido, preparando, pronto e entregue." },
  { icon: QrCode, title: "Cardapio QR", text: "QR por mesa, pedido pelo cliente, adicionais, chamar garcom e pedir conta." },
  { icon: Truck, title: "Delivery", text: "Pedido online, endereco, taxa de entrega, rota e WhatsApp automatico." },
  { icon: BadgeDollarSign, title: "Caixa food service", text: "Pix, cartao, dinheiro, gorjeta, divisao da conta e impressao ESC/POS." },
  { icon: ShieldCheck, title: "Multiempresa", text: "Cada empresa isolada por dono da loja, operadores, permissoes e plano." },
];

const flow = [
  "Cliente senta",
  "Garcom abre mesa",
  "Pedido vai para cozinha",
  "Prato fica pronto",
  "Caixa fecha conta",
  "Estoque e relatorios atualizam",
];

const foodPlans = [
  {
    id: "food",
    name: "HappyCashFood basico",
    price: "R$ 250",
    description: "Sistema web completo para restaurante, mesa, comanda, cardapio QR, garcom, caixa, estoque e relatorios.",
    features: ["Tudo que existe no HappyCash", "Mesa e comanda food service", "Cardapio QR e autoatendimento", "Sem executavel offline"],
    highlight: false,
    href: "/cadastro?plan=food",
  },
  {
    id: "food_offline",
    name: "HappyCashFood offline",
    price: "R$ 310",
    description: "Inclui tudo do basico e libera o sistema offline com executaveis para operar local no caixa, web mobile e APK.",
    features: ["Windows .exe", "Linux", "Pacote .deb", "Android APK", "Offline local"],
    highlight: true,
    href: "/cadastro?plan=food_offline",
  },
];

const downloads = [
  { label: "Windows .exe", href: "/downloads/windows", icon: MonitorDown },
  { label: "Linux", href: "/downloads/linux", icon: MonitorDown },
  { label: "Linux .deb", href: "/downloads/linux-deb", icon: Package },
  { label: "Android APK", href: "/downloads/android", icon: Smartphone },
];

const HappyCashFood = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteSeo
        title="HappyCashFood | Sistema para restaurante, mesa, comanda e delivery"
        description="Conheca o HappyCashFood, novo sistema do HappyCash para restaurantes, bares, lanchonetes e pizzarias com mesas, comandas, KDS, QR Code, delivery e caixa."
        path="/happycash-food"
        image={foodLogo}
        keywords={[
          "sistema para restaurante",
          "sistema de comanda",
          "sistema para garcom",
          "cardapio digital qr code",
          "kds cozinha",
          "pdv restaurante",
          "sistema restaurante offline",
          "apk garcom restaurante",
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "HappyCashFood",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web, Windows, Linux, Android",
            description: "Sistema para restaurante com mesas, comandas, cardapio QR, autoatendimento, garcom mobile, cozinha KDS, delivery e caixa.",
            offers: foodPlans.map((plan) => ({
              "@type": "Offer",
              name: plan.name,
              price: plan.price.replace("R$ ", ""),
              priceCurrency: "BRL",
              availability: "https://schema.org/InStock",
            })),
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Quanto custa o HappyCashFood?",
                acceptedAnswer: {
                  "@type": "Answer",
                  text: "O HappyCashFood custa R$ 250 no plano basico sem executavel offline e R$ 310 no plano com sistema offline, Windows, Linux, .deb e APK.",
                },
              },
            ],
          },
        ]}
      />
      <Header />

      <main>
        <section className="relative min-h-[88vh] overflow-hidden border-b border-border">
          <img
            src={foodLogo}
            alt="HappyCashFood"
            className="absolute inset-0 h-full w-full object-contain opacity-55"
            width={1536}
            height={1024}
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-background/70" />
          <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-background via-background/85 to-background/35" />
          <div className="container relative z-10 flex min-h-[88vh] flex-col justify-center pb-20 pt-32">
            <div className="max-w-4xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-bold text-primary">
                <Utensils className="h-4 w-4" />
                Novo vertical do HappyCash
              </div>
              <h1 className="font-heading text-5xl font-black leading-tight text-foreground sm:text-6xl lg:text-7xl">
                HappyCashFood
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                O sistema de restaurante do HappyCash para bares, lanchonetes e pizzarias com mesa, comanda,
                cozinha, cardapio digital, delivery, caixa e gestao em tempo real.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-lg border border-primary/35 bg-primary/10 px-4 py-2 text-sm font-black text-primary">
                  R$ 250 sem offline
                </span>
                <span className="rounded-lg border border-secondary/35 bg-secondary/10 px-4 py-2 text-sm font-black text-secondary">
                  R$ 310 com offline
                </span>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/cadastro?plan=food"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
                >
                  Assinar HappyCashFood
                </a>
                <a
                  href="#modulos-food"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/70 px-5 py-3 text-sm font-black text-foreground backdrop-blur transition hover:border-primary"
                >
                  Ver modulos
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="modulos-food" className="container py-20">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Modulo restaurante</p>
            <h2 className="mt-3 font-heading text-4xl font-black">Mesma conta, mesmo tema e mesma base do HappyCash</h2>
            <p className="mt-4 text-muted-foreground">
              O cliente cria a conta no HappyCashSite, paga o plano Food e o sistema restaurante fica liberado.
              Produtos, clientes, estoque, caixa, operadores, planos e multiempresa continuam como fundacao.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-lg border border-border bg-card p-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-heading text-xl font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-border bg-card/35 py-20">
          <div className="container">
            <div className="mb-10 max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Planos HappyCashFood</p>
              <h2 className="mt-3 font-heading text-4xl font-black">Um preco para web e outro para operar offline</h2>
              <p className="mt-4 text-muted-foreground">
                O HappyCashFood libera os recursos do HappyCash no vertical restaurante. A unica diferenca comercial e o executavel offline.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {foodPlans.map((plan) => (
                <article
                  key={plan.name}
                  className={`rounded-lg border p-6 ${
                    plan.highlight ? "border-primary/45 bg-primary/10" : "border-border bg-background"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-heading text-2xl font-black">{plan.name}</h3>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{plan.description}</p>
                    </div>
                    <p className="font-heading text-4xl font-black text-primary">{plan.price}</p>
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm font-bold">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  <a
                    href={plan.href}
                    className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg px-4 text-sm font-black transition ${
                      plan.highlight
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "border border-border bg-card text-foreground hover:border-primary"
                    }`}
                  >
                    Escolher {plan.price}
                  </a>
                </article>
              ))}
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-4">
              {downloads.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-sm font-black transition hover:border-primary"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      {item.label}
                    </span>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card/35 py-20">
          <div className="container grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Fluxo ideal</p>
              <h2 className="mt-3 font-heading text-4xl font-black">Do atendimento ao relatorio sem retrabalho</h2>
              <p className="mt-4 text-muted-foreground">
                O HappyCashFood segue a logica operacional do HappyCash: atendimento, preparo, pagamento,
                baixa de estoque e leitura gerencial no mesmo fluxo de conta.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {flow.map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="font-bold">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container py-20">
          <div className="grid gap-5 md:grid-cols-3">
            <article className="rounded-lg border border-border bg-card p-5">
              <Clock className="mb-4 h-7 w-7 text-primary" />
              <h3 className="font-heading text-xl font-black">Tempo real</h3>
              <p className="mt-2 text-sm text-muted-foreground">Garcom, cozinha, caixa e delivery enxergam o mesmo pedido sem desencontro.</p>
            </article>
            <article className="rounded-lg border border-border bg-card p-5">
              <ReceiptText className="mb-4 h-7 w-7 text-primary" />
              <h3 className="font-heading text-xl font-black">Conta flexivel</h3>
              <p className="mt-2 text-sm text-muted-foreground">Divisao de conta, gorjeta, pagamento misto e fechamento conectado ao PDV.</p>
            </article>
            <article className="rounded-lg border border-border bg-card p-5">
              <ChefHat className="mb-4 h-7 w-7 text-primary" />
              <h3 className="font-heading text-xl font-black">Producao organizada</h3>
              <p className="mt-2 text-sm text-muted-foreground">Observacoes grandes, separacao por cozinha/bar e status claro para cada item.</p>
            </article>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HappyCashFood;

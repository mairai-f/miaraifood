import {
  BadgeDollarSign,
  ChefHat,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  MonitorDown,
  Package,
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
  { icon: LayoutDashboard, title: "Mesas e comandas em modal", text: "Clique na mesa, abra a comanda, adicione produtos e feche sem poluir a tela principal." },
  { icon: ChefHat, title: "Cozinha por praca", text: "Pedidos separados entre cozinha, balcao e bar com status recebido, preparando, pronto e entregue." },
  { icon: ReceiptText, title: "Cardapio da mesa", text: "Catalogo da comanda abre apenas quando a equipe escolhe adicionar itens na mesa certa." },
  { icon: Truck, title: "Delivery integrado", text: "Pedidos externos seguem no mesmo fluxo do HappyCashFood, com controle de preparo e entrega." },
  { icon: BadgeDollarSign, title: "Caixa por mesa", text: "O fechamento abre por mesa, sem tela carregada, com Pix, cartao, dinheiro, fiado e conta dividida." },
  { icon: ShieldCheck, title: "Acesso por plano", text: "Pagou o plano Food, abre o HappyCashFood. Pagou o Food Offline, o dashboard libera as releases protegidas." },
];

const flow = [
  "Cliente senta",
  "Equipe toca na mesa",
  "Comanda abre em modal",
  "Produtos entram no cardapio da mesa",
  "Pedido segue para cozinha, balcao ou bar",
  "Caixa fecha a mesa sem travar a operacao",
];

const foodPlans = [
  {
    id: "food",
    name: "HappyCashFood",
    price: "R$ 250",
    description: "Sistema web do restaurante com mesas, comandas, cozinha, delivery, caixa, estoque e gestao organizada.",
    features: [
      "Mesas e comandas",
      "Cozinha e balcao",
      "Caixa por mesa",
      "Gestao separada por menu",
      "Sem download offline",
    ],
    highlight: false,
    href: "/cadastro?plan=food",
  },
  {
    id: "food_offline",
    name: "HappyCashFood Offline",
    price: "R$ 310",
    description: "Tudo do plano Food com releases separadas para Windows, Linux .deb, Linux AppImage e Android APK.",
    features: [
      "Tudo do HappyCashFood",
      "Windows",
      "Linux .deb",
      "Linux AppImage",
      "Android APK",
    ],
    highlight: true,
    href: "/cadastro?plan=food_offline",
  },
];

const releaseTiles = [
  { label: "Windows", detail: "Executavel protegido liberado no dashboard apos pagamento.", icon: MonitorDown },
  { label: "Linux .deb", detail: "Pacote Debian/Ubuntu liberado no HappyCashSite.", icon: Package },
  { label: "Linux AppImage", detail: "Versao portatil offline liberada no painel.", icon: MonitorDown },
  { label: "Android APK", detail: "APK protegido liberado somente para Food Offline.", icon: Smartphone },
];

const HappyCashFood = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteSeo
        title="HappyCashFood | Sistema para restaurante, mesas, comandas e operacao offline"
        description="Conheca o HappyCashFood com mesas, comandas em modal, cozinha, delivery, caixa por mesa e plano offline com releases protegidas no HappyCashSite."
        path="/happycash-food"
        image={foodLogo}
        keywords={[
          "sistema para restaurante",
          "sistema de comanda",
          "caixa por mesa",
          "sistema restaurante offline",
          "kds cozinha",
          "delivery integrado",
          "apk restaurante offline",
          "executavel food offline",
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "HappyCashFood",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web, Windows, Linux, Android",
            description: "Sistema para restaurante com mesas, comandas, cozinha, delivery, caixa por mesa e releases offline protegidas pelo HappyCashSite.",
            offers: foodPlans.map((plan) => ({
              "@type": "Offer",
              name: plan.name,
              price: plan.price.replace("R$ ", ""),
              priceCurrency: "BRL",
              availability: "https://schema.org/InStock",
            })),
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
                Vertical restaurante do HappyCash
              </div>
              <h1 className="font-heading text-5xl font-black leading-tight text-foreground sm:text-6xl lg:text-7xl">
                HappyCashFood
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Sistema para bares, lanchonetes, pizzarias e restaurantes com mesa, comanda, cozinha, delivery,
                caixa por mesa e operacao offline sem depender do PDV padrao do HappyCash.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-lg border border-primary/35 bg-primary/10 px-4 py-2 text-sm font-black text-primary">
                  R$ 250 sistema web
                </span>
                <span className="rounded-lg border border-secondary/35 bg-secondary/10 px-4 py-2 text-sm font-black text-secondary">
                  R$ 310 com releases offline
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
            <h2 className="mt-3 font-heading text-4xl font-black">Mesmo login do site, mas operacao aberta no sistema certo</h2>
            <p className="mt-4 text-muted-foreground">
              O cliente cria a conta no HappyCashSite, paga o plano Food e o acesso abre no HappyCashFood.
              Se pagar o Food Offline, o dashboard libera as releases separadas da operacao restaurante.
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
              <h2 className="mt-3 font-heading text-4xl font-black">Sistema web no Food e releases protegidas no Food Offline</h2>
              <p className="mt-4 text-muted-foreground">
                O download nao aparece dentro do sistema restaurante. O HappyCashSite reconhece o pagamento e libera
                os arquivos protegidos somente quando o plano Food Offline estiver ativo.
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

            <div className="mt-8 rounded-2xl border border-border bg-background p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Releases protegidas</p>
                  <h3 className="mt-2 text-2xl font-black">HappyCashSite libera o download depois do pagamento</h3>
                </div>
                <span className="rounded-full border bg-card px-3 py-1 text-xs font-black text-muted-foreground">
                  HappyCashFood Offline
                </span>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {releaseTiles.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article key={item.label} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h4 className="mt-4 text-lg font-black">{item.label}</h4>
                      <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card/35 py-20">
          <div className="container grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Fluxo ideal</p>
              <h2 className="mt-3 font-heading text-4xl font-black">Do clique na mesa ao caixa sem travar a operacao</h2>
              <p className="mt-4 text-muted-foreground">
                A proposta do HappyCashFood agora e reduzir tela carregada: mesa abre modal, produto entra pelo
                cardapio da comanda e o fechamento acontece por mesa no caixa.
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
              <h3 className="font-heading text-xl font-black">Operacao fluida</h3>
              <p className="mt-2 text-sm text-muted-foreground">Se a internet cair, a operacao local continua e volta a sincronizar quando reconectar.</p>
            </article>
            <article className="rounded-lg border border-border bg-card p-5">
              <ReceiptText className="mb-4 h-7 w-7 text-primary" />
              <h3 className="font-heading text-xl font-black">Fechamento por mesa</h3>
              <p className="mt-2 text-sm text-muted-foreground">Sem “fechamento estilo PDV” poluindo a tela: o caixa abre cada mesa no momento certo.</p>
            </article>
            <article className="rounded-lg border border-border bg-card p-5">
              <ChefHat className="mb-4 h-7 w-7 text-primary" />
              <h3 className="font-heading text-xl font-black">Cozinha organizada</h3>
              <p className="mt-2 text-sm text-muted-foreground">Observacoes grandes, ranking automatico dos produtos e separacao clara por estacao de preparo.</p>
            </article>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HappyCashFood;

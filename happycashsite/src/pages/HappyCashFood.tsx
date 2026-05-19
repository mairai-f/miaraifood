import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  MessageCircle,
  MonitorDown,
  Package,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Store,
  Table2,
  Truck,
  Utensils,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import foodLogo from "@/assets/happycashfood.webp";
import foodCaixa from "@/assets/happycashfood-caixa-real.png";
import foodCozinha from "@/assets/happycashfood-cozinha-real.png";
import foodDelivery from "@/assets/happycashfood-delivery-real.png";
import foodMesas from "@/assets/happycashfood-mesas-real.png";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SiteSeo from "@/components/seo/SiteSeo";

gsap.registerPlugin(ScrollTrigger);

const HERO_BADGES = [
  "PDV rapido",
  "Mesas e comandas",
  "Cozinha/KDS",
  "Delivery",
  "Cardapio QR Code",
  "Estoque",
  "Offline PRO",
];

const painPoints = [
  "Pedido anotado errado",
  "Mesa perdida",
  "Cozinha desorganizada",
  "Caixa lento",
  "Falta de controle no estoque",
];

const solutionCards = [
  { icon: CreditCard, title: "PDV completo", text: "Venda rapida, dinheiro, Pix, debito, credito, voucher, troco e fechamento de caixa." },
  { icon: Table2, title: "Atendimento por mesa", text: "Comandas, garcom no celular, divisao de conta e status da mesa sem papel perdido." },
  { icon: Truck, title: "Balcao e delivery", text: "Pedido para retirada, entrega, taxa por bairro, motoboy, WhatsApp e tempo estimado." },
  { icon: QrCode, title: "Cardapio digital QR Code", text: "O cliente escaneia na mesa, escolhe produtos, coloca observacoes e envia sozinho." },
  { icon: ChefHat, title: "Cozinha e bar organizados", text: "Pedido cai no setor certo: cozinha, bar, pizzaria, churrasqueira ou balcao." },
  { icon: Package, title: "Estoque e fechamento", text: "Baixa por venda, estoque minimo, inventario, custo medio, perda e producao propria." },
];

const businessTypes = [
  { title: "Hamburgueria", text: "Comanda agil, combos, adicionais e cozinha organizada por status." },
  { title: "Pizzaria", text: "Pedidos com tamanhos, bordas, delivery e controle de preparo." },
  { title: "Bar e adega", text: "Balcao rapido, mesas, comandas abertas e controle de caixa." },
  { title: "Cafeteria", text: "Atendimento de balcao, produtos mais vendidos e fluxo simples." },
  { title: "Padaria", text: "PDV para movimento alto, estoque e retirada no balcao." },
  { title: "Delivery", text: "Pedido, endereco, taxa, pagamento e status em uma operacao unica." },
  { title: "Restaurante", text: "Salao, garcons, cozinha, caixa, relatorios e fechamento por mesa." },
];

const flowSteps = [
  { icon: QrCode, title: "Cliente abre o cardapio", text: "QR Code e cardapio online reduzem espera e deixam o pedido mais direto." },
  { icon: ReceiptText, title: "Pedido entra na comanda", text: "A equipe acompanha mesa, observacao, quantidade e adicionais sem papel solto." },
  { icon: ChefHat, title: "Cozinha recebe", text: "KDS separa cozinha, bar e balcao por status: recebido, preparando, pronto e entregue." },
  { icon: Smartphone, title: "Garcom acompanha", text: "Operacao no celular para consultar mesa, adicionar item e seguir o atendimento." },
  { icon: CreditCard, title: "Caixa finaliza", text: "Fechamento por mesa com Pix, cartao, dinheiro, fiado, desconto e taxa de servico." },
  { icon: Package, title: "Estoque baixa", text: "Produtos vendidos alimentam controle de estoque, relatorios e margem do negocio." },
];

const screenshots = [
  { src: foodMesas, title: "Mapa de mesas e comandas", text: "Visualize mesa livre, ocupada, em fechamento e abra a comanda em poucos cliques." },
  { src: foodCozinha, title: "KDS cozinha e bar", text: "Pedidos por praca, status de preparo e detalhes da comanda sem depender de papel." },
  { src: foodCaixa, title: "Caixa por mesa", text: "Feche a conta com taxa, desconto, pagamentos e historico do atendimento." },
  { src: foodDelivery, title: "Delivery integrado", text: "Acompanhe novos pedidos, preparo, saida e entrega no mesmo painel." },
];

const featureGroups = [
  {
    title: "Atendimento",
    icon: Table2,
    items: ["Mesas", "Comandas", "Divisao de conta", "Multiplos pagamentos", "Taxa de servico", "Retirada e balcao"],
  },
  {
    title: "Delivery",
    icon: Truck,
    items: ["Status do pedido", "Endereco", "Taxa de entrega", "Motoboy", "Tempo de entrega", "WhatsApp automatico"],
  },
  {
    title: "Cozinha",
    icon: ChefHat,
    items: ["Painel KDS", "Separacao por setor", "Status por item", "Observacoes grandes", "Impressao automatica", "Pronto para entrega"],
  },
  {
    title: "Gestao",
    icon: BarChart3,
    items: ["Estoque", "Fluxo de caixa", "Relatorios", "Lucro", "Produtos mais vendidos", "Gestao de garcons"],
  },
];

const qrSteps = [
  "Cliente escaneia QR Code",
  "Escolhe o pedido",
  "Pedido chega no painel",
  "Cozinha/bar recebe",
  "Caixa fecha a conta",
];

const moduleNames = [
  "Mesas",
  "Comandas",
  "Garcom",
  "Cozinha/KDS",
  "PDV",
  "Estoque",
  "Relatorios",
  "Delivery",
  "Impressao",
  "Cardapio digital",
];

const beforeAfter = [
  { before: "Papel e comanda perdida", after: "Pedido digital por mesa" },
  { before: "Erro entre garcom e cozinha", after: "KDS com status em tempo real" },
  { before: "Estoque sem baixa confiavel", after: "Venda conectada ao controle" },
  { before: "Caixa confuso no fechamento", after: "Conta organizada por mesa" },
];

const foodPlans = [
  {
    name: "Food Start",
    price: "R$ 147",
    description: "Para comecar com cardapio digital, mesas, caixa e organizacao do atendimento.",
    features: ["Cardapio QR Code", "Mesas e comandas", "Caixa por mesa", "Produtos e categorias", "Relatorios essenciais"],
    href: "/cadastro?plan=food",
    highlight: false,
  },
  {
    name: "Food Completo",
    price: "R$ 247",
    description: "Para restaurante que precisa de salao, delivery, estoque, cozinha/KDS e fechamento forte.",
    features: ["Tudo do Start", "Delivery", "Cozinha/KDS", "Estoque e ficha tecnica", "Promocoes e fidelidade"],
    href: "/cadastro?plan=food_offline",
    highlight: true,
  },
  {
    name: "Food PRO Offline",
    price: "R$ 397",
    description: "Para operacao que nao pode parar quando a internet cai e precisa de impressao local.",
    features: ["Tudo do Completo", "PDV offline", "Impressao ESC/POS", "Windows e Linux", "Sincronizacao depois"],
    href: "/cadastro?plan=food_offline",
    highlight: false,
  },
];

const releaseTiles = [
  { label: "Windows", detail: "PDV local para caixa e atendimento.", icon: MonitorDown },
  { label: "Linux .deb", detail: "Instalacao para distribuicoes Debian/Ubuntu.", icon: Package },
  { label: "Linux AppImage", detail: "Versao portatil para rodar sem instalador.", icon: MonitorDown },
  { label: "Android APK", detail: "Operacao mobile para equipe e acompanhamento.", icon: Smartphone },
];

const proofItems = [
  "Menos erro entre atendimento, cozinha e caixa.",
  "Comanda organizada por mesa, sem papel espalhado.",
  "Fechamento mais rapido em horario de pico.",
];

const primaryFoodButtonStyle = {
  backgroundColor: "#ffcc17",
  borderColor: "#ffcc17",
  color: "#090908",
} as const;
const foodWhatsAppUrl = "https://wa.me/?text=Quero%20testar%20o%20HappyCashFood";

const HappyCashFood = () => {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".food-hero-motion",
        { y: 34, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.75,
          stagger: 0.08,
          ease: "power3.out",
        },
      );

      gsap.to(".food-hero-bg", {
        yPercent: 8,
        scale: 1.06,
        ease: "none",
        scrollTrigger: {
          trigger: ".food-hero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.utils.toArray<HTMLElement>(".food-reveal").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 58, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.78,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 86%", toggleActions: "play none none none" },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>(".food-reveal-left").forEach((el) => {
        gsap.fromTo(
          el,
          { x: -70, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.85,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 84%", toggleActions: "play none none none" },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>(".food-reveal-right").forEach((el) => {
        gsap.fromTo(
          el,
          { x: 70, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.85,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 84%", toggleActions: "play none none none" },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>(".food-stagger").forEach((el) => {
        gsap.fromTo(
          el.children,
          { y: 44, opacity: 0, scale: 0.96 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.6,
            stagger: 0.08,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 84%", toggleActions: "play none none none" },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>(".food-screen-card").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 64, opacity: 0, rotateX: 6 },
          {
            y: 0,
            opacity: 1,
            rotateX: 0,
            duration: 0.75,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 82%", toggleActions: "play none none none" },
          },
        );
      });
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={pageRef} className="min-h-screen bg-[#090908] text-white">
      <SiteSeo
        title="HappyCashFood | Sistema para restaurantes, bares, lanchonetes e padarias"
        description="Sistema para restaurantes com PDV, mesas, comandas, delivery, estoque, cozinha/KDS e cardapio digital QR Code para reduzir erros e acelerar o atendimento."
        path="/happycash-food"
        image={foodLogo}
        keywords={[
          "sistema para restaurante",
          "sistema para bar",
          "sistema para lanchonete",
          "sistema para padaria",
          "sistema para hamburgueria",
          "sistema para pizzaria",
          "cardapio qr code",
          "sistema de comanda",
          "kds cozinha",
          "delivery restaurante",
          "sistema restaurante offline",
          "controle de mesas",
          "gestao de garcons",
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "HappyCashFood",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web, Windows, Linux, Android",
            description: "Sistema para restaurantes com PDV, mesas, comandas, cardapio QR Code, cozinha/KDS, delivery, caixa, estoque e plano offline.",
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
        <section className="food-hero relative overflow-hidden border-b border-white/10" style={{ minHeight: "680px" }}>
          <img
            src={foodMesas}
            alt="Tela real do HappyCashFood com mesas e comandas"
            className="food-hero-bg absolute inset-0 h-full w-full object-cover object-center"
            style={{ filter: "blur(1px)", opacity: 0.24, transform: "scale(1.02)" }}
            width={1440}
            height={980}
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(0, 0, 0, 0.72)" }} />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, #050505 0%, #050505 48%, rgba(5, 5, 5, 0.78) 70%, rgba(5, 5, 5, 0.48) 100%)",
            }}
          />

          <div className="container relative z-10 flex flex-col justify-center pb-10 pt-24 md:pb-14 md:pt-32" style={{ minHeight: "660px" }}>
            <div className="max-w-3xl" style={{ maxWidth: "768px" }}>
              <div className="food-hero-motion inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-200 sm:text-sm">
                <Utensils className="h-4 w-4" />
                Pedido na mesa, cozinha organizada e caixa no controle
              </div>

              <h1 className="food-hero-motion mt-5 max-w-3xl font-heading text-3xl font-black leading-tight text-white sm:text-5xl lg:text-5xl 2xl:text-6xl" style={{ maxWidth: "760px", lineHeight: 1.08 }}>
                Sistema para restaurantes, bares, lanchonetes, hamburguerias e padarias.
              </h1>

              <p className="food-hero-motion mt-5 max-w-2xl text-base leading-7 text-zinc-200 sm:text-lg">
                Menos erro nos pedidos, mais velocidade no atendimento e controle total do caixa.
                HappyCashFood conecta cardapio QR Code, mesas, delivery, cozinha, estoque e PDV.
              </p>

              <div className="food-hero-motion mt-5 flex max-w-2xl flex-wrap gap-2">
                {HERO_BADGES.map((item) => (
                  <span key={item} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-zinc-100">
                    {item}
                  </span>
                ))}
              </div>

              <div className="food-hero-motion mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/cadastro?plan=food"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-amber-400 px-6 py-4 text-sm font-black text-zinc-950 transition hover:bg-amber-300"
                  style={primaryFoodButtonStyle}
                >
                  Testar gratis <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#telas-reais"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-4 text-sm font-black text-white transition hover:border-amber-300"
                >
                  Ver demonstracao
                </a>
                <a
                  href="#planos-food"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/20 bg-zinc-950/60 px-6 py-4 text-sm font-black text-white transition hover:border-emerald-300"
                >
                  Ver planos
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/10 bg-[#10100e] py-6">
          <div className="food-stagger container grid gap-3 text-sm font-bold text-zinc-200 md:grid-cols-3">
            {proofItems.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="container py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="food-reveal-left">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-red-300">Dor do cliente</p>
              <h2 className="mt-3 font-heading text-3xl font-black md:text-5xl">
                O problema do restaurante quase nunca e vender. E controlar o movimento.
              </h2>
              <div className="food-stagger mt-7 grid gap-3">
                {painPoints.map((point) => (
                  <div key={point} className="flex items-center gap-3 rounded-lg border border-red-300/20 bg-red-500/10 p-4">
                    <XCircle className="h-5 w-5 text-red-300" />
                    <span className="font-bold">{point}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="food-reveal-right">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">Solucao</p>
              <h2 className="mt-3 font-heading text-3xl font-black md:text-5xl">
                HappyCashFood: pedido na mesa, cozinha organizada e caixa no controle.
              </h2>
              <div className="food-stagger mt-7 grid gap-4 md:grid-cols-2">
                {solutionCards.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article key={item.title} className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
                      <Icon className="h-6 w-6 text-amber-300" />
                      <h3 className="mt-4 text-lg font-black">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">{item.text}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="container py-20">
          <div className="food-reveal max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-300">Fluxo completo</p>
            <h2 className="mt-3 font-heading text-3xl font-black text-white md:text-5xl">
              Do QR Code ao caixa, tudo no mesmo caminho.
            </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-300">
              Em vez de cada etapa ficar em um papel, grupo de mensagem ou planilha, o pedido entra no fluxo
              certo e acompanha a operacao ate o fechamento.
            </p>
          </div>

          <div className="food-stagger mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-400 text-zinc-950">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-black text-zinc-500">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-black text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{step.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#12110f] py-20">
          <div className="container">
            <div className="food-reveal max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">Serve para o seu tipo de comida</p>
              <h2 className="mt-3 font-heading text-3xl font-black md:text-5xl">
                Quem vende comida precisa de fluxo rapido, nao de sistema generico.
              </h2>
            </div>

            <div className="food-stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {businessTypes.map((item) => (
                <article key={item.title} className="rounded-lg border border-white/10 bg-[#090908] p-5">
                  <Store className="h-6 w-6 text-amber-300" />
                  <h3 className="mt-4 text-lg font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container grid gap-10 py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="food-reveal-left">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-300">QR Code vende sozinho</p>
            <h2 className="mt-3 font-heading text-3xl font-black md:text-5xl">
              O cliente escaneia o QR Code na mesa e o pedido cai automaticamente no sistema.
            </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-300">
              Ele escolhe os produtos, adiciona observacoes como sem cebola ou pouco gelo, envia o pedido
              e a cozinha/bar recebe no painel certo. O caixa fecha a conta sem redigitar tudo.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/cadastro?plan=food" className="inline-flex items-center justify-center rounded-lg bg-amber-400 px-5 py-3 text-sm font-black text-zinc-950" style={primaryFoodButtonStyle}>
                Comecar agora
              </Link>
              <a href="#telas-reais" className="inline-flex items-center justify-center rounded-lg border border-white/15 px-5 py-3 text-sm font-black text-white">
                Ver telas reais
              </a>
            </div>
          </div>

          <div className="food-stagger grid gap-3">
            {qrSteps.map((step, index) => (
              <div key={step} className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/[0.045] p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-400 text-sm font-black text-zinc-950">
                  {index + 1}
                </span>
                <span className="text-lg font-black">{step}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="telas-reais" className="border-y border-white/10 bg-[#10100e] py-20">
          <div className="container">
            <div className="food-reveal flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-300">Telas reais do sistema</p>
                <h2 className="mt-3 font-heading text-3xl font-black md:text-5xl">
                  Nada de mockup vazio: veja o HappyCashFood funcionando.
                </h2>
              </div>
              <Link
                to="/cadastro?plan=food"
                className="inline-flex h-12 w-fit items-center gap-2 rounded-lg bg-amber-400 px-5 py-3 text-sm font-black text-zinc-950"
                style={{ ...primaryFoodButtonStyle, alignSelf: "flex-start", minHeight: 48 }}
              >
                Testar gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              {screenshots.map((item) => (
                <article key={item.title} className="food-screen-card overflow-hidden rounded-lg border border-white/10 bg-[#090908]">
                  <img src={item.src} alt={item.title} className="aspect-[16/10] w-full object-cover object-top" loading="eager" decoding="async" />
                  <div className="p-5">
                    <h3 className="text-xl font-black">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{item.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container py-20">
          <div className="food-reveal max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">Tudo que o Food faz</p>
            <h2 className="mt-3 font-heading text-3xl font-black md:text-5xl">
              Um painel para atendimento, delivery, cozinha e gestao.
            </h2>
          </div>

          <div className="food-stagger mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featureGroups.map((group) => {
              const Icon = group.icon;
              return (
                <article key={group.title} className="rounded-lg border border-white/10 bg-white/[0.045] p-5">
                  <Icon className="h-7 w-7 text-amber-300" />
                  <h3 className="mt-4 text-xl font-black">{group.title}</h3>
                  <div className="mt-4 grid gap-2">
                    {group.items.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm font-bold text-zinc-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        {item}
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="food-stagger mt-10 flex flex-wrap gap-3">
            {moduleNames.map((module) => (
              <span key={module} className="rounded-full border border-white/10 bg-[#12110f] px-4 py-2 text-sm font-black text-zinc-200">
                {module}
              </span>
            ))}
          </div>
        </section>

        <section className="border-y border-white/10 bg-[#12110f] py-20">
          <div className="container grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="food-reveal-left">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-300">Diferencial offline</p>
              <h2 className="mt-3 font-heading text-3xl font-black md:text-5xl">
                Internet caiu? O HappyCashFood continua funcionando.
              </h2>
              <p className="mt-4 text-lg leading-8 text-zinc-300">
                O plano Food Offline PRO libera versoes protegidas para manter venda, caixa e impressao local
                mesmo quando a conexao oscila.
              </p>
              <div className="food-stagger mt-8 grid gap-3 sm:grid-cols-2">
                {releaseTiles.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg border border-white/10 bg-[#090908] p-4">
                      <Icon className="h-6 w-6 text-emerald-300" />
                      <h3 className="mt-3 font-black">{item.label}</h3>
                      <p className="mt-1 text-sm text-zinc-400">{item.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="food-reveal-right rounded-lg border border-emerald-300/25 bg-emerald-400/10 p-6">
              <WifiOff className="h-10 w-10 text-emerald-300" />
              <h3 className="mt-5 text-2xl font-black">Operacao protegida contra instabilidade</h3>
              <div className="food-stagger mt-5 grid gap-3">
                {["PDV offline", "Impressao local", "Sincronizacao automatica", "Dados da operacao preservados"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-lg border border-emerald-300/15 bg-[#090908]/70 p-3 text-sm font-bold">
                    <ShieldCheck className="h-5 w-5 text-emerald-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="container py-20">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="food-reveal-left">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-red-300">Antes</p>
              <h2 className="mt-3 font-heading text-3xl font-black">Quando tudo depende de papel</h2>
              <div className="food-stagger mt-6 grid gap-3">
                {beforeAfter.map((item) => (
                  <div key={item.before} className="flex items-center gap-3 rounded-lg border border-red-300/20 bg-red-500/10 p-4">
                    <XCircle className="h-5 w-5 text-red-300" />
                    <span className="font-bold">{item.before}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="food-reveal-right">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">Depois</p>
              <h2 className="mt-3 font-heading text-3xl font-black">Com a operacao digital</h2>
              <div className="food-stagger mt-6 grid gap-3">
                {beforeAfter.map((item) => (
                  <div key={item.after} className="flex items-center gap-3 rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-4">
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                    <span className="font-bold">{item.after}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="planos-food" className="border-y border-white/10 bg-[#10100e] py-20">
          <div className="container">
            <div className="food-reveal max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-300">Planos HappyCashFood</p>
              <h2 className="mt-3 font-heading text-3xl font-black md:text-5xl">
                Escolha entre operar online ou vender mesmo sem internet.
              </h2>
            </div>

            <div className="food-stagger mt-10 grid gap-5 lg:grid-cols-3">
              {foodPlans.map((plan) => (
                <article
                  key={plan.name}
                  className={`rounded-lg border p-6 ${
                    plan.highlight
                      ? "border-amber-300/45 bg-amber-400/10"
                      : "border-white/10 bg-[#090908]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-heading text-2xl font-black">{plan.name}</h3>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">{plan.description}</p>
                    </div>
                    <p className="font-heading text-4xl font-black text-amber-300">{plan.price}<span className="text-base text-zinc-400">/mes</span></p>
                  </div>
                  <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm font-bold text-zinc-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  <Link
                    to={plan.href}
                    className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg px-4 text-sm font-black transition ${
                      plan.highlight
                        ? "bg-amber-400 text-zinc-950 hover:bg-amber-300"
                        : "border border-white/15 bg-white/[0.04] text-white hover:border-amber-300"
                    }`}
                    style={plan.highlight ? primaryFoodButtonStyle : undefined}
                  >
                    Escolher {plan.name}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container py-20">
          <div className="food-reveal overflow-hidden rounded-lg border border-white/10 bg-[#12110f]">
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="p-8 lg:p-10">
                <Clock3 className="h-9 w-9 text-amber-300" />
                <h2 className="mt-5 font-heading text-3xl font-black md:text-5xl">
                  Comece hoje com menos erro no pedido e mais controle no caixa.
                </h2>
                <p className="mt-4 text-lg leading-8 text-zinc-300">
                  Teste o HappyCashFood, veja o fluxo do QR Code ate a cozinha e coloque o restaurante
                  em uma rotina mais rapida para mesa, delivery, estoque e fechamento.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link to="/cadastro?plan=food" className="inline-flex items-center justify-center rounded-lg bg-amber-400 px-6 py-4 text-sm font-black text-zinc-950" style={primaryFoodButtonStyle}>
                    Teste o HappyCashFood
                  </Link>
                  <a href={foodWhatsAppUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-6 py-4 text-sm font-black text-white">
                    <MessageCircle className="h-4 w-4" />
                    Fale no WhatsApp
                  </a>
                </div>
              </div>
              <div className="relative min-h-[360px]">
                <img src={foodCozinha} alt="Painel de cozinha do HappyCashFood" className="absolute inset-0 h-full w-full object-cover object-top" loading="lazy" decoding="async" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,#12110f_0%,rgba(18,17,15,0.15)_55%,rgba(18,17,15,0)_100%)]" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HappyCashFood;

import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  MonitorSmartphone,
  Play,
  Printer,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import gsap from "gsap";
import { useLandingAccountActions } from "@/hooks/use-landing-account-actions";
import pdvScreenshot from "@/assets/pdv-principal-carrinho.webp";
import estoqueScreenshot from "@/assets/estoque-painel.webp";
import clientesScreenshot from "@/assets/fiado-digital-clientes.webp";

const heroSignals = [
  {
    label: "Caixa",
    text: "PDV rapido",
    icon: "https://api.iconify.design/streamline-freehand-color:receipt-cash-register-print.svg",
    className: "bg-[#e8f7ff] border-[#91d8ff] text-[#075985]",
  },
  {
    label: "Caderno",
    text: "fiado",
    icon: "https://api.iconify.design/noto:notebook.svg",
    className: "bg-[#fff4c7] border-[#facc15] text-[#854d0e]",
  },
  {
    label: "Estoque",
    text: "reposicao",
    icon: "https://api.iconify.design/fluent-emoji-flat:package.svg",
    className: "bg-[#dcfce7] border-[#86efac] text-[#166534]",
  },
];

const quickWins = [
  "PDV e fechamento de caixa",
  "Fiado com historico por cliente",
  "Estoque, RH e relatorios",
];

const paymentRows = [
  ["Pix", "R$ 128,90"],
  ["Debito", "R$ 74,30"],
  ["Credito", "R$ 216,10"],
  ["Dinheiro", "R$ 58,00"],
];

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { showCreateAccount, showTestButton, testHref, createAccountHref } = useLandingAccountActions();

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(".hero-signal", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.08 })
        .fromTo(".hero-title", { y: 42, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75 }, "-=0.25")
        .fromTo(".hero-subtitle", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 }, "-=0.3")
        .fromTo(".hero-buttons", { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55 }, "-=0.25")
        .fromTo(".hero-trust", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "-=0.2")
        .fromTo(".product-stage", { y: 46, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.9 }, "-=0.65");

      gsap.to(".device-float-a", { y: -10, duration: 3.4, ease: "sine.inOut", repeat: -1, yoyo: true });
      gsap.to(".device-float-b", { y: 8, duration: 3.8, ease: "sine.inOut", repeat: -1, yoyo: true });
      gsap.to(".receipt-strip", { y: -6, duration: 2.8, ease: "sine.inOut", repeat: -1, yoyo: true });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative isolate overflow-hidden border-b border-border/70 bg-background pt-28 md:pt-32">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(rgba(31,86,165,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,212,0.045)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-card/80 to-transparent" />

      <div className="container">
        <div className="grid items-center gap-10 pb-12 pt-2 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:pb-16">
          <div className="min-w-0 max-w-2xl space-y-5 sm:space-y-6">
            <div className="grid max-w-xl grid-cols-3 gap-2">
              {heroSignals.map((item) => (
                <div key={item.label} className={`hero-signal rounded-lg border px-3 py-2 shadow-sm ${item.className}`}>
                  <img src={item.icon} alt="" className="mb-1 h-7 w-7" loading="eager" decoding="async" />
                  <span className="block font-heading text-base font-black leading-none">{item.label}</span>
                  <span className="mt-1 block truncate text-[0.68rem] font-bold uppercase tracking-[0.08em] opacity-80">{item.text}</span>
                </div>
              ))}
            </div>

            <h1 className="hero-title max-w-full font-heading text-4xl font-bold leading-[1.04] text-foreground sm:text-5xl lg:text-6xl">
              O caixa, o fiado e o estoque da sua <span className="text-primary">loja</span> no mesmo lugar.
            </h1>

            <p className="hero-subtitle max-w-xl text-base leading-8 text-muted-foreground sm:text-lg">
              HappyCash organiza venda, cliente, produto, cobranca e relatorio em uma rotina simples para comercio pequeno, medio e grande.
            </p>

            <div className="hero-buttons flex max-w-full flex-col gap-3 sm:flex-row">
              {showTestButton && (
                <Button asChild size="lg" className="h-14 w-full bg-primary px-7 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.02] hover:bg-primary/90 sm:w-auto">
                  <Link to={testHref}>
                    Testar gratis agora <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              )}
              {showCreateAccount && (
                <Button asChild variant="outline" size="lg" className="group h-14 w-full border-border bg-card px-7 text-base transition-transform hover:scale-[1.02] hover:bg-muted sm:w-auto">
                  <Link to={createAccountHref}>
                    <Play className="mr-2 h-4 w-4 text-primary transition-transform group-hover:scale-110" />
                    Criar conta
                  </Link>
                </Button>
              )}
            </div>

            <div className="hero-trust hidden gap-2 pt-1 text-sm text-muted-foreground sm:grid sm:grid-cols-3">
              {quickWins.map((item) => (
                <span key={item} className="flex min-h-12 items-center gap-2 rounded-lg border border-border/70 bg-card/76 px-3 py-2 shadow-sm backdrop-blur">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  {item}
                </span>
              ))}
            </div>

            <div className="hidden flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-sm text-muted-foreground sm:flex">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Demo sem cartao
              </span>
              <span className="flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-primary" />
                Web, desktop e mobile
              </span>
              <span className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" />
                Recibo e fechamento por email
              </span>
            </div>
          </div>

          <div className="product-stage relative mx-auto w-full min-w-0 max-w-3xl lg:max-w-none">
            <div className="relative mx-auto aspect-[1.18] min-h-[20rem] w-full max-w-[46rem] sm:min-h-[29rem] lg:min-h-[34rem]">
              <div className="absolute left-[5%] top-[2%] w-[78%] rounded-lg border border-slate-800/70 bg-slate-950 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.28)] sm:p-3">
                <div className="mb-2 flex items-center gap-1.5 px-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-3 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">PDV em operacao</span>
                </div>
                <img
                  src={pdvScreenshot}
                  alt="HappyCash PDV com carrinho de venda"
                  className="aspect-[1.2] w-full rounded-md object-cover object-left-top"
                  width={1440}
                  height={1200}
                  loading="eager"
                  decoding="async"
                />
              </div>

              <div className="absolute left-[22%] top-[70%] h-3 w-[36%] rounded-b-lg bg-slate-800 shadow-[0_18px_40px_rgba(15,23,42,0.16)]" />
              <div className="absolute left-[34%] top-[72%] h-10 w-[12%] bg-slate-800" />
              <div className="absolute left-[27%] top-[80%] h-3 w-[26%] rounded-full bg-slate-700" />

              <div className="device-float-a absolute bottom-[11%] left-0 hidden w-[34%] rounded-lg border border-border bg-card p-2 shadow-[0_18px_50px_rgba(15,23,42,0.18)] sm:block">
                <img
                  src={estoqueScreenshot}
                  alt="HappyCash controle de estoque"
                  className="aspect-[1.12] w-full rounded-md object-cover object-left-top"
                  width={1440}
                  height={1200}
                  loading="lazy"
                  decoding="async"
                />
                <div className="mt-2 flex items-center justify-between text-[0.68rem] font-semibold text-muted-foreground">
                  <span>Estoque baixo</span>
                  <span className="text-destructive">2 alertas</span>
                </div>
              </div>

              <div className="device-float-b absolute right-[1%] top-[18%] w-[25%] min-w-[7rem] rounded-[1.65rem] border-[7px] border-slate-950 bg-slate-950 shadow-[0_20px_60px_rgba(15,23,42,0.22)]">
                <img
                  src={clientesScreenshot}
                  alt="HappyCash clientes e fiado"
                  className="aspect-[0.56] w-full rounded-[1.1rem] object-cover object-left-top"
                  width={1440}
                  height={1200}
                  loading="lazy"
                  decoding="async"
                />
              </div>

              <div className="absolute bottom-[18%] right-[32%] w-[29%] min-w-[10rem] sm:right-[28%] lg:right-[36%]">
                <div className="rounded-t-lg border border-slate-300 bg-slate-100 px-3 py-2 shadow-[0_14px_36px_rgba(15,23,42,0.18)]">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Printer className="h-4 w-4 text-primary" />
                    Impressao rapida
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-300" />
                </div>
                <div className="receipt-strip mx-auto w-[78%] border-x border-b border-slate-200 bg-white px-3 py-3 text-[0.62rem] leading-4 text-slate-700 shadow-[0_18px_35px_rgba(15,23,42,0.12)]">
                  <div className="mb-2 flex items-center justify-between border-b border-dashed border-slate-300 pb-1 font-bold">
                    <span>FECHAMENTO</span>
                    <span>Hoje</span>
                  </div>
                  {paymentRows.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between">
                      <span>{label}</span>
                      <span className="font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute left-[55%] top-[7%] hidden rounded-lg border border-primary/20 bg-card/85 px-3 py-2 shadow-lg backdrop-blur-xl md:block">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <BadgeCheck className="h-4 w-4" />
                  Caixa pronto para fechar
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;

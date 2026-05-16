import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, MessageCircle, Play, ShoppingCart } from "lucide-react";
import gsap from "gsap";
import { useLandingAccountActions } from "@/hooks/use-landing-account-actions";
import screenshot1 from "@/assets/pdv-principal-carrinho.webp";
import mascot from "@/assets/happycoin.webp";

const rotatingWords = ["mercearia", "padaria", "adega", "bar", "loja"];
const quickWins = [
  "Fiado sem caderno",
  "PDV em poucos cliques",
  "Estoque sempre visível",
];

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const [wordIndex, setWordIndex] = useState(0);
  const wordRef = useRef<HTMLSpanElement>(null);
  const { showCreateAccount, showTestButton, testHref, createAccountHref } = useLandingAccountActions();

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      
      tl.fromTo(".hero-badge", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 })
        .fromTo(".hero-title", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.3")
        .fromTo(".hero-subtitle", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.4")
        .fromTo(".hero-buttons", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.3")
        .fromTo(".hero-trust", { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, "-=0.2")
        .fromTo(".hero-image", { x: 100, opacity: 0, scale: 0.9 }, { x: 0, opacity: 1, scale: 1, duration: 1 }, "-=0.8");

      // Parallax on image
      gsap.to(".hero-image", {
        yPercent: 15,
        ease: "none",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  // Rotating words
  useEffect(() => {
    const interval = setInterval(() => {
      if (wordRef.current) {
        gsap.to(wordRef.current, {
          y: -20, opacity: 0, duration: 0.3, ease: "power2.in",
          onComplete: () => {
            setWordIndex(prev => (prev + 1) % rotatingWords.length);
            if (wordRef.current) {
              gsap.fromTo(wordRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: "power2.out" });
            }
          }
        });
      }
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={sectionRef} className="relative flex min-h-[calc(100svh-2rem)] items-center overflow-hidden border-b border-border/60 bg-background pt-24">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,184,0,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,184,0,0.025)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-card/60 to-transparent" />

      <div className="container relative z-10">
        <div className="grid items-center gap-10 pb-12 pt-4 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14 lg:pb-16">
          <div className="space-y-5 sm:space-y-6">
            <div className="hero-badge inline-flex max-w-full items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary backdrop-blur-sm sm:px-5 sm:text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Feito para comércio pequeno que vende fiado
            </div>

            <h1 className="hero-title max-w-3xl font-heading text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">
              Controle fiado, caixa e estoque da sua{" "}
              <span ref={wordRef} className="text-primary inline-block capitalize">
                {rotatingWords[wordIndex]}
              </span>
            </h1>

            <p className="hero-subtitle max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              O HappyCash troca caderno e planilha por um painel simples para vender, cobrar pelo WhatsApp, acompanhar clientes devedores e fechar o caixa com mais confiança.
            </p>

            <div className="hero-buttons flex flex-col gap-3 sm:flex-row">
              {showTestButton && (
                <Button asChild size="lg" className="h-14 bg-primary px-7 text-base font-semibold text-primary-foreground transition-transform hover:scale-[1.02] hover:bg-primary/90">
                  <Link to={testHref}>
                    Testar grátis agora <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              )}
              {showCreateAccount && (
                <Button asChild variant="outline" size="lg" className="h-14 border-border px-7 text-base transition-transform hover:scale-[1.02] hover:bg-muted group">
                  <Link to={createAccountHref}>
                    <Play className="mr-2 h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                    Criar conta
                  </Link>
                </Button>
              )}
            </div>

            <div className="hero-trust grid gap-2 pt-1 text-sm text-muted-foreground sm:grid-cols-3">
              {quickWins.map((item) => (
                <span key={item} className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  {item}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Demo grátis sem cartão
              </span>
              <span className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                Cobrança pronta no WhatsApp
              </span>
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Web, Windows e Linux no PRO
              </span>
            </div>
          </div>

          <div ref={imageRef} className="hero-image relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="relative rounded-xl border border-border/70 bg-card p-2 shadow-2xl shadow-black/20 sm:p-3">
              <img
                src={screenshot1}
                alt="HappyCash - Sistema PDV"
                className="w-full rounded-lg"
                width={1440}
                height={1200}
                loading="eager"
                decoding="async"
              />
            </div>
            <div className="absolute -bottom-4 left-2 hidden animate-bounce-slow sm:block lg:-bottom-6 lg:-left-6">
              <img
                src={mascot}
                alt="HappyCoin Mascote"
                className="h-20 w-20 drop-shadow-2xl lg:h-24 lg:w-24"
                width={384}
                height={384}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="absolute right-2 top-2 hidden rounded-lg border border-border bg-card px-3 py-2 shadow-xl sm:block lg:-right-4 lg:-top-4 lg:px-4 lg:py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Visão do caixa</p>
                  <p className="text-sm font-bold text-primary">vendas + fiado</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <a href="#planos" className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground/70 transition-colors hover:text-primary md:block">
        Ver planos
      </a>
    </section>
  );
};

export default Hero;

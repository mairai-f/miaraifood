import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import gsap from "gsap";
import { useLandingAccountActions } from "@/hooks/use-landing-account-actions";
import screenshot1 from "@/assets/pdv-principal-carrinho.webp";
import mascot from "@/assets/happycoin.webp";

const rotatingWords = ["mercearia", "padaria", "adega", "bar", "loja"];

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

      // Floating glow orbs
      gsap.to(".hero-orb-1", { y: -30, x: 20, duration: 4, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".hero-orb-2", { y: 20, x: -30, duration: 5, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".hero-orb-3", { y: -20, x: 15, duration: 3.5, repeat: -1, yoyo: true, ease: "sine.inOut" });
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
    <section ref={sectionRef} className="relative flex min-h-screen items-center overflow-hidden pt-20">
      {/* Animated background orbs */}
      <div className="hero-orb-1 absolute left-[10%] top-20 h-[280px] w-[280px] rounded-full bg-primary/8 blur-[80px] sm:h-[380px] sm:w-[380px] lg:h-[500px] lg:w-[500px] lg:blur-[100px]" />
      <div className="hero-orb-2 absolute bottom-20 right-[10%] h-[220px] w-[220px] rounded-full bg-secondary/8 blur-[70px] sm:h-[320px] sm:w-[320px] lg:h-[400px] lg:w-[400px] lg:blur-[100px]" />
      <div className="hero-orb-3 absolute left-1/2 top-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[60px] sm:h-[240px] sm:w-[240px] lg:h-[300px] lg:w-[300px] lg:blur-[80px]" />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,184,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,184,0,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="container relative z-10">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-6 sm:space-y-8">
            <div className="hero-badge inline-flex max-w-full items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary backdrop-blur-sm sm:px-5 sm:text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              PDV web + desktop PRO com chave por máquina
            </div>

            <h1 className="hero-title font-heading text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-6xl xl:text-7xl">
              Pare de usar caderno para controlar sua{" "}
              <span ref={wordRef} className="text-primary inline-block capitalize">
                {rotatingWords[wordIndex]}
              </span>
            </h1>

            <p className="hero-subtitle max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
              Controle seus clientes no fiado em segundos, veja quem te deve em tempo real e acompanhe PDV, estoque e cobranças via WhatsApp em um só lugar. No plano PRO, a máquina valida a chave da empresa no primeiro acesso, o operador entra uma vez com internet e depois pode seguir com usuário e PIN no offline por até 5 dias.
            </p>

            <div className="hero-buttons flex flex-col sm:flex-row gap-4">
              {showTestButton && (
                <Button asChild size="lg" className="bg-primary text-primary-foreground font-semibold text-base h-14 px-8 animate-glow-pulse hover:scale-105 transition-transform">
                  <Link to={testHref}>
                    Testar grátis agora <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              )}
              {showCreateAccount && (
                <Button asChild variant="outline" size="lg" className="text-base border-border hover:bg-muted h-14 px-8 hover:scale-105 transition-transform group">
                  <Link to={createAccountHref}>
                    <Play className="mr-2 h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                    Criar conta
                  </Link>
                </Button>
              )}
            </div>

            <a href="#planos" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary">
              Ver planos e funcionalidades
            </a>

            <div className="hero-trust flex flex-wrap items-center gap-6 pt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">✓</span>
                Demo grátis sem cartão
              </span>
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">✓</span>
                Cobrança pronta no WhatsApp
              </span>
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">✓</span>
                Web, Windows e Linux no PRO
              </span>
            </div>
          </div>

          <div ref={imageRef} className="hero-image relative mx-auto w-full max-w-xl lg:max-w-none">
            {/* Glowing border effect */}
            <div className="absolute -inset-1 bg-gradient-to-br from-primary/30 via-transparent to-secondary/30 rounded-2xl blur-sm" />
            <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-3 shadow-2xl shadow-primary/10">
              <img
                src={screenshot1}
                alt="HappyCash - Sistema PDV"
                className="rounded-xl w-full"
                width={1440}
                height={1200}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </div>
            {/* Mascot */}
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
            {/* Floating badge */}
            <div className="absolute right-2 top-2 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-xl sm:block lg:-right-4 lg:-top-4 lg:px-4 lg:py-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">💰</div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendas hoje</p>
                  <p className="text-sm font-bold text-primary">R$ 3.450,00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-muted-foreground/50 md:flex">
        <span className="text-xs tracking-widest uppercase">Scroll</span>
        <div className="w-5 h-8 border-2 border-muted-foreground/30 rounded-full flex justify-center pt-1">
          <div className="w-1 h-2 bg-primary rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
};

export default Hero;

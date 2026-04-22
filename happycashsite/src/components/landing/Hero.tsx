import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play } from "lucide-react";
import gsap from "gsap";
import screenshot1 from "@/assets/screenshot-1.png";
import mascot from "@/assets/happycoin.png";

const rotatingWords = ["mercearia", "padaria", "adega", "bar", "loja"];

const Hero = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const [wordIndex, setWordIndex] = useState(0);
  const wordRef = useRef<HTMLSpanElement>(null);

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
    <section ref={sectionRef} className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Animated background orbs */}
      <div className="hero-orb-1 absolute top-20 left-[10%] w-[500px] h-[500px] bg-primary/8 rounded-full blur-[100px]" />
      <div className="hero-orb-2 absolute bottom-20 right-[10%] w-[400px] h-[400px] bg-secondary/8 rounded-full blur-[100px]" />
      <div className="hero-orb-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px]" />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,184,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,184,0,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="hero-badge inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-sm text-primary font-medium backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Fiado, PDV e estoque no mesmo sistema
            </div>

            <h1 className="hero-title font-heading text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1]">
              Pare de usar caderno para controlar sua{" "}
              <span ref={wordRef} className="text-primary inline-block capitalize">
                {rotatingWords[wordIndex]}
              </span>
            </h1>

            <p className="hero-subtitle text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed">
              Controle seus clientes no fiado em segundos, veja quem te deve em tempo real e acompanhe PDV, estoque e cobranças via WhatsApp em um só lugar.
            </p>

            <div className="hero-buttons flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="bg-primary text-primary-foreground font-semibold text-base h-14 px-8 animate-glow-pulse hover:scale-105 transition-transform">
                <Link to="/cadastro?plan=demo">
                  Testar grátis agora <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base border-border hover:bg-muted h-14 px-8 hover:scale-105 transition-transform group">
                <Link to="/cadastro">
                  <Play className="mr-2 h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                  Criar conta
                </Link>
              </Button>
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
                Funciona no celular e no computador
              </span>
            </div>
          </div>

          <div ref={imageRef} className="hero-image relative">
            {/* Glowing border effect */}
            <div className="absolute -inset-1 bg-gradient-to-br from-primary/30 via-transparent to-secondary/30 rounded-2xl blur-sm" />
            <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-3 shadow-2xl shadow-primary/10">
              <img
                src={screenshot1}
                alt="HappyCash - Sistema PDV"
                className="rounded-xl w-full"
              />
            </div>
            {/* Mascot */}
            <div className="absolute -bottom-6 -left-6 animate-bounce-slow">
              <img src={mascot} alt="HappyCoin Mascote" className="h-24 w-24 drop-shadow-2xl" />
            </div>
            {/* Floating badge */}
            <div className="absolute -top-4 -right-4 bg-card border border-border rounded-xl px-4 py-3 shadow-xl">
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
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground/50">
        <span className="text-xs tracking-widest uppercase">Scroll</span>
        <div className="w-5 h-8 border-2 border-muted-foreground/30 rounded-full flex justify-center pt-1">
          <div className="w-1 h-2 bg-primary rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
};

export default Hero;

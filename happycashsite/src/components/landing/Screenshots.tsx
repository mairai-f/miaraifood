import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel";

import s1 from "@/assets/screenshot-1.png";
import s2 from "@/assets/screenshot-2.png";
import s3 from "@/assets/screenshot-3.png";
import s4 from "@/assets/screenshot-4.png";
import s5 from "@/assets/screenshot-5.png";
import s6 from "@/assets/screenshot-6.png";
import s7 from "@/assets/screenshot-7.png";

gsap.registerPlugin(ScrollTrigger);

const screenshots = [
  { src: s1, alt: "Tela principal do sistema" },
  { src: s2, alt: "Caderneta de fiado" },
  { src: s3, alt: "Controle de estoque" },
  { src: s4, alt: "Frente de caixa" },
  { src: s5, alt: "Relatórios financeiros" },
  { src: s6, alt: "Cadastro de clientes" },
  { src: s7, alt: "Programa de fidelidade" },
];

const Screenshots = () => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".screenshots-title",
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: ".screenshots-title", start: "top 85%" }
        }
      );
      gsap.fromTo(".screenshots-carousel",
        { y: 60, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: ".screenshots-carousel", start: "top 85%" }
        }
      );
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} id="screenshots" className="py-24 md:py-32 relative overflow-hidden">
      {/* Parallax bg */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/20 via-transparent to-muted/20" />
      
      <div className="container relative z-10">
        <div className="screenshots-title text-center mb-16">
          <span className="inline-block text-sm font-semibold text-secondary tracking-widest uppercase mb-4">Screenshots</span>
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            Veja o sistema em <span className="text-primary">ação</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-lg">
            Interface moderna, intuitiva e fácil de usar. Confira algumas telas do HappyCash.
          </p>
        </div>

        <div className="screenshots-carousel mx-auto max-w-5xl px-4 sm:px-10 md:px-12">
          <Carousel opts={{ loop: true }}>
            <CarouselContent>
              {screenshots.map((s, i) => (
                <CarouselItem key={i}>
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-3 shadow-xl transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-primary/10">
                      <img
                        src={s.src}
                        alt={s.alt}
                        className="rounded-xl w-full"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden border-border transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground sm:flex" />
            <CarouselNext className="hidden border-border transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground sm:flex" />
          </Carousel>
        </div>
      </div>
    </section>
  );
};

export default Screenshots;

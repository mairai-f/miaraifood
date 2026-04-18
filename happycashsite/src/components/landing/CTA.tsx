import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useAuthSession } from "@/hooks/use-auth-session";
import { isPublicPlanId } from "@/lib/subscriptionPlans";

gsap.registerPlugin(ScrollTrigger);

const WHATSAPP_NUMBER = "5512988918792";

const CTA = () => {
  const ref = useRef<HTMLElement>(null);
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuthSession();
  const selectedPlanId = (() => {
    const value = searchParams.get("plan");
    return isPublicPlanId(value) ? value : null;
  })();
  const dashboardHref = selectedPlanId ? `/dashboard?plan=${selectedPlanId}` : "/dashboard";

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(".cta-content",
        { y: 50, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: ref.current, start: "top 80%" }
        }
      );
      // Floating orbs
      gsap.to(".cta-orb-1", { y: -20, x: 15, duration: 3, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".cta-orb-2", { y: 15, x: -20, duration: 4, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="py-24 md:py-32 relative overflow-hidden">
      {/* Orbs */}
      <div className="cta-orb-1 absolute top-10 left-[15%] w-[300px] h-[300px] bg-primary/10 rounded-full blur-[80px]" />
      <div className="cta-orb-2 absolute bottom-10 right-[15%] w-[250px] h-[250px] bg-secondary/10 rounded-full blur-[80px]" />
      
      <div className="container relative z-10">
        <div className="cta-content max-w-3xl mx-auto text-center">
          <div className="relative inline-block">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-secondary/10 to-primary/20 rounded-3xl blur-2xl" />
            <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-12 md:p-16 shadow-2xl">
              <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
                Pronto para transformar seu{" "}
                <span className="text-primary">negócio</span>?
              </h2>
              <p className="text-muted-foreground text-lg mb-10 max-w-lg mx-auto leading-relaxed">
                Comece agora mesmo e tenha controle total das suas vendas, estoque e cobranças.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="bg-primary text-primary-foreground font-semibold h-14 px-8 text-base animate-glow-pulse hover:scale-105 transition-transform">
                  {isAuthenticated ? (
                    <Link to={dashboardHref}>
                      Abrir painel <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  ) : (
                    <a href="#planos">
                      Começar Agora <ArrowRight className="ml-2 h-5 w-5" />
                    </a>
                  )}
                </Button>
                <Button asChild variant="outline" size="lg" className="h-14 px-8 text-base border-border hover:bg-muted hover:scale-105 transition-all">
                  <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-5 w-5 text-primary" />
                    Falar no WhatsApp
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;

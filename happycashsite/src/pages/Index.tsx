import { Suspense, lazy, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import OutcomeHighlights from "@/components/landing/OutcomeHighlights";
import Stats from "@/components/landing/Stats";
import Features from "@/components/landing/Features";
import Benefits from "@/components/landing/Benefits";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import SiteSeo from "@/components/seo/SiteSeo";
import heroScreenshot from "@/assets/pdv-principal-carrinho.webp";

gsap.registerPlugin(ScrollTrigger);
const Screenshots = lazy(() => import("@/components/landing/Screenshots"));

const Index = () => {
  const screenshotsAnchorRef = useRef<HTMLDivElement>(null);
  const [shouldRenderScreenshots, setShouldRenderScreenshots] = useState(false);

  useEffect(() => {
    // Smooth scroll for anchor links
    const handleClick = (e: Event) => {
      const target = e.target as HTMLAnchorElement;
      const href = target.getAttribute("href");
      if (href?.startsWith("#") && href.length > 1) {
        e.preventDefault();
        const el = document.querySelector(href);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const target = screenshotsAnchorRef.current;
    if (!target || shouldRenderScreenshots) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRenderScreenshots(true);
          observer.disconnect();
        }
      },
      { rootMargin: "360px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldRenderScreenshots]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SiteSeo
        title="HappyCash | Sistema PDV, fiado, estoque e PRO Offline"
        description="Controle fiado, PDV, estoque e relatórios em tempo real. O HappyCash tem planos mensal e anual, desktop PRO Offline, impressora térmica nos planos Completo e PRO e maquininha nos anuais Completo e PRO."
        path="/"
        image={heroScreenshot}
        keywords={[
          "controle de fiado",
          "caderneta de fiado digital",
          "sistema pdv",
          "sistema pdv offline",
          "pdv para mercadinho",
          "controle de estoque online",
          "sistema com impressora térmica",
          "sistema com maquininha",
          "happycash pro offline",
          "cobrança por whatsapp",
          "sistema para varejo",
        ]}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "HappyCash",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web, Windows, Linux, Android",
            description: "Sistema para controlar fiado, PDV, estoque, relatórios e operação PRO Offline com sincronização.",
            offers: [
              { "@type": "Offer", name: "Plano Básico", price: "100", priceCurrency: "BRL", availability: "https://schema.org/InStock" },
              { "@type": "Offer", name: "Plano Completo", price: "230", priceCurrency: "BRL", availability: "https://schema.org/InStock" },
              { "@type": "Offer", name: "Plano PRO", price: "347", priceCurrency: "BRL", availability: "https://schema.org/InStock" },
            ],
          },
        ]}
      />
      <Header />
      <Hero />
      <OutcomeHighlights />
      <Stats />
      <Features />
      <Benefits />
      <Pricing />
      <div ref={screenshotsAnchorRef} className="min-h-[32rem]">
        {shouldRenderScreenshots ? (
          <Suspense fallback={<div className="py-24 md:py-32" aria-hidden="true" />}>
            <Screenshots />
          </Suspense>
        ) : (
          <div className="py-24 md:py-32" aria-hidden="true" />
        )}
      </div>
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;

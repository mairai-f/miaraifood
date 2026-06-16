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
        title="HappyCash | Sistema de gestão, fiado, PDV e estoque"
        description="HappyCash é um sistema de gestão para pequenos negócios: controle fiado, caderneta digital, PDV, estoque, cobranças pelo WhatsApp e relatórios em tempo real."
        path="/"
        image={heroScreenshot}
        keywords={[
          "happycash sistema",
          "happycash gestão de negócios",
          "happycash caderneta",
          "sistema de gestão para pequenos negócios",
          "sistema de gestão para comércio",
          "sistema de gestão de vendas",
          "controle de fiado",
          "caderneta de fiado digital",
          "sistema pdv",
          "controle de estoque online",
          "cobrança por whatsapp",
          "sistema para varejo",
        ]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "HappyCash",
          alternateName: [
            "HappyCash Sistema",
            "HappyCash Gestão de Negócios",
            "HappyCash Caderneta",
          ],
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, Windows, Linux",
          url: "https://www.happycashsite.com.br/",
          description:
            "Sistema de gestão para pequenos negócios com controle fiado, caderneta digital, PDV, estoque, cobranças pelo WhatsApp e relatórios.",
          keywords:
            "happycash sistema, happycash gestão de negócios, sistema de gestão para pequenos negócios, controle de fiado, caderneta digital, sistema PDV, controle de estoque",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "BRL",
            description: "Demo grátis disponível.",
          },
        }}
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

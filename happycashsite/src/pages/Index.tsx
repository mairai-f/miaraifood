import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import OutcomeHighlights from "@/components/landing/OutcomeHighlights";
import Stats from "@/components/landing/Stats";
import Features from "@/components/landing/Features";
import Benefits from "@/components/landing/Benefits";
import Pricing from "@/components/landing/Pricing";
import Screenshots from "@/components/landing/Screenshots";
import AppDownload from "@/components/landing/AppDownload";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import SiteSeo from "@/components/seo/SiteSeo";
import heroScreenshot from "@/assets/screenshot-1.png";

gsap.registerPlugin(ScrollTrigger);

const Index = () => {
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

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <SiteSeo
        title="HappyCash | Controle fiado, PDV e estoque sem caderno"
        description="Pare de usar caderno para controlar fiado. Com o HappyCash você registra clientes, cobra pelo WhatsApp, acompanha PDV, estoque e relatórios em tempo real."
        path="/"
        image={heroScreenshot}
        keywords={[
          "controle de fiado",
          "caderneta de fiado digital",
          "sistema pdv",
          "controle de estoque online",
          "cobrança por whatsapp",
          "sistema para varejo",
        ]}
      />
      <Header />
      <Hero />
      <OutcomeHighlights />
      <Stats />
      <Features />
      <Benefits />
      <Pricing />
      <Screenshots />
      <AppDownload />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;

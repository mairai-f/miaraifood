import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Sparkles, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';
import { withAgendaPublicSearch } from '@/lib/agendaPublicLink';
import heroImage from '@/assets/hero-barbershop.jpg';

gsap.registerPlugin(ScrollTrigger);

export function HeroSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useAgendaBranding();
  const sectionRef = useRef<HTMLElement>(null);
  const publicPath = (path: string) => withAgendaPublicSearch(path, settings);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo('.hero-badge', { opacity: 0, y: 40, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.8 })
        .fromTo('.hero-title', { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 1 }, '-=0.4')
        .fromTo('.hero-subtitle', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.5')
        .fromTo('.hero-cta', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.4')
        .fromTo('.hero-nav-pills', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
        .fromTo('.hero-status', { opacity: 0 }, { opacity: 1, duration: 0.6 }, '-=0.3');

      gsap.to('.hero-image', {
        yPercent: 20, ease: 'none',
        scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom top', scrub: true },
      });

      gsap.to('.hero-content', {
        y: -80, opacity: 0, ease: 'none',
        scrollTrigger: { trigger: sectionRef.current, start: '30% top', end: 'bottom top', scrub: true },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative min-h-[100svh] flex items-center justify-center overflow-hidden -mt-24">
      <div className="absolute inset-0">
        <img
          src={settings.heroImageUrl || heroImage}
          alt={settings.displayName}
          className="hero-image w-full h-full object-cover scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
      </div>

      <div className="hero-content container mx-auto px-4 relative z-10 pt-24">
        <div className="max-w-3xl">
          <span className="hero-badge inline-flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-xs md:text-sm font-medium border border-white/20 mb-6 md:mb-8" style={{ opacity: 0 }}>
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-400" />
            {settings.businessType}
          </span>

          <h1 className="hero-title font-serif text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-5 md:mb-8 leading-[0.95] text-white" style={{ opacity: 0 }}>
            {settings.heroTitle || (
              <>
                {settings.displayName.split(' ')[0]}{' '}
                <span className="bg-gradient-to-r from-amber-300 via-amber-100 to-amber-300 bg-clip-text text-transparent">
                  Agenda
                </span>
                <br />para seu negócio
              </>
            )}
          </h1>

          <p className="hero-subtitle text-sm md:text-xl text-white/70 mb-6 md:mb-10 max-w-xl leading-relaxed" style={{ opacity: 0 }}>
            {settings.heroSubtitle || settings.tagline}
          </p>

          <div className="hero-cta flex flex-col sm:flex-row gap-3 md:gap-4 mb-6 md:mb-10" style={{ opacity: 0 }}>
            <Button size="lg" onClick={() => navigate(publicPath('/agendamento'))} className="group text-sm md:text-base px-6 md:px-8 py-5 md:py-6 bg-white text-black hover:bg-white/90 rounded-full">
              Agendar Agora
              <ArrowRight className="w-4 h-4 md:w-5 md:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            {!user && (
              <Button size="lg" variant="outline" onClick={() => navigate(publicPath('/login'))} className="text-sm md:text-base px-6 md:px-8 py-5 md:py-6 border-white/30 text-white hover:bg-white/10 rounded-full">
                Entrar
              </Button>
            )}
          </div>

          {/* Section Navigation Pills */}
          <div className="hero-nav-pills flex flex-wrap gap-2 md:gap-3 mb-6 md:mb-8" style={{ opacity: 0 }}>
            {[
              { label: `${settings.professionalLabel}s`, id: 'equipe' },
              { label: 'Sobre Nós', id: 'sobre' },
              { label: 'Localização', id: 'localizacao' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="px-3.5 md:px-5 py-1.5 md:py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-white/80 text-xs md:text-sm font-medium hover:bg-white/15 hover:text-white transition-all duration-300"
              >
                {item.label}
              </button>
            ))}
          </div>


        </div>
      </div>

      <button onClick={() => scrollToSection('equipe')} className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-10 text-white/50 hover:text-white transition-colors">
        <ChevronDown className="w-6 h-6 md:w-8 md:h-8 animate-bounce" />
      </button>
    </section>
  );
}

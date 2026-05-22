import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Clock, Zap, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';
import { withAgendaPublicSearch } from '@/lib/agendaPublicLink';

gsap.registerPlugin(ScrollTrigger);

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  description: string | null;
}

const serviceIcons: Record<string, string> = {
  'corte': '✂️', 'barba': '🪒', 'combo': '💈', 'degradê': '⚡', 'sobrancelha': '👁️',
  'pigmentação': '🎨', 'hidratação': '💧', 'relaxamento': '🧴', 'platinado': '⭐',
};

function getIcon(name: string) {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(serviceIcons)) {
    if (lower.includes(key)) return icon;
  }
  return '💈';
}

export function ServicesSection() {
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useAgendaBranding();
  const publicPath = (path: string) => withAgendaPublicSearch(path, settings);

  useEffect(() => {
    if (!settings.storeAccountId) {
      setServices([]);
      setLoading(false);
      return;
    }

    supabase
      .from('services')
      .select('id, name, price, duration_minutes, description')
      .eq('store_account_id', settings.storeAccountId)
      .eq('is_active', true)
      .order('price')
      .then(({ data }) => {
      if (data) setServices(data);
      setLoading(false);
    });
  }, [settings.storeAccountId]);

  useEffect(() => {
    if (loading || !services.length) return;
    const timer = setTimeout(() => {
      const ctx = gsap.context(() => {
        gsap.fromTo('.services-heading', { opacity: 0, y: 50 }, {
          opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        });
        gsap.fromTo('.service-card', { opacity: 0, y: 60, rotateX: 15 }, {
          opacity: 1, y: 0, rotateX: 0, duration: 0.8, stagger: 0.08, ease: 'power3.out',
          scrollTrigger: { trigger: '.service-cards-grid', start: 'top 85%' },
        });
        document.querySelectorAll('.service-card').forEach(card => {
          card.addEventListener('mouseenter', () => gsap.to(card, { scale: 1.03, duration: 0.3, ease: 'power2.out' }));
          card.addEventListener('mouseleave', () => gsap.to(card, { scale: 1, duration: 0.3, ease: 'power2.out' }));
        });
      }, sectionRef);
      return () => ctx.revert();
    }, 100);
    return () => clearTimeout(timer);
  }, [loading, services]);

  return (
    <section ref={sectionRef} id="servicos" className="py-16 md:py-28 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="services-heading text-center mb-10 md:mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            Serviços
          </span>
          <h2 className="font-serif text-2xl md:text-5xl font-bold mt-2 mb-3 md:mb-4">Nossos Serviços Premium</h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-base md:text-lg">Escolha entre nossa variedade de serviços profissionais</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 md:p-7 rounded-2xl bg-card border border-border">
                <div className="flex justify-between items-start mb-4">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-7 w-16" />
                </div>
                <Skeleton className="h-5 w-24 mb-3" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="service-cards-grid grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
            {services.map(service => (
              <div
                key={service.id}
                className="service-card p-4 md:p-7 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors duration-300 cursor-pointer shadow-sm hover:shadow-xl"
                style={{ opacity: 0 }}
                onClick={() => navigate(publicPath('/agendamento'))}
              >
                <div className="flex justify-between items-start mb-3 md:mb-5">
                  <span className="text-2xl md:text-3xl">{getIcon(service.name)}</span>
                  <span className="font-serif text-lg md:text-2xl font-bold text-primary">R$ {service.price.toFixed(0)}</span>
                </div>
                <h3 className="font-serif text-sm md:text-lg font-semibold mb-2 md:mb-3 line-clamp-2">{service.name}</h3>
                <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3 h-3 md:w-4 md:h-4 shrink-0" />
                  {service.duration_minutes} min
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-8 md:mt-12">
          <Button variant="outline" size="lg" onClick={() => navigate(publicPath('/agendamento'))} className="rounded-full px-6 md:px-8 text-sm md:text-base">
            Agendar Agora
            <ArrowRight className="w-4 h-4 md:w-5 md:h-5 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}

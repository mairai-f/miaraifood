import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Briefcase, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';

gsap.registerPlugin(ScrollTrigger);

interface Barber {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  is_active: boolean;
}

function BarberCard3D({ barber, onClick }: { barber: Barber; onClick: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const rotation = useRef({ x: 0, y: 0 });
  const isMobile = useIsMobile();

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    startPos.current = { x: e.clientX, y: e.clientY };
    cardRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !cardRef.current) return;
    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    const sensitivity = isMobile ? 0.4 : 0.3;
    rotation.current.y += dx * sensitivity;
    rotation.current.x -= dy * sensitivity;
    rotation.current.x = Math.max(-25, Math.min(25, rotation.current.x));
    startPos.current = { x: e.clientX, y: e.clientY };
    gsap.set(cardRef.current, {
      rotateX: rotation.current.x,
      rotateY: rotation.current.y,
    });
  }, [isMobile]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    cardRef.current?.releasePointerCapture(e.pointerId);
    // Snap back with spring
    gsap.to(rotation.current, {
      x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.5)',
      onUpdate: () => {
        if (cardRef.current) {
          gsap.set(cardRef.current, {
            rotateX: rotation.current.x,
            rotateY: rotation.current.y,
          });
        }
      },
    });
  }, []);

  return (
    <div className="perspective-[1000px] w-56 md:w-72 shrink-0">
      <div
        ref={cardRef}
        className="relative h-[300px] md:h-[400px] rounded-2xl overflow-hidden bg-muted border border-border cursor-grab active:cursor-grabbing select-none transition-shadow duration-300 hover:shadow-2xl"
        style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onClick}
      >
        {barber.photo_url ? (
          <img
            src={barber.photo_url}
            alt={barber.name}
            className="w-full h-full object-cover pointer-events-none"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary">
            <Briefcase className="w-12 h-12 md:w-16 md:h-16 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 pointer-events-none">
          <h3 className="font-serif text-base md:text-xl font-bold text-white">{barber.name}</h3>
          <p className="text-white/70 text-xs md:text-sm mt-1">Arraste para girar · Duplo clique para ver mais</p>
        </div>
        {/* 3D shine overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, rgba(255,255,255,0.15) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.08) 100%)',
            transform: 'translateZ(1px)',
          }}
        />
      </div>
    </div>
  );
}

export function BarberGallery() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selected, setSelected] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollPos = useRef(0);
  const isMobile = useIsMobile();
  const { settings } = useAgendaBranding();

  useEffect(() => {
    supabase
      .from('barbers')
      .select('id, name, bio, photo_url, is_active')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) setBarbers(data);
        setLoading(false);
      });
  }, []);

  const scrollManual = useCallback((direction: 'left' | 'right') => {
    if (!trackRef.current) return;
    const cardWidth = isMobile ? 240 : 304;
    const shift = direction === 'right' ? cardWidth : -cardWidth;
    trackRef.current.scrollBy({ left: shift, behavior: 'smooth' });
  }, [isMobile]);

  useEffect(() => {
    if (!barbers.length || !sectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.barber-title',
        { opacity: 0, y: 60 },
        {
          opacity: 1, y: 0, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
        }
      );
      gsap.fromTo(
        '.barber-3d-card',
        { opacity: 0, y: 40, rotateY: -15 },
        {
          opacity: 1, y: 0, rotateY: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out',
          scrollTrigger: { trigger: '.barber-track', start: 'top 85%' },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, [barbers]);

  return (
    <>
      <section ref={sectionRef} className="py-10 md:py-16 overflow-hidden bg-secondary/30">
        <div className="container mx-auto px-4 mb-6 md:mb-10">
          <div className="barber-title text-center">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Star className="w-4 h-4" />
              Equipe
            </span>
            <h2 className="font-serif text-2xl md:text-5xl font-bold mt-2">
              Conheça Nossos {settings.professionalLabel}s
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-4 md:gap-6 px-4 overflow-hidden justify-center">
            {Array.from({ length: isMobile ? 2 : 4 }).map((_, i) => (
              <div key={i} className="w-56 md:w-72 shrink-0">
                <Skeleton className="h-[300px] md:h-[400px] rounded-2xl" />
                <Skeleton className="h-5 w-32 mt-3" />
              </div>
            ))}
          </div>
        ) : barbers.length > 0 ? (
          <div className="relative">
            <button
              onClick={() => scrollManual('left')}
              className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-20 p-2 md:p-3 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-lg hover:bg-primary hover:text-primary-foreground transition-all duration-300"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button
              onClick={() => scrollManual('right')}
              className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-20 p-2 md:p-3 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-lg hover:bg-primary hover:text-primary-foreground transition-all duration-300"
              aria-label="Próximo"
            >
              <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
            </button>

            <div
              ref={trackRef}
              className="barber-track flex gap-4 md:gap-6 px-8 md:px-16 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {barbers.map((barber) => (
                <div key={barber.id} className="barber-3d-card snap-center" style={{ opacity: 0 }}>
                  <BarberCard3D barber={barber} onClick={() => setSelected(barber)} />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-md max-w-[90vw]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl md:text-2xl">{selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selected?.photo_url && (
              <div className="rounded-xl overflow-hidden aspect-square">
                <img
                  src={selected.photo_url}
                  alt={selected.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Especialidades</h4>
              <p className="text-foreground leading-relaxed text-sm md:text-base">
                {selected?.bio || `${settings.professionalLabel} especializado nos atendimentos de ${settings.businessType.toLowerCase()}.`}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

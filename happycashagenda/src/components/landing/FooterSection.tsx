import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CalendarDays } from 'lucide-react';
import { useAgendaBranding } from '@/hooks/useAgendaBranding';

gsap.registerPlugin(ScrollTrigger);

export function FooterSection() {
  const footerRef = useRef<HTMLElement>(null);
  const { settings } = useAgendaBranding();

  useEffect(() => {
    if (!footerRef.current) return;

    const ctx = gsap.context(() => {
      // Bounce in the logo
      gsap.fromTo(
        '.footer-logo',
        { y: 80, opacity: 0, scale: 0.5 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 1,
          ease: 'bounce.out',
          scrollTrigger: {
            trigger: footerRef.current,
            start: 'top 90%',
          },
        }
      );

      // Bounce in the brand name letter by letter
      gsap.fromTo(
        '.footer-letter',
        { y: 60, opacity: 0, rotateX: -90 },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          duration: 0.6,
          stagger: 0.05,
          ease: 'bounce.out',
          scrollTrigger: {
            trigger: footerRef.current,
            start: 'top 90%',
          },
        }
      );

      // Bounce in copyright
      gsap.fromTo(
        '.footer-copy',
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'bounce.out',
          delay: 0.4,
          scrollTrigger: {
            trigger: footerRef.current,
            start: 'top 90%',
          },
        }
      );

      // Bounce in the decorative line
      gsap.fromTo(
        '.footer-line',
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.8,
          ease: 'elastic.out(1, 0.5)',
          scrollTrigger: {
            trigger: footerRef.current,
            start: 'top 90%',
          },
        }
      );
    }, footerRef);

    return () => ctx.revert();
  }, []);

  const brandName = settings.displayName;

  return (
    <footer ref={footerRef} className="py-16 border-t border-border overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="footer-line h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent mb-10 origin-center" />

        <div className="flex flex-col items-center gap-6">
          <div
            className={`footer-logo flex items-center justify-center ${settings.logoUrl ? "" : "rounded-xl bg-primary p-3 shadow-lg"}`}
            style={{ opacity: 0 }}
          >
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.displayName}
                className="rounded object-contain"
                style={{ width: settings.logoSize, height: settings.logoSize }}
              />
            ) : (
              <CalendarDays className="w-6 h-6 text-primary-foreground" />
            )}
          </div>

          <div className="flex items-center" style={{ perspective: '600px' }}>
            {brandName.split('').map((letter, i) => (
              <span
                key={i}
                className="footer-letter font-serif text-2xl md:text-3xl font-bold inline-block"
                style={{ opacity: 0 }}
              >
                {letter}
              </span>
            ))}
          </div>

          <p className="footer-copy text-sm text-muted-foreground" style={{ opacity: 0 }}>
            © {new Date().getFullYear()} {settings.displayName}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

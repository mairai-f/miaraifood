import { useEffect, useRef, ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useIsMobile } from '@/hooks/use-mobile';

gsap.registerPlugin(ScrollTrigger);

interface SwipeSectionsProps {
  children: ReactNode;
}

export function SwipeSections({ children }: SwipeSectionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!containerRef.current) return;

    const sections = gsap.utils.toArray<HTMLElement>('.swipe-section', containerRef.current);
    if (sections.length < 2) return;

    const ctx = gsap.context(() => {
      // On mobile, use simpler stacking with less aggressive effects
      const scrubVal = isMobile ? 0.5 : 0.75;
      const scaleStart = isMobile ? 0.99 : 0.985;

      gsap.set(sections.slice(1), {
        yPercent: isMobile ? 8 : 14,
        scale: scaleStart,
        transformOrigin: '50% 0%',
      });

      sections.forEach((section, i) => {
        if (i === sections.length - 1) return;

        const nextSection = sections[i + 1];

        ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: () => `+=${Math.max(section.offsetHeight, window.innerHeight) * (isMobile ? 0.85 : 0.95)}`,
          pin: true,
          pinSpacing: false,
          scrub: scrubVal,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          ...(isMobile ? {} : {
            snap: {
              snapTo: [0, 1],
              duration: { min: 0.12, max: 0.3 },
              delay: 0,
              ease: 'power1.inOut',
              inertia: false,
            },
          }),
        });

        gsap.to(nextSection, {
          yPercent: 0,
          scale: 1,
          boxShadow: '0 -18px 38px rgba(0,0,0,0.08)',
          ease: 'none',
          scrollTrigger: {
            trigger: nextSection,
            start: 'top bottom',
            end: 'top top',
            scrub: scrubVal,
            invalidateOnRefresh: true,
          },
        });

        const inner = section.querySelector('.swipe-inner');
        if (inner) {
          gsap.to(inner, {
            opacity: isMobile ? 0.6 : 0.4,
            scale: isMobile ? 0.98 : 0.965,
            scrollTrigger: {
              trigger: nextSection,
              start: 'top bottom',
              end: 'top center',
              scrub: scrubVal,
              invalidateOnRefresh: true,
            },
          });
        }
      });

      ScrollTrigger.refresh();
    }, containerRef);

    return () => ctx.revert();
  }, [isMobile]);

  const childArray = Array.isArray(children) ? children : [children];

  return (
    <div ref={containerRef}>
      {childArray.map((child, i) => (
        <section
          key={i}
          className="swipe-section relative min-h-screen overflow-hidden bg-background will-change-transform"
          style={{ zIndex: i + 1 }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,hsl(var(--primary)/0.06)_0%,transparent_55%),radial-gradient(circle_at_85%_80%,hsl(var(--accent)/0.05)_0%,transparent_52%)]" />
          <div className="swipe-inner relative z-10">
            {child}
          </div>
        </section>
      ))}
    </div>
  );
}

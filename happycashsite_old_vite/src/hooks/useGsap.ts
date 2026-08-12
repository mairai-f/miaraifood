import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export const useScrollAnimations = () => {
  useEffect(() => {
    // Animate all elements with data-gsap attribute
    const elements = document.querySelectorAll("[data-gsap]");
    
    elements.forEach((el) => {
      const animation = (el as HTMLElement).dataset.gsap;
      const delay = parseFloat((el as HTMLElement).dataset.gsapDelay || "0");
      
      if (animation === "fade-up") {
        gsap.fromTo(el, 
          { y: 60, opacity: 0 },
          { 
            y: 0, opacity: 1, duration: 0.8, delay,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" }
          }
        );
      } else if (animation === "fade-left") {
        gsap.fromTo(el,
          { x: -80, opacity: 0 },
          {
            x: 0, opacity: 1, duration: 0.8, delay,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" }
          }
        );
      } else if (animation === "fade-right") {
        gsap.fromTo(el,
          { x: 80, opacity: 0 },
          {
            x: 0, opacity: 1, duration: 0.8, delay,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" }
          }
        );
      } else if (animation === "scale-up") {
        gsap.fromTo(el,
          { scale: 0.8, opacity: 0 },
          {
            scale: 1, opacity: 1, duration: 0.8, delay,
            ease: "back.out(1.4)",
            scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" }
          }
        );
      } else if (animation === "stagger") {
        const children = el.children;
        gsap.fromTo(children,
          { y: 40, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.6, delay,
            stagger: 0.1,
            ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" }
          }
        );
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);
};

export const useParallax = (selector: string, speed: number = 0.3) => {
  useEffect(() => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      gsap.to(el, {
        yPercent: speed * 100,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      });
    });

    return () => {
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [selector, speed]);
};

export const useCountUp = () => {
  useEffect(() => {
    const counters = document.querySelectorAll("[data-count]");
    counters.forEach(el => {
      const target = parseInt((el as HTMLElement).dataset.count || "0");
      gsap.fromTo(el, 
        { innerText: 0 },
        {
          innerText: target,
          duration: 2,
          ease: "power2.out",
          snap: { innerText: 1 },
          scrollTrigger: { trigger: el, start: "top 85%", toggleActions: "play none none none" },
        }
      );
    });
    return () => ScrollTrigger.getAll().forEach(t => t.kill());
  }, []);
};

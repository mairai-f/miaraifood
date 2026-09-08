"use client";

import { cn } from "@/lib/utils";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";
import { useRef } from "react";

export interface ScrollSplitCardItem {
  id: string;
  badge?: string;
  title: string;
  description: string;
  price: string;
  originalPrice?: number;
  period?: string;
  feedText?: string;
  features?: string[];
  excludedFeatures?: string[];
  buttonText?: string;
  buttonLink?: string;
  bgColor: string;
  textColor: string;
  accentColor?: string;
  isPopular?: boolean;
}

interface ScrollSplitCardProps {
  className?: string;
  imageSrc?: string;
  cards: ScrollSplitCardItem[];
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function ScrollSplitCard({
  className,
  cards,
  containerRef: externalContainerRef,
}: ScrollSplitCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    container: externalContainerRef,
    offset: ["start start", "end end"],
  });

  // Stage 1 to 2: Separation (0 to 0.4), then Stage 2 to 3: Overlap closer (0.4 to 0.8)
  const leftX1 = useTransform(scrollYProgress, [0, 0.4, 0.8], [0, -80, -40]);
  const leftX2 = useTransform(scrollYProgress, [0, 0.4, 0.8], [0, -26, -13]);
  const rightX2 = useTransform(scrollYProgress, [0, 0.4, 0.8], [0, 26, 13]);
  const rightX1 = useTransform(scrollYProgress, [0, 0.4, 0.8], [0, 80, 40]);
  const scale = useTransform(scrollYProgress, [0, 0.4], [1, 0.92]);

  // Stage 2 to 3: Flip (0.4 to 0.8)
  const rotateY = useTransform(scrollYProgress, [0.4, 0.8], [0, 180]);
  const rotateZ1 = useTransform(scrollYProgress, [0.4, 0.8], [0, 8]);
  const rotateZ2 = useTransform(scrollYProgress, [0.4, 0.8], [0, 3]);
  const rotateZ3 = useTransform(scrollYProgress, [0.4, 0.8], [0, -3]);
  const rotateZ4 = useTransform(scrollYProgress, [0.4, 0.8], [0, -8]);

  const borderOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 0.2]);
  const shadowOpacity = useTransform(scrollYProgress, [0, 0.2], [0, 0.4]);
  const boxShadow = useMotionTemplate`inset 0 1px 1px rgba(255, 255, 255, ${borderOpacity}), inset 0 -24px 48px rgba(0, 0, 0, ${shadowOpacity}), 0 25px 50px -12px rgba(0, 0, 0, ${shadowOpacity})`;

  // Cards move up in the last viewport
  const cardsY = useTransform(scrollYProgress, [0.8, 1], [0, -180]);
  const textOpacity = useTransform(scrollYProgress, [0.8, 1], [0, 1]);
  const textY = useTransform(scrollYProgress, [0.8, 1], [40, 0]);

  const numCards = cards.length;

  return (
    <div
      ref={containerRef}
      className={cn("relative h-[500vh] w-full", className)}
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden [perspective:1400px]">
        <motion.div
          style={{ scale, y: cardsY, transformStyle: "preserve-3d" }}
          className="flex h-[660px] w-full max-w-[1340px] px-4 relative gap-0"
        >
          {cards.map((card, i) => {
            let cardX = leftX1;
            let cardRotateZ = rotateZ1;
            if (i === 1) {
              cardX = leftX2;
              cardRotateZ = rotateZ2;
            } else if (i === 2) {
              cardX = rightX2;
              cardRotateZ = rotateZ3;
            } else if (i === 3) {
              cardX = rightX1;
              cardRotateZ = rotateZ4;
            }

            const isFirst = i === 0;
            const isLast = i === numCards - 1;
            const sliceBorderRadius = isFirst
              ? "rounded-l-2xl rounded-r-none"
              : isLast
              ? "rounded-r-2xl rounded-l-none"
              : "rounded-none";

            return (
              <motion.div
                key={card.id || i}
                className="relative h-full flex-1 cursor-pointer"
                style={{
                  x: cardX,
                  rotateY,
                  rotateZ: cardRotateZ,
                  zIndex: i + 1,
                  transformStyle: "preserve-3d",
                }}
                whileHover={{ scale: 1.04, y: -15 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {/* Front Side: Closed state showing MIAR AI/FOOD Logo */}
                <motion.div
                  className={cn(
                    "absolute inset-0 overflow-hidden [backface-visibility:hidden] pointer-events-none border border-black/10 shadow-xl",
                    sliceBorderRadius
                  )}
                  style={{
                    zIndex: 2,
                    boxShadow,
                  }}
                >
                  <div
                    className="absolute inset-0 h-full"
                    style={{
                      width: `${numCards * 100}%`,
                      left: `${-100 * i}%`,
                    }}
                  >
                    <div className="w-full h-full bg-[#FAF9F5] flex flex-col items-center justify-center p-8 select-none">
                      <div className="text-center font-sans tracking-tight flex flex-col items-center justify-center">
                        <div className="text-[88px] md:text-[110px] font-black text-[#004B23] tracking-[-0.04em] leading-none mb-3 font-sans">
                          MIAR
                        </div>
                        <div className="text-[32px] md:text-[40px] font-bold tracking-tight flex items-center justify-center gap-2 leading-none">
                          <span className="text-[#38B000]">AI</span>
                          <span className="text-[#008000] font-light">/</span>
                          <span className="text-[#004B23]">FOOD</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Back Side: Plan Details Card when opened */}
                <motion.div
                  className={cn(
                    "absolute inset-0 overflow-hidden flex flex-col p-6 rounded-2xl [backface-visibility:hidden] will-change-transform border border-white/20 shadow-2xl",
                  )}
                  style={{
                    backgroundColor: card.bgColor,
                    color: card.textColor,
                    transform: "rotateY(180deg)",
                    zIndex: 1,
                    boxShadow,
                  }}
                >
                  {/* Subtle noise background */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-15 mix-blend-overlay"
                    style={{
                      backgroundImage: `url("https://framerusercontent.com/images/6mcf62RlDfRfU61Yg5vb2pefpi4.png?width=256&height=256")`,
                      backgroundRepeat: "repeat",
                    }}
                  />

                  <div className="relative z-10 flex flex-col h-full w-full">
                    {/* Badge */}
                    {card.badge && (
                      <div className="mb-2">
                        <span
                          className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                          style={{
                            backgroundColor: card.textColor === '#ffffff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)',
                            color: card.textColor,
                          }}
                        >
                          {card.badge}
                        </span>
                      </div>
                    )}

                    {/* Title */}
                    <h3 className="text-2xl font-black tracking-tight mb-1">{card.title}</h3>

                    {/* Price & Original Price */}
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-3xl font-black tracking-tight">{card.price}</span>
                      {card.originalPrice && (
                        <span className="text-xs line-through opacity-60 font-semibold">
                          De R$ {card.originalPrice}/mês
                        </span>
                      )}
                    </div>

                    {/* Feed Banner */}
                    {card.feedText && (
                      <div
                        className="p-2.5 rounded-xl text-[11px] font-medium mb-3 leading-snug border border-white/10"
                        style={{
                          backgroundColor: card.textColor === '#ffffff' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                        }}
                      >
                        {card.feedText}
                      </div>
                    )}

                    {/* Description */}
                    <p className="text-xs opacity-90 mb-3 leading-relaxed">
                      {card.description}
                    </p>

                    {/* Features List */}
                    <div className="space-y-1.5 mb-4 flex-1 overflow-y-auto pr-1">
                      {card.features?.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] font-semibold leading-tight">
                          <span className="text-emerald-400 font-bold shrink-0">✓</span>
                          <span className="opacity-95">{feature}</span>
                        </div>
                      ))}
                      {card.excludedFeatures?.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] font-medium leading-tight opacity-55">
                          <span className="text-red-400 font-bold shrink-0">✕</span>
                          <span className="line-through">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button */}
                    {card.buttonText && card.buttonLink && (
                      <a
                        href={card.buttonLink}
                        className="relative z-20 w-full py-3 mt-auto rounded-xl text-center font-extrabold text-xs uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98] pointer-events-auto cursor-pointer shadow-lg block"
                        style={{
                          backgroundColor: card.textColor,
                          color: card.bgColor === '#ffffff' ? '#111827' : card.bgColor,
                        }}
                      >
                        {card.buttonText}
                      </a>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Ending Text fixed in the sticky viewport */}
        <motion.div
          className="absolute bottom-[10%] left-0 right-0 text-center"
          style={{
            opacity: textOpacity,
            y: textY,
          }}
        >
          <p className="text-2xl font-bold tracking-tight text-foreground/90">
            Fale com nossos consultores ou escolha seu plano online!
          </p>
        </motion.div>
      </div>
    </div>
  );
}

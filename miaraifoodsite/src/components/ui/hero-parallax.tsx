"use client";
import React, { useRef, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useTranslations } from 'next-intl';
import { cn } from "@/lib/utils";

// ─── Easing helpers ───────────────────────────────────────────────────────────
const ease = {
  linear: (t: number) => t,
  inExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
};

// ─── A-Hole Engine ────────────────────────────────────────────────────────────
interface Disc { x: number; y: number; w: number; h: number; p: number }
interface Particle { x: number; sx: number; dx: number; y: number; vy: number; p: number; r: number; c: string }
interface ClipInfo { disc: Disc; path: Path2D; i: number }

class AHoleEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width = 0; height = 0; dpi = 1;
  startDisc: Disc = { x: 0, y: 0, w: 0, h: 0, p: 0 };
  endDisc: Disc   = { x: 0, y: 0, w: 0, h: 0, p: 0 };
  discs: Disc[] = [];
  lines: Array<Array<{ x: number; y: number }>> = [];
  linesCanvas: OffscreenCanvas | null = null;
  particles: Particle[] = [];
  clip: ClipInfo = { disc: { x: 0, y: 0, w: 0, h: 0, p: 0 }, path: new Path2D(), i: 0 };
  particleArea = { sw: 0, ew: 0, h: 0, sx: 0, ex: 0 };
  raf = 0; destroyed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
  }

  init() { this.setSize(); this.setDiscs(); this.setLines(); this.setParticles(); this.tick(); }

  setSize() {
    this.dpi = window.devicePixelRatio || 1;
    this.width  = this.canvas.offsetWidth;
    this.height = this.canvas.offsetHeight;
    this.canvas.width  = this.width  * this.dpi;
    this.canvas.height = this.height * this.dpi;
  }

  tweenValue(start: number, end: number, p: number, easeName?: keyof typeof ease) {
    const fn = easeName ? ease[easeName] : ease.linear;
    return start + (end - start) * fn(p);
  }

  tweenDisc(disc: Disc): Disc {
    disc.x = this.tweenValue(this.startDisc.x, this.endDisc.x, disc.p);
    disc.y = this.tweenValue(this.startDisc.y, this.endDisc.y, disc.p, "inExpo");
    disc.w = this.tweenValue(this.startDisc.w, this.endDisc.w, disc.p);
    disc.h = this.tweenValue(this.startDisc.h, this.endDisc.h, disc.p);
    return disc;
  }

  setDiscs() {
    const { width, height } = this;
    this.discs = [];

    // Disc starts NEAR BOTTOM of canvas — tunnel mouth visible only when scrolled
    this.startDisc = { x: width * 0.5, y: height * 0.82, w: width * 0.85, h: height * 0.55, p: 0 };
    this.endDisc   = { x: width * 0.5, y: height * 0.98, w: 0, h: 0, p: 0 };

    const totalDiscs = 100;
    let prevBottom = height;
    this.clip = { disc: { ...this.startDisc }, path: new Path2D(), i: 0 };

    for (let i = 0; i < totalDiscs; i++) {
      const disc: Disc = { x: 0, y: 0, w: 0, h: 0, p: i / totalDiscs };
      this.tweenDisc(disc);
      const bottom = disc.y + disc.h;
      if (bottom <= prevBottom) { this.clip = { disc: { ...disc }, path: new Path2D(), i }; }
      prevBottom = bottom;
      this.discs.push(disc);
    }

    const p = new Path2D();
    p.ellipse(this.clip.disc.x, this.clip.disc.y, this.clip.disc.w, this.clip.disc.h, 0, 0, Math.PI * 2);
    p.rect(this.clip.disc.x - this.clip.disc.w, 0, this.clip.disc.w * 2, this.clip.disc.y);
    this.clip.path = p;
  }

  setLines() {
    const { width, height } = this;
    this.lines = [];
    const totalLines = 100;
    const angleStep = (Math.PI * 2) / totalLines;
    for (let i = 0; i < totalLines; i++) this.lines.push([]);

    this.discs.forEach((disc) => {
      for (let i = 0; i < totalLines; i++) {
        const angle = i * angleStep;
        this.lines[i].push({ x: disc.x + Math.cos(angle) * disc.w, y: disc.y + Math.sin(angle) * disc.h });
      }
    });

    this.linesCanvas = new OffscreenCanvas(width, height);
    const ctx = this.linesCanvas.getContext("2d")!;

    this.lines.forEach((line) => {
      ctx.save();
      let lineIsIn = false;
      line.forEach((p1, j) => {
        if (j === 0) return;
        const p0 = line[j - 1];
        if (!lineIsIn && (ctx.isPointInPath(this.clip.path, p1.x, p1.y) || ctx.isPointInStroke(this.clip.path, p1.x, p1.y))) {
          lineIsIn = true;
        } else if (lineIsIn) { ctx.clip(this.clip.path); }
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = "#444"; ctx.lineWidth = 2; ctx.stroke(); ctx.closePath();
      });
      ctx.restore();
    });
  }

  setParticles() {
    const { width, height } = this;
    this.particleArea = {
      sw: this.clip.disc.w * 0.5, ew: this.clip.disc.w * 2, h: height * 0.97,
      sx: 0, ex: 0,
    };
    this.particleArea.sx = (width - this.particleArea.sw) / 2;
    this.particleArea.ex = (width - this.particleArea.ew) / 2;
    this.particles = [];
    for (let i = 0; i < 100; i++) this.particles.push(this.initParticle(true));
  }

  initParticle(start = false): Particle {
    const sx = this.particleArea.sx + this.particleArea.sw * Math.random();
    const ex = this.particleArea.ex + this.particleArea.ew * Math.random();
    return {
      x: sx, sx, dx: ex - sx,
      y: start ? this.particleArea.h * Math.random() : this.particleArea.h,
      vy: 0.5 + Math.random(), p: 0, r: 0.5 + Math.random() * 4,
      c: `rgba(255,255,255,${Math.random()})`,
    };
  }

  drawDiscs() {
    const { ctx } = this;
    ctx.strokeStyle = "#444"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(this.startDisc.x, this.startDisc.y, this.startDisc.w, this.startDisc.h, 0, 0, Math.PI * 2);
    ctx.stroke(); ctx.closePath();

    this.discs.forEach((disc, i) => {
      if (i % 5 !== 0) return;
      if (disc.w < this.clip.disc.w - 5) { ctx.save(); ctx.clip(this.clip.path); }
      ctx.beginPath();
      ctx.ellipse(disc.x, disc.y, disc.w, disc.h, 0, 0, Math.PI * 2);
      ctx.stroke(); ctx.closePath();
      if (disc.w < this.clip.disc.w - 5) ctx.restore();
    });
  }

  drawLines() {
    if (this.linesCanvas) this.ctx.drawImage(this.linesCanvas as unknown as CanvasImageSource, 0, 0);
  }

  drawParticles() {
    const { ctx } = this;
    ctx.save(); ctx.clip(this.clip.path);
    this.particles.forEach((p) => {
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.rect(p.x, p.y, p.r, p.r); ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  }

  moveDiscs() {
    this.discs.forEach((disc) => { disc.p = (disc.p + 0.001) % 1; this.tweenDisc(disc); });
  }

  moveParticles() {
    this.particles.forEach((p) => {
      p.p = 1 - p.y / this.particleArea.h;
      p.x = p.sx + p.dx * p.p;
      p.y -= p.vy;
      if (p.y < 0) Object.assign(p, this.initParticle());
    });
  }

  tick() {
    if (this.destroyed) return;
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save(); ctx.scale(this.dpi, this.dpi);
    this.moveDiscs(); this.moveParticles();
    this.drawDiscs(); this.drawLines(); this.drawParticles();
    ctx.restore();
    this.raf = requestAnimationFrame(this.tick.bind(this));
  }

  resize() { this.setSize(); this.setDiscs(); this.setLines(); this.setParticles(); }
  destroy() { this.destroyed = true; cancelAnimationFrame(this.raf); }
}

// ─── React wrapper ────────────────────────────────────────────────────────────
function AHoleCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const engine = new AHoleEngine(canvas);
    engine.init();
    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);
    return () => { engine.destroy(); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} className={cn("absolute inset-0 w-full h-full", className)} />;
}

// ─── Header ───────────────────────────────────────────────────────────────────
export const Header = () => {
  const t = useTranslations('projectHeader');
  return (
    <div className="max-w-7xl relative mx-auto pt-24 md:pt-40 px-6 w-full z-30 pointer-events-none select-none">
      <h1 className="text-4xl md:text-7xl font-bold text-white drop-shadow-[0_2px_32px_rgba(0,0,0,0.9)]">
        {t('title')}
      </h1>
      <p
        className="max-w-2xl text-lg md:text-xl mt-8 text-neutral-200/80 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: t.raw('subtitle') }}
      />
    </div>
  );
};


// ─── Main HeroParallax ────────────────────────────────────────────────────────
export const HeroParallax = ({
  products,
  isLowPowerMode,
}: {
  products: { title: string; link: string; thumbnail: string }[];
  isLowPowerMode?: boolean;
}) => {
  return (
    <>
      <div className="hidden md:block">
        <HeroDesktop products={products} isLowPowerMode={isLowPowerMode} />
      </div>
      <div className="block md:hidden">
        <HeroMobile products={products} />
      </div>
    </>
  );
};

const HeroDesktop = ({ products, isLowPowerMode }: any) => {
  const firstRow = products.slice(0, 5);
  const secondRow = products.slice(5, 10);
  const ref = React.useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const rotateSpringConfig = { stiffness: 200, damping: 20 };
  const translateX = useTransform(scrollYProgress, [0, 1], [0, isLowPowerMode ? 200 : 800]);
  const translateXReverse = useTransform(scrollYProgress, [0, 1], [0, isLowPowerMode ? -200 : -800]);
  
  const rotateXRaw = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? 0 : 15, 0]);
  const rotateXSpring = useSpring(rotateXRaw, rotateSpringConfig);
  
  const opacity = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? 0.8 : 0.2, 1]);
  const rotateZRaw = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? 0 : 20, 0]);
  const rotateZSpring = useSpring(rotateZRaw, rotateSpringConfig);

  const translateY = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? -100 : -700, isLowPowerMode ? 100 : 100]);

  return (
    <div
      ref={ref}
      className={cn(
        "pt-20 pb-40 overflow-hidden antialiased relative flex flex-col self-auto",
        isLowPowerMode ? "h-[120vh]" : "h-[180vh] lg:h-[250vh] [perspective:1000px] [transform-style:preserve-3d]"
      )}
    >
      <ShaderBackground />
      <Header />
      <motion.div
        style={{
          rotateX: rotateXSpring,
          rotateZ: rotateZSpring,
          translateY,
          opacity,
          backfaceVisibility: 'hidden',
        }}
        className="flex flex-col gap-20 mt-10 relative z-10"
      >
        <motion.div className="flex flex-row-reverse space-x-reverse space-x-20 mb-20">
          {firstRow.map((product: any) => (
            <ProductCardDesktop
              product={product}
              translate={translateX}
              key={product.title}
              isLowPowerMode={isLowPowerMode}
            />
          ))}
        </motion.div>
        <motion.div className="flex flex-row space-x-20 mb-20">
          {secondRow.map((product: any) => (
            <ProductCardDesktop
              product={product}
              translate={translateXReverse}
              key={product.title}
              isLowPowerMode={isLowPowerMode}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

const ShaderBackground = () => {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <div className="sticky top-0 w-full h-screen overflow-hidden">
        <AHoleCanvas className="z-0" />
        <div
          className="absolute z-[3] pointer-events-none"
          style={{
            top: "-71.5%", left: "50%",
            width: "30%", height: "140%",
            background: `linear-gradient(20deg, #00f8f1, #ffbd1e20 16.5%, #fe848f 33%, #fe848f20 49.5%, #00f8f1 66%, #00f8f160 85.5%, #ffbd1e 100%) 0 100% / 100% 200%`,
            borderRadius: "0 0 100% 100%",
            filter: "blur(50px)",
            mixBlendMode: "plus-lighter",
            opacity: 0.8,
            transform: "translate3d(-50%, 0, 0)",
            animation: "aura-glow 5s infinite linear",
          }}
        />
        <div
          className="absolute inset-0 z-[4] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 90%, #a900ff 0%, transparent 65%)", mixBlendMode: "overlay" }}
        />
        <div
          className="absolute inset-0 z-[5] pointer-events-none"
          style={{ background: "repeating-linear-gradient(transparent, transparent 1px, white 1px, white 2px)", mixBlendMode: "overlay", opacity: 0.35 }}
        />
        <style>{`@keyframes aura-glow { 0% { background-position: 0 100%; } 100% { background-position: 0 300%; } }`}</style>
      </div>
    </div>
  );
}

const HeroMobile = ({ products }: any) => {
  const firstRow = products.slice(0, 5);
  const secondRow = products.slice(5, 10);
  
  return (
    <div className="pt-10 pb-20 overflow-hidden antialiased relative flex flex-col min-h-[100svh]">
      <ShaderBackground />
      <Header />
      <div className="flex flex-col gap-10 mt-16 relative z-10">
        <div className="flex flex-row space-x-6 overflow-x-auto pb-6 snap-x snap-mandatory px-4 hide-scrollbar">
          {firstRow.map((product: any) => (
            <div key={product.title} className="snap-center shrink-0 w-[85vw]">
               <ProductCardMobile product={product} />
            </div>
          ))}
        </div>
        <div className="flex flex-row space-x-6 overflow-x-auto pb-6 snap-x snap-mandatory px-4 hide-scrollbar">
          {secondRow.map((product: any) => (
            <div key={product.title} className="snap-center shrink-0 w-[85vw]">
               <ProductCardMobile product={product} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

import Image from "next/image";

export const ProductCardDesktop = ({
  product,
  translate,
  isLowPowerMode,
}: any) => {
  return (
    <motion.div
      style={{
        x: translate,
      }}
      whileHover={isLowPowerMode ? {} : {
        y: -20,
      }}
      key={product.title}
      className={cn(
        "group/product relative shrink-0",
        isLowPowerMode ? "h-64 w-[20rem]" : "h-96 w-[30rem]"
      )}
    >
      <a
        href={product.link}
        className="block group-hover/product:shadow-2xl h-full w-full"
      >
        <Image
          src={product.thumbnail}
          height={600}
          width={600}
          className="object-cover object-left-top absolute h-full w-full inset-0 rounded-2xl"
          alt={product.title}
          priority={true}
        />
      </a>
      <div className="absolute inset-0 h-full w-full opacity-0 group-hover/product:opacity-80 bg-black pointer-events-none rounded-2xl"></div>
      <h2 className="absolute bottom-4 left-4 opacity-0 group-hover/product:opacity-100 text-white font-bold text-xl pointer-events-none">
        {product.title}
      </h2>
    </motion.div>
  );
};

export const ProductCardMobile = ({ product }: any) => {
  return (
    <div className="relative shrink-0 h-72 w-full rounded-2xl overflow-hidden shadow-xl border border-white/10">
      <a href={product.link} className="block h-full w-full">
        <Image
          src={product.thumbnail}
          height={600}
          width={600}
          className="object-cover object-left-top h-full w-full"
          alt={product.title}
          priority={true}
        />
      </a>
      <div className="absolute inset-0 h-full w-full bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>
      <h2 className="absolute bottom-6 left-6 text-white font-bold text-2xl drop-shadow-md">
        {product.title}
      </h2>
    </div>
  );
};

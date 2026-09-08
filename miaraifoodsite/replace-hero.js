const fs = require('fs');
const file = '/home/celio/Miaraifood/miaraifoodsite/src/components/ui/hero-parallax.tsx';
let data = fs.readFileSync(file, 'utf8');

// I will just rewrite the bottom half of the file with the React components
const newHeroCode = `
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
  const rotateX = import("framer-motion").then(m => m.useSpring(rotateXRaw, rotateSpringConfig));
  const rotateXSpring = React.useMemo(() => typeof window !== 'undefined' ? require("framer-motion").useSpring(rotateXRaw, rotateSpringConfig) : rotateXRaw, [rotateXRaw]);
  
  const opacity = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? 0.8 : 0.2, 1]);
  const rotateZRaw = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? 0 : 20, 0]);
  const rotateZSpring = React.useMemo(() => typeof window !== 'undefined' ? require("framer-motion").useSpring(rotateZRaw, rotateSpringConfig) : rotateZRaw, [rotateZRaw]);

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
            background: \`linear-gradient(20deg, #00f8f1, #ffbd1e20 16.5%, #fe848f 33%, #fe848f20 49.5%, #00f8f1 66%, #00f8f160 85.5%, #ffbd1e 100%) 0 100% / 100% 200%\`,
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
        <style>{\`@keyframes aura-glow { 0% { background-position: 0 100%; } 100% { background-position: 0 300%; } }\`}</style>
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
`;

const marker = '// ─── Main HeroParallax ────────────────────────────────────────────────────────';
const parts = data.split(marker);
if (parts.length === 2) {
  const updatedData = parts[0] + newHeroCode;
  fs.writeFileSync(file, updatedData, 'utf8');
  console.log("Successfully replaced React components");
} else {
  console.log("Marker not found, could not replace");
}

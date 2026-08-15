"use client";
import React from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";

import { useTranslations } from 'next-intl';
import Image from "next/image";
import { cn } from "@/lib/utils";

export const HeroParallax = ({
  products,
  isLowPowerMode,
}: {
  products: {
    title: string;
    link: string;
    thumbnail: string;
  }[];
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
  const rotateX = useSpring(rotateXRaw, rotateSpringConfig);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? 0.8 : 0.2, 1]);
  const rotateZRaw = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? 0 : 20, 0]);
  const rotateZ = useSpring(rotateZRaw, rotateSpringConfig);
  const translateY = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? -100 : -700, isLowPowerMode ? 100 : 100]);

  return (
    <div
      ref={ref}
      className={cn(
        "pt-20 pb-40 overflow-hidden antialiased relative flex flex-col self-auto",
        isLowPowerMode ? "h-[120vh]" : "h-[180vh] lg:h-[250vh] [perspective:1000px] [transform-style:preserve-3d]"
      )}
    >
      <Header />
      <motion.div
        style={{
          rotateX,
          rotateZ,
          translateY,
          opacity,
          backfaceVisibility: 'hidden',
        }}
        className="flex flex-col gap-20 mt-10"
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

const HeroMobile = ({ products }: any) => {
  const firstRow = products.slice(0, 5);
  const secondRow = products.slice(5, 10);
  
  return (
    <div className="pt-10 pb-20 overflow-hidden antialiased relative flex flex-col min-h-[100svh]">
      <Header />
      <div className="flex flex-col gap-10 mt-16">
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

export const Header = () => {
  const t = useTranslations('projectHeader');
  return (
    <div className="max-w-7xl relative mx-auto pt-20 md:pt-48 px-4 w-full left-0 top-0">
      <h1 className="text-4xl md:text-7xl font-bold dark:text-white">
        {t('title')}
      </h1>
      <p
        className="max-w-2xl text-lg md:text-xl mt-8 dark:text-neutral-200"
        dangerouslySetInnerHTML={{ __html: t.raw('subtitle') }}
      />
    </div>
  );
};

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
        className="block group-hover/product:shadow-2xl"
      >
        <Image
          src={product.thumbnail}
          height={600}
          width={600}
          className="object-cover object-left-top absolute h-full w-full inset-0"
          alt={product.title}
          priority={true}
        />
      </a>
      <div className="absolute inset-0 h-full w-full opacity-0 group-hover/product:opacity-80 bg-black pointer-events-none"></div>
      <h2 className="absolute bottom-4 left-4 opacity-0 group-hover/product:opacity-100 text-white font-bold text-xl">
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

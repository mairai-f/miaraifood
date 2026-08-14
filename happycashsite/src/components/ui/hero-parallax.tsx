"use client";
import React from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  MotionValue,
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
  const firstRow = products.slice(0, 5);
  const secondRow = products.slice(5, 10);
  const ref = React.useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const translateX = useTransform(scrollYProgress, [0, 1], [0, isLowPowerMode ? 200 : 800]);
  const translateXReverse = useTransform(scrollYProgress, [0, 1], [0, isLowPowerMode ? -200 : -800]);

  const rotateXRaw = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? 0 : 5, 0]);
  const rotateX = useSpring(rotateXRaw, { stiffness: 200, damping: 20 });
  const opacity = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? 0.8 : 0.2, 1]);
  const rotateZRaw = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? 0 : 5, 0]);
  const rotateZ = useSpring(rotateZRaw, { stiffness: 200, damping: 20 });
  const translateY = useTransform(scrollYProgress, [0, 0.2], [isLowPowerMode ? -100 : -500, isLowPowerMode ? 100 : 500]);

  return (
    <div
      ref={ref}
      className={cn(
        "pt-10 pb-20 sm:pb-40 overflow-hidden antialiased relative flex flex-col self-auto",
        "h-auto md:h-[180vh] lg:max-md:!h-auto max-md:!transform-none  md:[perspective:2000px] md:[transform-style:preserve-3d]"
      )}
    >
      <Header />
      <motion.div
        style={{
          translateY,
          opacity,
          backfaceVisibility: 'hidden',
        }}
        className="max-md:!transform-none max-md:!opacity-100 flex flex-col gap-10 mt-10 md:mt-0"
      >
        <div className="flex flex-row space-x-10 md:space-x-20 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar md:flex-row-reverse md:space-x-reverse mb-10 md:mb-20">
          {firstRow.map((product) => (
            <div key={product.title} className="snap-center shrink-0">
              <ProductCard
                product={product}
                translate={translateX}
                isLowPowerMode={isLowPowerMode}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-row space-x-10 md:space-x-20 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar mb-10 md:mb-20">
          {secondRow.map((product) => (
            <div key={product.title} className="snap-center shrink-0">
              <ProductCard
                product={product}
                translate={translateXReverse}
                isLowPowerMode={isLowPowerMode}
              />
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

import { Mouse } from "lucide-react";

export const Header = () => {
  const t = useTranslations('projectHeader');
  return (
    <div className="max-w-7xl relative mx-auto pt-32 md:pt-48 px-4 w-full left-0 top-0">
      <h1 className="text-2xl md:text-7xl font-bold dark:text-white">
        {t('title')}
      </h1>
      <p
        className="max-w-2xl text-base md:text-xl mt-8 dark:text-neutral-200"
        dangerouslySetInnerHTML={{ __html: t.raw('subtitle') }}
      />

      {/* Scroll Indicator */}
      <motion.div
        className="absolute left-4 md:left-4 -bottom-32 md:-bottom-48 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
      >
        <div className="w-[1px] h-10 md:h-16 bg-gradient-to-b from-transparent via-neutral-400 to-transparent relative overflow-hidden">
          <motion.div
            className="absolute top-0 w-full h-1/2 bg-white blur-[1px]"
            animate={{ y: [0, 40, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <span className="text-[9px] uppercase tracking-[0.3em] text-neutral-500 font-medium">
          Scroll
        </span>
      </motion.div>
    </div>
  );
};

export const ProductCard = ({
  product,
  translate,
  isLowPowerMode,
}: {
  product: {
    title: string;
    link: string;
    thumbnail: string;
  };
  translate: MotionValue<number>;
  isLowPowerMode?: boolean;
}) => {
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
        "group/product relative shrink-0 max-md:!transform-none",
        isLowPowerMode ? "h-32 w-full max-w-[20rem] mb-4 mx-2" : "h-64 w-[16rem] md:h-96 md:w-[30rem]"
      )}
    >
      <a
        href={product.link}
        className="block group-hover/product:shadow-2xl "
      >
        <Image
          src={product.thumbnail}
          height={600}
          width={600}
          className="object-cover object-left-top absolute h-full w-full inset-0"
          alt={product.title}
          priority={true}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </a>
      <div className="absolute inset-0 h-full w-full opacity-0 group-hover/product:opacity-80 bg-black pointer-events-none"></div>
      <h2 className="absolute bottom-4 left-4 opacity-0 group-hover/product:opacity-100 text-white">
        {product.title}
      </h2>
    </motion.div>
  );
};

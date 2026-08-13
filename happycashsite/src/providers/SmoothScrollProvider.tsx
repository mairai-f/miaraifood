'use client';

import { ReactLenis, useLenis } from 'lenis/react';
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
    const lenis = useLenis(ScrollTrigger.update);

    useEffect(() => {
        function update(time: number) {
            lenis?.raf(time * 1000);
        }
        
        gsap.ticker.add(update);
        gsap.ticker.lagSmoothing(0);
        
        return () => {
            gsap.ticker.remove(update);
        };
    }, [lenis]);

    return (
        <ReactLenis root options={{
            lerp: 0.1,
            duration: 1.5,
            smoothWheel: true,
            // smoothTouch is causing TS error in this version's types
            // @ts-ignore
            smoothTouch: false,
            syncTouch: true // Helps sync native touch scroll with Lenis for GSAP
        }}>
            {children}
        </ReactLenis>
    );
}

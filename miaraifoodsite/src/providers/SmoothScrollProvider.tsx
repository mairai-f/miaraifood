'use client';

import { ReactLenis } from 'lenis/react';
import { useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

if (typeof window !== 'undefined') {
    ScrollTrigger.config({
        ignoreMobileResize: true,
    });
    ScrollTrigger.normalizeScroll(false);
}

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
    return (
        <ReactLenis root options={{
            lerp: 0.1,
            duration: 1.5,
            smoothWheel: true,
            // @ts-ignore
            smoothTouch: false,
        }}>
            {children}
        </ReactLenis>
    );
}

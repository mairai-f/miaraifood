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
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024 || ('ontouchstart' in window) || navigator.maxTouchPoints > 0);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <ReactLenis root options={{
            lerp: 0.1,
            duration: 1.5,
            smoothWheel: !isMobile,
            syncTouch: false,
            // @ts-ignore
            smoothTouch: false,
            touchMultiplier: 0,
            wheelMultiplier: isMobile ? 0 : 1,
        }}>
            {children}
        </ReactLenis>
    );
}

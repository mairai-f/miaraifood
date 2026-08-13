'use client';

import { ReactLenis, useLenis } from 'lenis/react';
import { useIsMobile } from "@/hooks/useIsMobile";
import { useEffect } from "react";

function LenisController() {
    const isMobile = useIsMobile();
    const lenis = useLenis();
    
    useEffect(() => {
        if (!lenis) return;
        if (isMobile) {
            lenis.stop();
        } else {
            lenis.start();
        }
    }, [isMobile, lenis]);
    
    return null;
}

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
    return (
        <ReactLenis root options={{
            lerp: 0.1,
            duration: 1.5,
            smoothWheel: true,
            // smoothTouch is causing TS error in this version's types
            // @ts-ignore
            smoothTouch: false
        }}>
            <LenisController />
            {children}
        </ReactLenis>
    );
}

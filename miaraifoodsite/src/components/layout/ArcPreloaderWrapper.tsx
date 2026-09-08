"use client";

import { PreloadContext } from "@/components/ui/arc-preloader-hero";

export function ArcPreloaderWrapper({ children }: { children: React.ReactNode }) {
    return (
        <PreloadContext.Provider value={{ isPreloading: false, phase: "done" }}>
            <div className="relative z-0">{children}</div>
        </PreloadContext.Provider>
    );
}

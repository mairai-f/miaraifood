"use client";

import { type FC } from "react";
import { ChevronDown } from "lucide-react";
import { MeshGradient } from '@paper-design/shaders-react';

interface CertificateHeroScrollProps {
    onDownloadClick?: () => void;
    isLowPowerMode?: boolean;
}

const CertificateHeroScroll: FC<CertificateHeroScrollProps> = ({ isLowPowerMode }) => {
    return (
        <div className="relative h-screen w-full flex items-center justify-center overflow-hidden">
            {/* Shader Background */}
            <div className="absolute inset-0 z-0">
                {!isLowPowerMode ? (
                    <MeshGradient
                        width="100%"
                        height="100%"
                        colors={["#e0eaff", "#0dff0052", "#49654e", "#08d982"]}
                        distortion={0.8}
                        swirl={0.1}
                        grainMixer={0}
                        grainOverlay={0}
                        speed={1}
                        fit="cover"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#e0eaff]/10 to-[#08d982]/10" />
                )}
            </div>

            {/* Background Effects (Optional overlay for extra depth) */}
            <div className="absolute inset-0 opacity-20 pointer-events-none z-0">
                <div className="absolute top-[20%] right-[10%] w-[600px] h-[600px] bg-primary/10 blur-[80px] rounded-full" />
                <div className="absolute bottom-[10%] left-[5%] w-[500px] h-[500px] bg-secondary/10 blur-[80px] rounded-full" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 pt-10 pb-32">
                <div className="inline-block px-4 py-1.5 rounded-full bg-secondary/50 backdrop-blur-md border border-border/50 text-xs font-medium mb-6 animate-fade-in-up">
                    Suporte e Tutoriais
                </div>
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/50 animate-fade-in-up delay-100">
                    Central de<br />Ajuda
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10 animate-fade-in-up delay-200">
                    Encontre respostas, orientações e informações para aproveitar melhor o MIAR AI/FOOD.
                </p>
                <button
                    onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
                    className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-all group animate-fade-in-up delay-300 pointer-events-auto"
                >
                    <span>Scroll to Explore</span>
                    <ChevronDown className="w-4 h-4 animate-bounce" />
                </button>
            </div>
        </div>
    );
};

export default CertificateHeroScroll;

'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ProjectPlaceholderProps {
    className?: string;
    title?: string;
}

// Store seeds outside the component so they persist across hovers but reset on page refresh
export const projectSeeds = new Map<string, number>();

const SYSTEM_TELAS = [
    "/telasdosistema/cadastreprodutos.png",
    "/telasdosistema/cardaioqrcode.png",
    "/telasdosistema/configuraçoes.png",
    "/telasdosistema/controleseuestoque.png",
    "/telasdosistema/gestaodofiado.png",
    "/telasdosistema/paineldecontrole.png",
    "/telasdosistema/pdvfrentedecaixa.png",
    "/telasdosistema/telademesas.png",
    "/telasdosistema/telakdscozinha.png"
];

export function getPlaceholderImageUrl(title: string) {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
        hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % SYSTEM_TELAS.length;
    return SYSTEM_TELAS[idx];
}

export function ProjectPlaceholder({ className, title = "No Preview Available" }: ProjectPlaceholderProps) {
    const [mounted, setMounted] = useState(false);
    const [imageUrl, setImageUrl] = useState('');

    useEffect(() => {
        setMounted(true);
        setImageUrl(getPlaceholderImageUrl(title));
    }, [title]);

    // Fallback while not mounted to avoid hydration mismatch
    if (!mounted) {
        return (
            <div className={cn(
                "relative w-full h-full bg-zinc-100 dark:bg-zinc-900 border border-black/10 dark:border-white/5",
                className
            )} />
        );
    }

    return (
        <div className={cn(
            "relative w-full h-full overflow-hidden",
            className
        )}>
            {imageUrl && (
                <>
                    <img 
                        src={imageUrl} 
                        alt={title} 
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700" 
                    />
                    <div className="absolute inset-0 bg-black/5 dark:bg-black/40 transition-colors duration-500 pointer-events-none" />
                </>
            )}
        </div>
    );
}

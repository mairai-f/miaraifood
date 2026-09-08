'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ArticleControls() {
    const router = useRouter();
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleBack = () => {
        if (typeof window !== 'undefined' && window.history.length > 2) {
            router.back();
        } else {
            router.push('/conteudos');
        }
    };

    return (
        <div className="flex w-full md:w-auto items-center justify-between md:justify-end gap-4">
            <button onClick={handleBack} className="flex items-center gap-2 text-sm text-muted-foreground font-medium hover:text-primary transition-colors focus:outline-none mr-4">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden md:inline">Voltar aos Conteúdos</span>
                <span className="md:hidden">Voltar</span>
            </button>
            <button
                onClick={handleCopy}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 transition-all text-xs font-bold uppercase tracking-wider rounded-lg",
                    copied
                        ? "bg-primary text-background"
                        : "bg-secondary/10 hover:bg-secondary/20 text-muted-foreground hover:text-foreground"
                )}
            >
                {copied ? (
                    <>
                        <Check className="w-4 h-4" /> <span>Copiado!</span>
                    </>
                ) : (
                    <>
                        <Copy className="w-4 h-4" /> <span className="hidden sm:inline">Copiar Link</span>
                    </>
                )}
            </button>
        </div>
    );
}

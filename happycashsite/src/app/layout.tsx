import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Playfair_Display, Alex_Brush } from 'next/font/google';
import { getMessages, getLocale } from 'next-intl/server';
import { ThemeProvider, I18nProvider, SmoothScrollProvider } from '@/providers';

import '@/styles/globals.css';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-jetbrains',
    display: 'swap',
});

const playfair = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-playfair',
    display: 'swap',
});

const signature = Alex_Brush({
    weight: '400',
    subsets: ['latin'],
    variable: '--font-signature',
    display: 'swap',
});

export const metadata: Metadata = {
    title: {
        default: 'HappyCash ERP | Gestão Inteligente para Negócios',
        template: '%s | HappyCash ERP',
    },
    description:
        'HappyCash ERP é uma plataforma completa de gestão empresarial com PDV, controle de estoque, vendas, financeiro e relatórios inteligentes.',
    keywords: [
        'ERP',
        'PDV',
        'sistema de gestão',
        'controle de estoque',
        'vendas',
        'financeiro',
        'software empresarial',
        'HappyCash',
    ],
    authors: [{ name: 'HappyCash ERP' }],
    creator: 'HappyCash ERP',
    metadataBase: new URL('https://www.happycashsite.com.br'),
    openGraph: {
        type: 'website',
        locale: 'pt_BR',
        url: 'https://www.happycashsite.com.br',
        title: 'HappyCash ERP | Gestão Inteligente para Negócios',
        description:
            'Simplifique sua empresa com um ERP completo para vendas, estoque, clientes e gestão financeira.',
        siteName: 'HappyCash ERP',
        images: [
            {
                url: '/assets/happycashlogonovo.png',
                width: 1200,
                height: 630,
                alt: 'HappyCash ERP - Gestão Inteligente para Negócios',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'HappyCash ERP | Gestão Inteligente para Negócios',
        description:
            'Controle sua empresa de forma simples, rápida e inteligente.',
        creator: '@happycasherp',
        images: ['/assets/happycashlogonovo.png'],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
};

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
    ],
    width: 'device-width',
    initialScale: 1,
    minimumScale: 1,
};

import { ConditionalNavigation } from '@/components/layout/ConditionalNavigation';
import { ArcPreloaderWrapper } from '@/components/layout/ArcPreloaderWrapper';
import { ChatBot } from '@/components/layout/ChatBot';
import { Toaster } from '@/components/ui/toaster';

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const locale = await getLocale();
    const messages = await getMessages();

    return (
        <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "SoftwareApplication",
                            "name": "HappyCash ERP",
                            "applicationCategory": "BusinessApplication",
                            "operatingSystem": "Web, Windows, Linux, Android",
                            "offers": {
                                "@type": "Offer",
                                "price": "0",
                                "priceCurrency": "BRL"
                            },
                            "publisher": {
                                "@type": "Organization",
                                "name": "HappyCash"
                            }
                        })
                    }}
                />
            </head>
            <body
                className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} ${signature.variable} font-sans relative`}
            >
                <ThemeProvider>
                    <I18nProvider locale={locale} messages={messages}>
                        <SmoothScrollProvider>
                            <>
                                {/* Light Mode Glassmorphism Blobs */}
                                <div className="fixed inset-0 pointer-events-none overflow-hidden flex justify-center -z-10 dark:hidden opacity-30">
                                  <div className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-400/20 blur-[120px] mix-blend-multiply" />
                                  <div className="absolute top-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-cyan-400/20 blur-[120px] mix-blend-multiply" />
                                </div>
                                <ArcPreloaderWrapper>
                                    <ConditionalNavigation>
                                        {children}
                                    </ConditionalNavigation>
                                </ArcPreloaderWrapper>

                                <ChatBot headless />
                                <Toaster />
                            </>
                        </SmoothScrollProvider>
                    </I18nProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
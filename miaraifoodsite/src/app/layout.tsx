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
        default: 'MIAR AI/FOOD | Ecossistema Completo para Restaurantes e Food Service',
        template: '%s | MIAR AI/FOOD',
    },
    description:
        'MIAR AI/FOOD é o ecossistema completo para restaurantes e food service: PDV, mesas, comandas, QR Menu, KDS, cozinha, estoque, financeiro, garçons, delivery e inteligência artificial.',
    keywords: [
        'MIAR AI/FOOD',
        'restaurantes',
        'food service',
        'PDV',
        'mesas',
        'comandas',
        'QR Menu',
        'KDS',
        'cozinha',
        'estoque',
        'delivery',
        'garçons',
        'sistema para restaurantes',
    ],
    authors: [{ name: 'MIAR AI/FOOD' }],
    creator: 'MIAR AI/FOOD',
    metadataBase: new URL('https://www.miaraifood.com.br'),
    openGraph: {
        type: 'website',
        locale: 'pt_BR',
        url: 'https://www.miaraifood.com.br',
        title: 'MIAR AI/FOOD | Ecossistema Completo para Restaurantes e Food Service',
        description:
            'Da mesa à entrega, toda a operação conectada. Salão, cozinha, caixa e delivery trabalhando juntos com IA.',
        siteName: 'MIAR AI/FOOD',
        images: [
            {
                url: '/miar-logo-bg-white.svg',
                width: 1200,
                height: 630,
                alt: 'MIAR AI/FOOD - Da mesa à entrega, toda a operação conectada',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'MIAR AI/FOOD | Ecossistema Completo para Restaurantes e Food Service',
        description:
            'Da mesa à entrega, toda a operação conectada.',
        creator: '@miaraifood',
        images: ['/miar-logo-bg-white.svg'],
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
import { PreloadSplash } from '@/components/layout/PreloadSplash';
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
                <link rel="icon" type="image/svg+xml" href="/miar-collapsed-icon.svg" />
                <link rel="shortcut icon" href="/miar-collapsed-icon.svg" />
                <link rel="apple-touch-icon" href="/miar-collapsed-icon.svg" />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "SoftwareApplication",
                            "name": "MIAR AI/FOOD",
                            "applicationCategory": "BusinessApplication",
                            "operatingSystem": "Web, Windows, Linux, Android",
                            "offers": {
                                "@type": "Offer",
                                "price": "0",
                                "priceCurrency": "BRL"
                            },
                            "publisher": {
                                "@type": "Organization",
                                "name": "MIAR AI/FOOD"
                            }
                        })
                    }}
                />
            </head>
            <body
                className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} ${signature.variable} font-sans relative`}
            >
                <ThemeProvider>
                    <PreloadSplash />
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
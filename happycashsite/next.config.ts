import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
    reactStrictMode: true,
    transpilePackages: ['three'],
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'cdn.jsdelivr.net' },
            { protocol: 'https', hostname: 'images.unsplash.com' },
            { protocol: 'https', hostname: 'assets.aceternity.com' }
        ],
        formats: ['image/avif', 'image/webp'],
    },
    async redirects() {
        return [
            { source: '/sistema-de-gestao-de-negocios', destination: '/', permanent: true },
            { source: '/happycash-rh-enterprise', destination: '/', permanent: true },
            { source: '/sistema-de-gestao-rh', destination: '/', permanent: true },
            { source: '/controle-de-fiado', destination: '/', permanent: true },
            { source: '/app-para-fiado', destination: '/', permanent: true },
            { source: '/gestao-de-clientes-fiado', destination: '/', permanent: true },
            { source: '/caderneta-de-fiado-digital', destination: '/', permanent: true },
            { source: '/sistema-pdv', destination: '/', permanent: true },
            { source: '/controle-de-estoque', destination: '/', permanent: true },
            { source: '/blog/:slug*', destination: '/conteudos/:slug*', permanent: true }
        ];
    }
};

export default withNextIntl(nextConfig);

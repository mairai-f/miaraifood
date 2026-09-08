import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const rawPort = process.env.PORT ?? '5184';
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${rawPort}"`);
const basePath = process.env.BASE_PATH ?? '/';
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:5000';

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  // Este app saiu do pipeline compartilhado (05/09/2026, migração pra
  // domínio próprio): builda direto pra "dist", o padrão zero-config que a
  // Vercel já espera sem precisar de Output Directory customizado.
  build: { outDir: path.resolve(import.meta.dirname, 'dist'), emptyOutDir: true },
  server: {
    port, strictPort: true, host: '0.0.0.0', allowedHosts: true,
    fs: { strict: true },
    proxy: { '/api': { target: apiProxyTarget, changeOrigin: true } },
  },
  preview: { port, host: '0.0.0.0', allowedHosts: true },
});

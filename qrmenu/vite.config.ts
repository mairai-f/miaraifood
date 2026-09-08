import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Porta dedicada do QR Menu (mesa) — separada do app cliente (marketplace,
// 5178). Portas já em uso no monorepo: 5173-5180, 5184. Ver README de
// portas em artifacts/*/vite.config.ts.
const rawPort = process.env.PORT ?? '5181';
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
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  // Migração pra domínio próprio (05/09/2026): enquanto este app ainda é
  // servido também pelo pipeline compartilhado (scripts/assemble-dist.mjs,
  // com BASE_PATH setado), builda pra "dist/public" como sempre. Assim que
  // sair de vez desse pipeline (ver plano de migração), BASE_PATH deixa de
  // ser passado e builda direto pra "dist" — o zero-config que a Vercel já
  // espera sem precisar de Output Directory customizado no projeto.
  build: { outDir: path.resolve(import.meta.dirname, basePath === '/' ? 'dist' : 'dist/public'), emptyOutDir: true },
  server: {
    port, strictPort: true, host: '0.0.0.0', allowedHosts: true,
    fs: { strict: true },
    proxy: { '/api': { target: apiProxyTarget, changeOrigin: true } },
  },
  preview: { port, host: '0.0.0.0', allowedHosts: true },
});

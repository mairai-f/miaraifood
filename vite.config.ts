import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  base: process.env.VERCEL ? "/" : "./",
  server: {
    host: "::",
    port: 8080,
    watch: {
      // VS Code can consume most Linux inotify watches in this monorepo.
      // Poll only source files and skip generated desktop/web artifacts.
      usePolling: true,
      interval: 500,
      ignored: [
        "**/release/**",
        "**/build/**",
        "**/dist/**",
        "**/dist-*/**",
        "**/coverage/**",
        "**/.expo/**",
        "**/.vercel/**",
      ],
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));

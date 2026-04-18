import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import autoprefixer from "autoprefixer";
import path from "path";
import tailwindcss from "tailwindcss";

export default defineConfig(() => ({
  root: __dirname,
  envDir: "..",
  publicDir: "../public",
  base: "./",
  server: {
    host: "::",
    port: 8081,
    hmr: {
      overlay: false,
    },
  },
  build: {
    outDir: "../dist-site",
    emptyOutDir: true,
  },
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          config: path.resolve(__dirname, "./tailwind.config.ts"),
        }),
        autoprefixer(),
      ],
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));

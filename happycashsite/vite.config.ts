import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));

/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_DEV_PROXY_TARGET || "https://stockout.flowb.io";

  return {
    // GitHub Pages serves project sites under /<repo>/; VITE_BASE_PATH sets that prefix at build time.
    base: env.VITE_BASE_PATH || "/",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "src") },
    },
    server: {
      port: 5173,
      // In development the browser calls same-origin /api/*; Vite forwards it to the gateway.
      proxy: {
        "/api": { target: proxyTarget, changeOrigin: true, secure: true },
      },
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router"],
            query: ["@tanstack/react-query", "@tanstack/react-table"],
            forms: ["react-hook-form", "zod", "@hookform/resolvers"],
            ui: ["radix-ui", "sonner", "class-variance-authority", "tailwind-merge", "clsx"],
            icons: ["@phosphor-icons/react"],
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
      testTimeout: 20_000,
    },
  };
});

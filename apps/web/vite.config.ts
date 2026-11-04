/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const apiOrigin = env.VITE_API_PROXY_TARGET;

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        includeAssets: ["favicon.svg", "icons/*.svg"],
        manifest: {
          name: "NUR Islamic Digital Experience",
          short_name: "NUR",
          description: "Experience Islam in a more beautiful digital world.",
          lang: "id",
          dir: "ltr",
          start_url: "/dashboard",
          scope: "/",
          display: "standalone",
          background_color: "#080D17",
          theme_color: "#064E3B",
          icons: [
            { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
            { src: "/icons/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,woff2}"],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: "/index.html",
          // Jangan pernah menyajikan respons API (termasuk auth) dari cache service worker.
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith("/models/") || url.pathname.startsWith("/textures/"),
              handler: "CacheFirst",
              options: { cacheName: "nur-3d-assets-v1", expiration: { maxEntries: 40 } },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: apiOrigin ? { "/api": { target: apiOrigin, changeOrigin: false } } : undefined,
    },
    preview: { port: 4173 },
    build: {
      target: "es2022",
      sourcemap: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/three/")) return "three";
            if (id.includes("@react-three")) return "r3f";
            if (id.includes("framer-motion") || id.includes("motion-dom")) return "motion";
            if (id.includes("node_modules/react") || id.includes("react-router") || id.includes("scheduler")) return "react";
            return undefined;
          },
        },
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: ["./src/tests/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
      css: false,
    },
  };
});

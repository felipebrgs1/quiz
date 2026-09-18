import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// Astro SSR na edge da Cloudflare + Hono nas rotas /api/*
// Sem framework client-side: interatividade em vanilla JS no Quiz.astro
export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  integrations: [],
  vite: {
    // @ts-expect-error - plugin tailwind v4
    plugins: [tailwindcss()],
    // PostCSS inline vazio: impede o Vite de subir pastas e ler o
    // postcss.config.mjs da raiz (projeto Next). Tailwind v4 roda pelo plugin do Vite.
    css: { postcss: { plugins: [] } },
  },
});

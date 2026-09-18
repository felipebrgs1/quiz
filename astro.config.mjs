import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";

// Astro SSR na edge da Cloudflare + Hono nas rotas /api/*
// Sem framework client-side: interatividade em vanilla JS no Quiz.astro
export default defineConfig({
  site: "https://quiz.cassiomota.com",
  output: "server",
  security: {
    // /config/login faz POST de formulário same-origin via Hono.
    // O checkOrigin interno do Astro compara Origin x URL e retorna
    // 403 "Cross-site POST form submissions are forbidden" quando há
    // divergência de protocolo/host atrás do proxy da Cloudflare ou
    // quando o navegador não envia Origin. Desliga para o Hono tratar.
    checkOrigin: false,
  },
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

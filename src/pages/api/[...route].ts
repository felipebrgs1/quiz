import type { APIRoute } from "astro";
import app from "../../server/app";

// Monta o Hono dentro do Astro SSR — todas as rotas /api/* caem aqui.
// Equivalente às Server Actions + route handlers do app Next atual.
export const ALL: APIRoute = ({ request, locals }) => {
  return app.fetch(request, locals.runtime.env);
};

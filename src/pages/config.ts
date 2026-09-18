import type { APIRoute } from "astro";
import app from "../server/app";

export const ALL: APIRoute = ({ request, locals }) => app.fetch(request, locals.runtime.env);

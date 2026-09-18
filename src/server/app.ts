import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { quizQuestions, type QuizAnswers } from "../lib/quiz";
import { evaluateRules, type QualificationRule } from "../lib/rules";
import { normalizePhone } from "../lib/phone";
import { buildWhatsappUrl } from "../lib/whatsapp";
import { analyticsPeriod, loadAnalytics } from "./analytics";
import { clearSession, CONFIG_PASSWORD, isAuthenticated, setSession } from "./auth";
import { renderDashboard, renderLogin } from "./dashboard";

export type Env = {
  DB: D1Database;
  WHATSAPP_PHONE?: string;
  WHATSAPP_MESSAGE_TEMPLATE?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.onError((error, c) => {
  if (error instanceof HTTPException) return error.getResponse();
  console.error("Request failed", c.req.path, error.message);
  return c.json({ ok: false, message: "Não foi possível salvar agora. Tente novamente." }, 500);
});
app.use("/api/*", bodyLimit({ maxSize: 32 * 1024 }));
app.use("/config/login", bodyLimit({ maxSize: 4 * 1024 }));

app.use(async (c, next) => {
  if (c.req.path.startsWith("/config")) {
    c.header("Cache-Control", "private, no-store");
    c.header("X-Robots-Tag", "noindex, nofollow, noarchive");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Frame-Options", "DENY");
  }
  await next();
});

app.get("/config/login", async (c) => {
  if (await isAuthenticated(c)) return c.redirect("/config", 302);
  return c.html(renderLogin());
});

app.post("/config/login", async (c) => {
  const body = (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
  const password = typeof body.password === "string" ? body.password : "";
  if (password && password === CONFIG_PASSWORD) {
    await setSession(c);
    return c.redirect("/config", 302);
  }
  return c.html(renderLogin("Senha incorreta. Tente novamente."), 401);
});

app.get("/config/logout", async (c) => {
  clearSession(c);
  return c.redirect("/config/login", 302);
});

app.get("/config", async (c) => {
  if (!(await isAuthenticated(c))) return c.redirect("/config/login", 302);
  const { period, since } = analyticsPeriod(c.req.query("period"));
  const data = await loadAnalytics(c.env.DB, since);
  return c.html(renderDashboard(data, period));
});

app.get("/api/health", (c) => c.json({ ok: true }));

const trackSchema = z.object({
  eventName: z.enum(["page_view", "quiz_start", "quiz_step_view", "quiz_answer", "lead_form_view", "lead_submit_attempt", "lead_submit_success", "lead_submit_error"]),
  anonymousId: z.string().max(120).optional(),
  sessionId: z.string().max(120).optional(),
  quizStep: z.number().int().min(0).max(20).optional(),
  questionId: z.string().max(80).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  utm: z.record(z.string(), z.string()).optional(),
  referrer: z.string().max(1000).optional(),
  sourceUrl: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Eventos de navegação; conclusões são contabilizadas diretamente na tabela leads.
app.post("/api/track", async (c) => {
  const parsed = trackSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ ok: false }, 400);
  const d = parsed.data;

  await c.env.DB.prepare(
    `INSERT INTO analytics_events
      (id, event_name, anonymous_id, session_id, quiz_step, question_id, progress_percent, utm_json, referrer, source_url, user_agent, metadata_json)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      d.eventName,
      d.anonymousId ?? null,
      d.sessionId ?? null,
      d.quizStep ?? null,
      d.questionId ?? null,
      d.progressPercent ?? null,
      JSON.stringify(d.utm ?? {}),
      d.referrer ?? null,
      d.sourceUrl ?? null,
      c.req.header("user-agent") ?? null,
      JSON.stringify(d.metadata ?? {})
    )
    .run();

  return c.json({ ok: true });
});

const leadSchema = z.object({
  submissionId: z.uuid(),
  name: z.string().trim().min(2, "Informe seu nome completo.").max(160),
  phone: z.string().trim().min(10, "Informe um telefone com DDD.").max(20),
  answers: z.record(z.string(), z.unknown()),
  utm: z.record(z.string(), z.string()).optional(),
  sourceUrl: z.string().max(2000).optional(),
  anonymousId: z.string().max(120).optional(),
  sessionId: z.string().max(120).optional(),
});

// Valida e persiste o formulário antes de confirmar o recebimento.
app.post("/api/lead", async (c) => {
  const parsed = leadSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ ok: false, message: "Revise os campos destacados.", errors: z.flattenError(parsed.error).fieldErrors }, 400);
  }
  const phoneNormalized = normalizePhone(parsed.data.phone);
  if (!/^(?:55)?[1-9]\d\d{8,9}$/.test(phoneNormalized)) {
    return c.json({ ok: false, message: "Informe um telefone válido com DDD." }, 400);
  }

  // Valida respostas contra quizQuestions (igual parseAnswers do Next)
  const normalized = {} as QuizAnswers;
  for (const q of quizQuestions) {
    const raw = parsed.data.answers[q.id];
    if (q.type === "multiple") {
      if (!Array.isArray(raw) || raw.length === 0)
        return c.json({ ok: false, message: "Responda todas as perguntas antes de continuar." }, 400);
      const values = raw.map(String);
      if (values.some((v) => !q.options.some((o) => o.value === v)))
        return c.json({ ok: false, message: "Uma das respostas enviadas é inválida." }, 400);
      (normalized as Record<string, unknown>)[q.id] = values;
    } else {
      if (typeof raw !== "string" || !raw)
        return c.json({ ok: false, message: "Responda todas as perguntas antes de continuar." }, 400);
      if (!q.options.some((o) => o.value === raw))
        return c.json({ ok: false, message: "Uma das respostas enviadas é inválida." }, 400);
      (normalized as Record<string, unknown>)[q.id] = raw;
    }
  }

  // Regras do D1
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, enabled, priority, outcome, root_logic, groups_json FROM qualification_rules ORDER BY priority ASC"
  ).all<Record<string, unknown>>();

  const rules: QualificationRule[] = (results ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    enabled: Number(r.enabled) === 1,
    priority: Number(r.priority),
    outcome: r.outcome as "qualified" | "unqualified",
    root_logic: r.root_logic as "all" | "any",
    groups: JSON.parse(String(r.groups_json ?? "[]")),
  }));

  const evaluation = evaluateRules(normalized, rules);
  const leadId = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO leads
      (id, name, phone, phone_normalized, anonymous_id, session_id, answers_json, qualification_status, qualified, matched_rule_id, matched_rule_name, utm_json, source_url, user_agent, submission_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(submission_id) DO NOTHING`
  )
    .bind(
      leadId,
      parsed.data.name,
      parsed.data.phone,
      phoneNormalized,
      parsed.data.anonymousId ?? null,
      parsed.data.sessionId ?? null,
      JSON.stringify(normalized),
      evaluation.status,
      evaluation.qualified ? 1 : 0,
      evaluation.matchedRuleId,
      evaluation.matchedRuleName,
      JSON.stringify(parsed.data.utm ?? {}),
      parsed.data.sourceUrl ?? null,
      c.req.header("user-agent") ?? null,
      parsed.data.submissionId
    )
    .run();

  const saved = await c.env.DB.prepare(
    "SELECT id, name, phone, phone_normalized, answers_json, qualification_status, qualified FROM leads WHERE submission_id = ?"
  ).bind(parsed.data.submissionId).first<{
    id: string; name: string; phone: string; phone_normalized: string;
    answers_json: string; qualification_status: string; qualified: number;
  }>();
  if (!saved) throw new Error("Lead insert could not be confirmed");

  const whatsappUrl = saved.qualified
    ? buildWhatsappUrl({
        destination: c.env.WHATSAPP_PHONE ?? "",
        template: c.env.WHATSAPP_MESSAGE_TEMPLATE ?? "Olá {{name}}! Protocolo {{protocol}}",
        lead: { ...saved, answers: JSON.parse(saved.answers_json) },
      })
    : null;

  return c.json({
    ok: true,
    qualified: Boolean(saved.qualified),
    status: saved.qualification_status,
    leadId: saved.id,
    whatsappUrl,
    redirectTo: saved.qualified ? `/resultado?qualified=1&leadId=${saved.id}` : `/resultado?status=received`,
  });
});

export default app;

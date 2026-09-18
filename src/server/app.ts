import { Hono } from "hono";
import { z } from "zod";
import { quizQuestions, type QuizAnswers } from "../lib/quiz";
import { evaluateRules, type QualificationRule } from "../lib/rules";
import { normalizePhone } from "../lib/phone";
import { buildWhatsappUrl } from "../lib/whatsapp";

export type Env = {
  DB: D1Database;
  WHATSAPP_PHONE?: string;
  WHATSAPP_MESSAGE_TEMPLATE?: string;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

const trackSchema = z.object({
  eventName: z.string().min(2).max(80),
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

// POST /api/track — espelha trackAnalyticsEventAction do Next
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
  name: z.string().trim().min(2, "Informe seu nome completo."),
  phone: z.string().trim().min(10, "Informe um telefone com DDD.").max(20),
  answers: z.record(z.string(), z.unknown()),
  utm: z.record(z.string(), z.string()).optional(),
  sourceUrl: z.string().max(2000).optional(),
  anonymousId: z.string().max(120).optional(),
  sessionId: z.string().max(120).optional(),
});

// POST /api/lead — espelha submitLeadAction do Next
app.post("/api/lead", async (c) => {
  const parsed = leadSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ ok: false, message: "Revise os campos destacados.", errors: parsed.error.flatten().fieldErrors }, 400);
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
  const phoneNormalized = normalizePhone(parsed.data.phone);

  await c.env.DB.prepare(
    `INSERT INTO leads
      (id, name, phone, phone_normalized, anonymous_id, session_id, answers_json, qualification_status, qualified, matched_rule_id, matched_rule_name, utm_json, source_url, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      c.req.header("user-agent") ?? null
    )
    .run();

  const whatsappUrl = evaluation.qualified
    ? buildWhatsappUrl({
        destination: c.env.WHATSAPP_PHONE ?? "",
        template: c.env.WHATSAPP_MESSAGE_TEMPLATE ?? "Olá {{name}}! Protocolo {{protocol}}",
        lead: { id: leadId, name: parsed.data.name, phone: parsed.data.phone, phone_normalized: phoneNormalized, answers: normalized },
      })
    : null;

  return c.json({
    ok: true,
    qualified: evaluation.qualified,
    status: evaluation.status,
    leadId,
    whatsappUrl,
    redirectTo: evaluation.qualified ? `/resultado?qualified=1&leadId=${leadId}` : `/resultado?status=received`,
  });
});

export default app;

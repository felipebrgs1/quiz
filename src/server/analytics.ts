import type { D1Database } from "@cloudflare/workers-types";
import { TIERS, getAnswerScore, quizQuestions, type TierId } from "../lib/quiz";

export function analyticsPeriod(value?: string, now = new Date()) {
  const period = ["today", "7", "30", "all"].includes(value ?? "") ? value! : "today";
  const brazilDate = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const start = new Date(`${brazilDate}T00:00:00-03:00`);
  if (period === "7" || period === "30") start.setUTCDate(start.getUTCDate() - Number(period) + 1);
  return { period, since: period === "all" ? "1970-01-01T00:00:00.000Z" : start.toISOString() };
}

export async function loadAnalytics(db: D1Database, since: string) {
  const queries = [
    db.prepare(`SELECT
      COUNT(CASE WHEN event_name = 'page_view' THEN 1 END) AS views,
      COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN anonymous_id END) AS visitors,
      COUNT(DISTINCT CASE WHEN event_name = 'page_view' THEN session_id END) AS sessions,
      COUNT(DISTINCT CASE WHEN event_name = 'quiz_start' THEN session_id END) AS starts,
      COUNT(DISTINCT CASE WHEN event_name = 'lead_form_view' THEN session_id END) AS forms
      FROM analytics_events WHERE created_at >= ?`).bind(since),
    db.prepare(`SELECT COUNT(*) AS leads,
      COALESCE(AVG(score_total), 0) AS avg_score,
      COUNT(DISTINCT session_id) AS completed_sessions,
      COUNT(CASE WHEN tier = 'artesanal' THEN 1 END) AS artesanal,
      COUNT(CASE WHEN tier = 'transicao' THEN 1 END) AS transicao,
      COUNT(CASE WHEN tier = 'estruturado' THEN 1 END) AS estruturado,
      COUNT(CASE WHEN tier = 'maquina' THEN 1 END) AS maquina
      FROM leads WHERE created_at >= ?`).bind(since),
    db.prepare(`SELECT question_id,
      COUNT(DISTINCT CASE WHEN event_name = 'quiz_step_view' THEN session_id END) AS views,
      COUNT(DISTINCT CASE WHEN event_name = 'quiz_answer' THEN session_id END) AS answers
      FROM analytics_events WHERE created_at >= ? AND question_id IS NOT NULL
      GROUP BY question_id`).bind(since),
    db.prepare(`SELECT strftime('%Y-%m-%d %H:00', created_at, '-3 hours') AS hour,
      COUNT(*) AS views, COUNT(DISTINCT anonymous_id) AS visitors
      FROM analytics_events WHERE created_at >= ? AND event_name = 'page_view'
      GROUP BY hour ORDER BY hour DESC LIMIT 24`).bind(since),
    db.prepare(`SELECT COALESCE(NULLIF(json_extract(utm_json, '$.utm_source'), ''), 'Direto / sem UTM') AS source,
      COUNT(DISTINCT session_id) AS sessions
      FROM analytics_events WHERE created_at >= ? AND event_name = 'page_view'
      GROUP BY source ORDER BY sessions DESC LIMIT 10`).bind(since),
    db.prepare(`SELECT id, created_at, name, phone, score_total, tier, bottleneck_json, answers_json
      FROM leads WHERE created_at >= ? ORDER BY created_at DESC LIMIT 100`).bind(since),
    db.prepare(`SELECT answers_json FROM leads WHERE created_at >= ? LIMIT 2000`).bind(since),
  ];
  const [events, leads, questions, hours, sources, recent, allAnswers] = await db.batch<Record<string, unknown>>(queries);
  const totals = { ...events.results[0], ...leads.results[0] } as Record<string, number>;

  const questionScores: Record<string, { sum: number; count: number }> = {};
  for (const row of allAnswers.results) {
    let answers: Record<string, unknown> = {};
    try { answers = JSON.parse(String(row.answers_json ?? "{}")); } catch { continue; }
    for (const q of quizQuestions) {
      const score = getAnswerScore(q.id, answers[q.id]);
      if (score > 0) {
        questionScores[q.id] ??= { sum: 0, count: 0 };
        questionScores[q.id].sum += score;
        questionScores[q.id].count += 1;
      }
    }
  }

  return {
    totals,
    tiers: (Object.keys(TIERS) as TierId[]).map((id) => ({
      id,
      name: TIERS[id].name,
      stage: TIERS[id].stage,
      count: Number(totals[id] ?? 0),
    })),
    questions: quizQuestions.map((q, index) => {
      const row = questions.results.find((r) => r.question_id === q.id);
      const views = Number(row?.views ?? 0);
      const answers = Number(row?.answers ?? 0);
      const scored = questionScores[q.id];
      return {
        title: q.title,
        pillar: q.pillar,
        number: index + 1,
        views,
        answers,
        unanswered: Math.max(0, views - answers),
        avgScore: scored ? scored.sum / scored.count : 0,
      };
    }),
    hours: hours.results as { hour: string; views: number; visitors: number }[],
    sources: sources.results as { source: string; sessions: number }[],
    recent: recent.results as { id: string; created_at: string; name: string; phone: string; score_total: number; tier: TierId; bottleneck_json: string; answers_json: string }[],
  };
}

export type Analytics = Awaited<ReturnType<typeof loadAnalytics>>;

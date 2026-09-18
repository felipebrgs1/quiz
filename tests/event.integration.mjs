import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";

const base = process.env.TEST_URL ?? "http://localhost:8787";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "Use somente um banco local isolado.");
const PASSWORD = process.env.TEST_CONFIG_PASSWORD ?? "Fecoimp2026";

const sessionCookie = (response) => {
  const header = response.headers.get("set-cookie");
  if (!header) return null;
  const match = header.match(/msa_config=[^;]*/);
  return match ? match[0] : null;
};

const login = (password) => fetch(`${base}/config/login`, {
  method: "POST",
  redirect: "manual",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    origin: base,
  },
  body: new URLSearchParams({ password }).toString(),
});

const dashboard = async (cookie, period = "all") => {
  const response = await fetch(`${base}/config?period=${period}`, { headers: { cookie } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  return response.text();
};

const metric = (html, title) => {
  const match = html.match(new RegExp(`<h2>${title}</h2><p class="value">([^<]+)</p>`));
  assert.ok(match, `Métrica ausente: ${title}`);
  return match[1];
};

const metricNumber = (html, title) => Number(metric(html, title).replaceAll(".", ""));

const post = (path, body) => fetch(`${base}${path}`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
});

const TOP_ANSWERS = {
  captacao: "captacao_estruturada",
  pre_venda: "pre_venda_crm",
  fechamento: "acima_40",
  pos_venda_indicacao: "programa_embaixadores",
  pos_venda_acompanhamento: "comunicacao_estruturada",
};

let cookie;

test("painel exige login pela tela própria e não expõe contatos sem sessão", async () => {
  const anonymous = await fetch(`${base}/config`, { redirect: "manual" });
  assert.equal(anonymous.status, 302);
  assert.match(anonymous.headers.get("location"), /\/config\/login/);
  assert.match(anonymous.headers.get("cache-control"), /no-store/);

  const form = await fetch(`${base}/config/login`);
  assert.equal(form.status, 200);
  assert.match(form.headers.get("cache-control"), /no-store/);
  const formHtml = await form.text();
  assert.ok(formHtml.includes('name="password"'));
  assert.ok(formHtml.includes("Mota e Silva") || formHtml.includes("Painel do quiz"));
  assert.ok(!formHtml.includes("Diagnósticos concluídos"));

  const wrong = await login("senha-errada");
  assert.equal(wrong.status, 401);
  assert.ok((await wrong.text()).includes("Senha incorreta"));
  assert.equal(sessionCookie(wrong), null);

  const ok = await login(PASSWORD);
  assert.equal(ok.status, 302);
  assert.match(ok.headers.get("location"), /\/config/);
  cookie = sessionCookie(ok);
  assert.ok(cookie);
});

test("diagnóstico pontua no servidor, detecta gargalo e alimenta analytics", async () => {
  const before = await dashboard(cookie);
  const anonymousId = randomUUID();
  const sessionId = randomUUID();
  const tracking = { anonymousId, sessionId, utm: { utm_source: "teste-evento" }, sourceUrl: `${base}/` };
  for (const event of [
    { eventName: "page_view" }, { eventName: "page_view" }, { eventName: "quiz_start" },
    { eventName: "quiz_step_view", questionId: "captacao", quizStep: 1 },
    { eventName: "quiz_answer", questionId: "captacao", quizStep: 1 },
    { eventName: "lead_form_view", quizStep: 6 },
  ]) {
    assert.equal((await post("/api/track", { ...tracking, ...event })).status, 200);
  }
  const lead = {
    ...tracking, submissionId: randomUUID(), name: "Teste <script>alert(1)</script>", phone: "(11) 99999-1234",
    answers: { ...TOP_ANSWERS, fechamento: "abaixo_20" },
  };
  const responses = await Promise.all([post("/api/lead", lead), post("/api/lead", lead)]);
  const saved = [];
  for (const response of responses) {
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.tier, "maquina");
    assert.equal(body.score, 18);
    assert.deepEqual(body.bottleneck, ["Fechamento"]);
    assert.match(body.redirectTo, /^\/resultado\?leadId=/);
    saved.push(body);
  }
  assert.equal(saved[0].leadId, saved[1].leadId, "Reenvios não podem criar dois diagnósticos");

  const resultPage = await fetch(`${base}${saved[0].redirectTo}`);
  assert.equal(resultPage.status, 200);
  const resultHtml = await resultPage.text();
  assert.ok(resultHtml.includes("Máquina de Vendas"));
  assert.ok(resultHtml.includes("18 de 20"));
  assert.ok(resultHtml.includes("Fechamento"));
  assert.ok(resultHtml.includes("estande"));

  const weak = {
    ...tracking, submissionId: randomUUID(), name: "Escritório Iniciante", phone: "(21) 98888-7777",
    answers: {
      captacao: "boca_boca",
      pre_venda: "eu_atendo",
      fechamento: "nunca_medi",
      pos_venda_indicacao: "nada",
      pos_venda_acompanhamento: "so_no_fim",
    },
  };
  const weakRes = await post("/api/lead", weak);
  assert.equal(weakRes.status, 200);
  const weakBody = await weakRes.json();
  assert.equal(weakBody.tier, "artesanal");
  assert.equal(weakBody.score, 5);
  assert.equal(weakBody.bottleneck.length, 5);

  const after = await dashboard(cookie);
  assert.equal(metricNumber(after, "Diagnósticos concluídos"), metricNumber(before, "Diagnósticos concluídos") + 2);
  assert.equal(metricNumber(after, "Visitantes únicos"), metricNumber(before, "Visitantes únicos") + 1);
  assert.equal(metricNumber(after, "Visitas"), metricNumber(before, "Visitas") + 1);
  assert.equal(metricNumber(after, "Iniciaram"), metricNumber(before, "Iniciaram") + 1);
  assert.ok(after.includes(`QZ-${saved[0].leadId.slice(0, 8).toUpperCase()}`));
  assert.ok(after.includes("Teste &lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!after.includes("Teste <script>"));
  assert.ok(after.includes("Abaixo de 20%"));
  assert.ok(after.includes("Escritório Artesanal"));
  assert.ok(after.includes("teste-evento"));

  for (const invalid of [
    { ...lead, submissionId: randomUUID(), answers: {} },
    { ...lead, submissionId: randomUUID(), answers: { ...TOP_ANSWERS, fechamento: "inventado" } },
    { ...lead, submissionId: randomUUID(), phone: "abcdefghijk" },
    { ...lead, submissionId: "invalid" },
  ]) assert.equal((await post("/api/lead", invalid)).status, 400);
  assert.equal((await post("/api/track", { ...tracking, eventName: "invented_event" })).status, 400);
  assert.equal(metricNumber(await dashboard(cookie), "Diagnósticos concluídos"), metricNumber(after, "Diagnósticos concluídos"));

  for (const period of ["today", "7", "30", "invalid"]) await dashboard(cookie, period);

  const logout = await fetch(`${base}/config/logout`, { headers: { cookie }, redirect: "manual" });
  assert.equal(logout.status, 302);
  const afterLogout = await fetch(`${base}/config`, { redirect: "manual" });
  assert.equal(afterLogout.status, 302);
});

import { bottleneckText, getAnswerLabel, getAnswerScore, quizQuestions } from "../lib/quiz";
import { getLeadProtocol } from "../lib/protocol";
import type { Analytics } from "./analytics";

const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);
const number = (value: number) => value.toLocaleString("pt-BR");
const date = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function renderDashboard(data: Analytics, period: string) {
  const { totals: t } = data;
  const conversion = t.sessions ? Math.min(100, t.completed_sessions / t.sessions * 100) : 0;
  const avgScore = Number(t.avg_score ?? 0);
  const cards = [
    ["Visitantes únicos", number(t.visitors), "Navegadores que abriram o quiz"],
    ["Visitas", number(t.sessions), `${number(t.views)} visualizações de página`],
    ["Iniciaram", number(t.starts), "Visitas que começaram as perguntas"],
    ["Diagnósticos concluídos", number(t.leads), t.leads ? `Média de ${avgScore.toFixed(1).replace(".", ",")} pontos` : "Nenhum diagnóstico ainda"],
    ["Conversão", `${conversion.toFixed(1).replace(".", ",")}%`, "Visitas com diagnóstico enviado / visitas"],
  ];
  const funnel = [
    ["Acessaram o quiz", t.sessions], ["Iniciaram as perguntas", t.starts],
    ["Chegaram ao contato", t.forms], ["Concluíram o diagnóstico", t.completed_sessions],
  ] as const;
  const maxHour = Math.max(1, ...data.hours.map((h) => h.views));
  return `<!doctype html>
<html lang="pt-BR"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>Painel do evento — Mota e Silva</title>
  <link rel="icon" href="/favicon.png">
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #09090b; color: #fafafa; }
    * { box-sizing: border-box; } body { margin: 0; } main { max-width: 1200px; margin: auto; padding: 36px 24px 64px; }
    header, .toolbar, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    header { padding-bottom: 28px; border-bottom: 1px solid #27272a; } .brand { display: flex; align-items: center; gap: 18px; }
    .brand img { width: 96px; height: auto; mix-blend-mode: screen; } .eyebrow { color: #fb923c; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; }
    h1 { font-size: 25px; letter-spacing: -.04em; margin: 6px 0 0; } h2 { font-size: 17px; margin: 0 0 8px; }
    p { margin: 0; } .muted, small { color: #a1a1aa; font-size: 12px; line-height: 1.6; } .toolbar { margin: 24px 0; }
    form { display: flex; align-items: center; gap: 10px; } select, button { font: inherit; font-size: 13px; border: 1px solid #3f3f46; border-radius: 8px; padding: 10px 12px; background: #18181b; color: #fafafa; }
    button { cursor: pointer; } button:hover { border-color: #fb923c; } :focus-visible { outline: 2px solid #fb923c; outline-offset: 4px; }
    .live { display: flex; gap: 8px; align-items: center; font-size: 12px; color: #a1a1aa; } input { accent-color: #fb923c; }
    .cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; } .card { background: #111113; border: 1px solid #27272a; border-radius: 12px; padding: 20px; }
    .card h2 { color: #a1a1aa; font-size: 12px; font-weight: 500; } .value { font-size: 32px; font-weight: 600; letter-spacing: -.04em; margin: 12px 0 4px; font-variant-numeric: tabular-nums; }
    .card:last-child .value { color: #fb923c; } .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 36px; }
    section { min-width: 0; } .wide { margin-top: 36px; } .section-heading { margin-bottom: 16px; }
    .funnel-row { margin-top: 20px; } .row-label { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; margin-bottom: 9px; }
    .track { height: 6px; background: #27272a; border-radius: 10px; overflow: hidden; } .fill { height: 100%; background: #fb923c; border-radius: inherit; }
    .table-wrap { overflow-x: auto; } table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th { color: #a1a1aa; font-size: 11px; font-weight: 500; } th, td { padding: 13px 10px; border-bottom: 1px solid #27272a; vertical-align: top; }
    th:first-child, td:first-child { padding-left: 0; } .numeric { text-align: right; font-variant-numeric: tabular-nums; }
    .badge { display: inline-block; border-radius: 5px; background: #27272a; padding: 4px 7px; font-size: 11px; white-space: nowrap; }
    .tier-maquina { background: #064e3b; color: #a7f3d0; } .tier-estruturado { background: #0c4a6e; color: #bae6fd; } .tier-transicao { background: #78350f; color: #fde68a; } .empty { padding: 28px 0; color: #71717a; font-size: 13px; }
    details { margin-top: 8px; max-width: 440px; } summary { cursor: pointer; color: #fb923c; font-size: 12px; } dl { font-size: 12px; } dt { color: #a1a1aa; margin-top: 12px; } dd { margin: 4px 0; }
    .hour { display: grid; grid-template-columns: 110px 1fr 32px; align-items: center; gap: 12px; padding: 7px 0; font-size: 12px; } .phone { white-space: nowrap; color: #e4e4e7; }
    .meta { display: flex; align-items: center; gap: 16px; } .logout { font-size: 12px; color: #a1a1aa; text-decoration: none; border: 1px solid #3f3f46; border-radius: 8px; padding: 8px 12px; } .logout:hover { color: #fafafa; border-color: #fb923c; }
    footer { margin-top: 32px; border-top: 1px solid #27272a; padding-top: 20px; }
    @media (max-width: 900px) { .cards { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 600px) { main { padding: 24px 16px 40px; } .cards { grid-template-columns: repeat(2, 1fr); } .card { padding: 16px; } .cards .card:last-child { grid-column: 1 / -1; } .grid { grid-template-columns: 1fr; gap: 28px; } h1 { font-size: 21px; } .brand img { width: 78px; } }
  </style>
</head><body><main>
  <header><div class="brand"><img src="/msa-logo.webp" alt="Mota e Silva Advogados" width="430" height="122"><div><p class="eyebrow">Acompanhamento do evento</p><h1>Visão geral do quiz</h1></div></div><div class="meta"><p class="muted">Atualizado em ${escape(date(new Date().toISOString()))}<br>Horário de Brasília</p><a class="logout" href="/config/logout">Sair</a></div></header>
  <div class="toolbar"><form method="get" action="/config"><label for="period" class="muted">Período</label><select id="period" name="period">${[["today", "Hoje"], ["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["all", "Todo o período"]].map(([value, label]) => `<option value="${value}" ${value === period ? "selected" : ""}>${label}</option>`).join("")}</select><button type="submit">Atualizar</button></form><label class="live"><input id="auto-refresh" type="checkbox" checked> Atualizar a cada 30 segundos</label></div>
  <div class="cards">${cards.map(([title, value, note]) => `<section class="card"><h2>${escape(title)}</h2><p class="value">${escape(value)}</p><small>${escape(note)}</small></section>`).join("")}</div>
  <div class="grid"><section><h2>Do acesso ao contato</h2><p class="muted">Cada visita é contada uma vez em cada fase.</p>${funnel.map(([label, count]) => `<div class="funnel-row"><div class="row-label"><span>${label}</span><strong>${number(count)}</strong></div><div class="track"><div class="fill" style="width:${t.sessions ? Math.min(100, count / t.sessions * 100) : 0}%"></div></div></div>`).join("")}</section>
  <section><h2>Onde as pessoas param</h2><p class="muted">Visitas que viram a pergunta e ainda não a responderam no período, com a nota média de quem respondeu.</p><div class="table-wrap"><table><thead><tr><th>Pergunta</th><th class="numeric">Viram</th><th class="numeric">Responderam</th><th class="numeric">Sem resposta</th><th class="numeric">Nota média</th></tr></thead><tbody>${data.questions.map((q) => `<tr><td>${q.number}. ${escape(q.title)}</td><td class="numeric">${number(q.views)}</td><td class="numeric">${number(q.answers)}</td><td class="numeric">${number(q.unanswered)}</td><td class="numeric">${q.avgScore ? q.avgScore.toFixed(1).replace(".", ",") : "—"}</td></tr>`).join("")}</tbody></table></div></section></div>
  <section class="wide"><div class="section-heading"><div><h2>Estágios dos escritórios</h2><p class="muted">Distribuição dos diagnósticos concluídos no período.</p></div><span class="badge">${number(t.leads)} no período</span></div>${data.tiers.map((tier) => `<div class="funnel-row"><div class="row-label"><span>Estágio ${tier.stage} — ${escape(tier.name)}</span><strong>${number(tier.count)}</strong></div><div class="track"><div class="fill" style="width:${t.leads ? Math.min(100, tier.count / t.leads * 100) : 0}%"></div></div></div>`).join("")}</section>
  <div class="grid"><section><h2>Acessos por hora</h2><p class="muted">Últimas 24 faixas com acessos dentro do período.</p>${data.hours.length ? [...data.hours].reverse().map((h) => `<div class="hour"><span>${escape(h.hour.slice(8, 10) + "/" + h.hour.slice(5, 7) + " · " + h.hour.slice(11))}</span><div class="track"><div class="fill" style="width:${h.views / maxHour * 100}%"></div></div><span class="numeric">${number(h.views)}</span></div>`).join("") : '<p class="empty">Os primeiros acessos aparecerão aqui.</p>'}</section>
  <section><h2>Origem das visitas</h2><p class="muted">Identificada pelo parâmetro utm_source do link ou QR code.</p>${data.sources.length ? `<table><thead><tr><th>Origem</th><th class="numeric">Visitas</th></tr></thead><tbody>${data.sources.map((s) => `<tr><td>${escape(s.source)}</td><td class="numeric">${number(s.sessions)}</td></tr>`).join("")}</tbody></table>` : '<p class="empty">Nenhuma origem registrada ainda.</p>'}</section></div>
  <section class="wide"><div class="section-heading"><div><h2>Diagnósticos concluídos</h2><p class="muted">Até 100 envios mais recentes do período. Abra um contato para ver as respostas e o gargalo.</p></div><span class="badge">${number(t.leads)} no período</span></div>${data.recent.length ? `<div class="table-wrap"><table><thead><tr><th>Nome e respostas</th><th>Telefone</th><th class="numeric">Pontos</th><th>Estágio</th><th>Recebido em</th></tr></thead><tbody>${data.recent.map((lead) => {
    const answers = JSON.parse(lead.answers_json);
    const bottleneck: string[] = JSON.parse(lead.bottleneck_json ?? "[]");
    const tierName = data.tiers.find((tier) => tier.id === lead.tier)?.name ?? lead.tier;
    return `<tr><td>${escape(lead.name)}<details><summary>Ver respostas e gargalo</summary><dl>${quizQuestions.map((q) => `<dt>${escape(q.title)}</dt><dd>${escape(getAnswerLabel(q.id, answers[q.id]))} — nota ${getAnswerScore(q.id, answers[q.id])}</dd>`).join("")}</dl><small>Gargalo: ${escape(bottleneckText(bottleneck))}</small><br><small>Protocolo: ${escape(getLeadProtocol(lead))}</small></details></td><td class="phone">${escape(lead.phone)}</td><td class="numeric">${escape(lead.score_total)}/20</td><td><span class="badge tier-${escape(lead.tier)}">${escape(tierName)}</span></td><td>${escape(date(lead.created_at))}</td></tr>`;
  }).join("")}</tbody></table></div>` : '<p class="empty">Nenhum contato recebido neste período.</p>'}</section>
  <footer class="muted">Visitantes são estimados por navegador; visitas correspondem às sessões do quiz. Diagnósticos são contados diretamente no D1 após o envio confirmado. O painel pausa a atualização enquanto você consulta respostas.</footer>
</main><script>
  const refresh = document.getElementById('auto-refresh');
  document.getElementById('period').addEventListener('change', () => { refresh.checked = false; });
  setInterval(() => {
    if (refresh.checked && !document.hidden && !document.querySelector('details[open]') && !window.getSelection()?.toString()) location.reload();
  }, 30000);
</script></body></html>`;
}

export function renderLogin(error?: string) {
  return `<!doctype html>
<html lang="pt-BR"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>Entrar — Painel do evento</title>
  <link rel="icon" href="/favicon.png">
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #09090b; color: #fafafa; }
    * { box-sizing: border-box; } body { margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
    .card { width: 100%; max-width: 380px; text-align: center; } img { width: 104px; height: auto; mix-blend-mode: screen; }
    .eyebrow { color: #fb923c; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; margin: 22px 0 0; }
    h1 { font-size: 24px; letter-spacing: -.03em; margin: 8px 0 0; } p { margin: 0; } .muted { color: #a1a1aa; font-size: 13px; line-height: 1.6; margin-top: 8px; }
    form { margin-top: 24px; text-align: left; } label { display: block; font-size: 13px; color: #d4d4d8; margin-bottom: 8px; }
    input { width: 100%; font: inherit; font-size: 16px; color: #fafafa; background: #111113; border: 1px solid #3f3f46; border-radius: 12px; padding: 14px; outline: none; }
    input:focus { border-color: #fb923c; } button { width: 100%; margin-top: 12px; font: inherit; font-size: 15px; font-weight: 600; color: #fff; background: #f97316; border: 0; border-radius: 12px; padding: 14px; cursor: pointer; }
    button:hover { background: #fb923c; } :focus-visible { outline: 2px solid #fb923c; outline-offset: 4px; }
    .error { margin-top: 12px; font-size: 13px; line-height: 1.5; color: #fca5a5; background: rgb(239 68 68 / 0.1); border: 1px solid rgb(239 68 68 / 0.3); border-radius: 12px; padding: 12px; }
    footer { margin-top: 24px; }
  </style>
</head><body><main class="card">
  <img src="/msa-logo.webp" alt="Mota e Silva Advogados" width="430" height="122">
  <p class="eyebrow">Acompanhamento do evento</p>
  <h1>Painel do quiz</h1>
  <p class="muted">Acesso restrito à equipe do evento.</p>
  <form method="post" action="/config/login">
    <label for="password">Senha</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
    <button type="submit">Entrar no painel</button>
  </form>
  ${error ? `<p class="error" role="alert">${escape(error)}</p>` : ""}
  <footer class="muted">Uso interno · Mota e Silva Advogados</footer>
</main></body></html>`;
}

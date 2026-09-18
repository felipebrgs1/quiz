-- Diagnóstico de escritórios: troca qualificação binária por pontuação + estágio.
-- Bancos existentes (local/remoto) estão vazios ou com dados do quiz anterior.

CREATE TABLE leads_new (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  anonymous_id TEXT,
  session_id TEXT,
  answers_json TEXT NOT NULL,
  score_total INTEGER NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('artesanal','transicao','estruturado','maquina')),
  bottleneck_json TEXT NOT NULL DEFAULT '[]',
  utm_json TEXT DEFAULT '{}',
  source_url TEXT,
  user_agent TEXT,
  submission_id TEXT
);

INSERT INTO leads_new
  (id, created_at, name, phone, phone_normalized, anonymous_id, session_id, answers_json,
   score_total, tier, bottleneck_json, utm_json, source_url, user_agent, submission_id)
SELECT id, created_at, name, phone, phone_normalized, anonymous_id, session_id, answers_json,
  0, 'transicao', '[]', utm_json, source_url, user_agent, submission_id
FROM leads;

DROP TABLE leads;
ALTER TABLE leads_new RENAME TO leads;

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_submission ON leads (submission_id);
CREATE INDEX IF NOT EXISTS idx_leads_tier ON leads (tier, created_at DESC);

-- Motor de regras do quiz anterior (qualified/unqualified) não é mais usado.
DROP TABLE IF EXISTS qualification_rules;

-- D1 (SQLite) — versão enxuta do supabase/schema.sql do app Next.

CREATE TABLE IF NOT EXISTS qualification_rules (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 100,
  outcome TEXT NOT NULL CHECK (outcome IN ('qualified','unqualified')),
  root_logic TEXT NOT NULL DEFAULT 'all' CHECK (root_logic IN ('all','any')),
  groups_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON qualification_rules (enabled, priority);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,
  anonymous_id TEXT,
  session_id TEXT,
  answers_json TEXT NOT NULL,
  qualification_status TEXT NOT NULL CHECK (qualification_status IN ('qualified','unqualified','pending_rules')),
  qualified INTEGER NOT NULL DEFAULT 0,
  matched_rule_id TEXT REFERENCES qualification_rules(id) ON DELETE SET NULL,
  matched_rule_name TEXT,
  utm_json TEXT DEFAULT '{}',
  source_url TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  event_name TEXT NOT NULL,
  anonymous_id TEXT,
  session_id TEXT,
  quiz_step INTEGER,
  question_id TEXT,
  progress_percent INTEGER,
  utm_json TEXT DEFAULT '{}',
  referrer TEXT,
  source_url TEXT,
  user_agent TEXT,
  metadata_json TEXT DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_events_name ON analytics_events (event_name, created_at DESC);

-- Regra padrão: mesma do app atual (desqualifica autônomo/desempregado/com advogado/sem documento)
INSERT OR IGNORE INTO qualification_rules (id, name, enabled, priority, outcome, root_logic, groups_json)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Desqualificação automática',
  1,
  100,
  'unqualified',
  'any',
  '[{"logic":"any","conditions":[{"questionId":"work_situation","operator":"equals","values":["autonomo"]},{"questionId":"work_situation","operator":"equals","values":["desempregado"]},{"questionId":"has_lawyer","operator":"equals","values":["sim"]},{"questionId":"medical_documents","operator":"equals","values":["nao"]}]}]'
);

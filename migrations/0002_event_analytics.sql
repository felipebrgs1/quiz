CREATE INDEX IF NOT EXISTS idx_events_created ON analytics_events (created_at, event_name);
CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events (session_id, event_name);

-- Uma confirmação repetida (por falha de rede) não deve duplicar o contato.
ALTER TABLE leads ADD COLUMN submission_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_submission ON leads (submission_id);

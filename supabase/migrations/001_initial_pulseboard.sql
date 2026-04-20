-- Executar no Supabase: SQL Editor (ou desativar read_only no MCP).
-- Depois defina DATABASE_URL ou SUPABASE_DATABASE_URL no Easypanel apontando ao pooler (porta 6543 transaction).

CREATE TABLE IF NOT EXISTS meta_clients (
  id BIGSERIAL PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0,
  client_name TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  group_id TEXT NOT NULL DEFAULT '',
  meta_page_id TEXT NOT NULL DEFAULT '',
  lead_group_id TEXT NOT NULL DEFAULT '',
  lead_phone_number TEXT NOT NULL DEFAULT '',
  lead_template TEXT NOT NULL DEFAULT 'default',
  lead_exclude_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  lead_exclude_contains JSONB NOT NULL DEFAULT '[]'::jsonb,
  lead_exclude_regex JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_clients_page_id ON meta_clients (meta_page_id) WHERE meta_page_id <> '';
CREATE INDEX IF NOT EXISTS idx_meta_clients_enabled ON meta_clients (enabled);

CREATE TABLE IF NOT EXISTS google_clients (
  id BIGSERIAL PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0,
  client_name TEXT NOT NULL,
  google_customer_id TEXT NOT NULL,
  group_id TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  google_template TEXT NOT NULL DEFAULT 'default',
  primary_conversions JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_clients_customer ON google_clients (google_customer_id);

CREATE TABLE IF NOT EXISTS message_templates_doc (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO message_templates_doc (id, body) VALUES (1, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE meta_clients IS 'P12: clientes Meta (relatório + leads)';
COMMENT ON TABLE google_clients IS 'P12: clientes Google Ads';
COMMENT ON TABLE message_templates_doc IS 'Overrides de message_templates.json (canais + opcional filters)';

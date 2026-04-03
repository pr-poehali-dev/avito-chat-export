ALTER TABLE t_p85251297_avito_chat_export.avito_tokens
ADD COLUMN IF NOT EXISTS client_id TEXT,
ADD COLUMN IF NOT EXISTS client_secret TEXT;
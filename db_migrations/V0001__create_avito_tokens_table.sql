CREATE TABLE IF NOT EXISTS t_p85251297_avito_chat_export.avito_tokens (
    id SERIAL PRIMARY KEY,
    access_token TEXT NOT NULL,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Run against the auth_service database (psql -d auth_service -f schema.sql).
\c auth_service

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  sub             TEXT, -- if we want to add google later
  password_hash   TEXT NOT NULL,
  name            TEXT,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  games_played    INT DEFAULT 0,
  games_won       INT DEFAULT 0
);

-- Outstanding "forgot password" links. Only the SHA-256 of the token is kept;
-- the row is deleted when the link is used.
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);

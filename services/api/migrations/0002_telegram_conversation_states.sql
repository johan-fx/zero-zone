CREATE TABLE IF NOT EXISTS telegram_conversation_states (
  state_key TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  step TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telegram_conversation_states_expires_at
  ON telegram_conversation_states (expires_at);

CREATE TABLE IF NOT EXISTS proactive_update_optouts (
  actor_hash TEXT PRIMARY KEY,
  quiet INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

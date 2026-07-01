CREATE TABLE IF NOT EXISTS private_web_links (
  link_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  channel_identity_id TEXT NOT NULL REFERENCES channel_identities(channel_identity_id),
  incident_membership_id TEXT NOT NULL REFERENCES incident_memberships(incident_membership_id),
  scope TEXT NOT NULL CHECK (scope IN ('incident.join', 'work_center.detail', 'family_reunification.search')),
  token_hash TEXT NOT NULL UNIQUE,
  correlation_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  max_uses INTEGER NOT NULL CHECK (max_uses > 0),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_private_web_links_incident_scope_created_at
  ON private_web_links (incident_id, scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_web_links_channel_identity
  ON private_web_links (channel_identity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS private_web_link_attempts (
  attempt_id TEXT PRIMARY KEY,
  link_id TEXT,
  incident_id TEXT,
  scope TEXT,
  correlation_id TEXT,
  fingerprint_hash TEXT NOT NULL,
  token_hash_prefix TEXT,
  result TEXT NOT NULL CHECK (result IN ('accepted', 'rejected')),
  error_code TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_private_web_link_attempts_fingerprint_created_at
  ON private_web_link_attempts (fingerprint_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_web_link_attempts_token_created_at
  ON private_web_link_attempts (token_hash_prefix, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_web_link_attempts_link_created_at
  ON private_web_link_attempts (link_id, created_at DESC);

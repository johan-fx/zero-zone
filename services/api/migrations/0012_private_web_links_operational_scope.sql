CREATE TABLE IF NOT EXISTS private_web_links_scope_migration (
  link_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  channel_identity_id TEXT NOT NULL REFERENCES channel_identities(channel_identity_id),
  incident_membership_id TEXT NOT NULL REFERENCES incident_memberships(incident_membership_id),
  scope TEXT NOT NULL CHECK (scope IN ('incident.join', 'work_center.detail', 'family_reunification.search', 'operational_update.detail')),
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

INSERT INTO private_web_links_scope_migration (
  link_id, incident_id, channel_identity_id, incident_membership_id, scope, token_hash, correlation_id,
  expires_at, consumed_at, max_uses, use_count, created_at, revoked_at, metadata_json
)
SELECT
  link_id, incident_id, channel_identity_id, incident_membership_id, scope, token_hash, correlation_id,
  expires_at, consumed_at, max_uses, use_count, created_at, revoked_at, metadata_json
FROM private_web_links;

DROP TABLE private_web_links;

ALTER TABLE private_web_links_scope_migration RENAME TO private_web_links;

CREATE INDEX IF NOT EXISTS idx_private_web_links_incident_scope_created_at
  ON private_web_links (incident_id, scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_web_links_channel_identity
  ON private_web_links (channel_identity_id, created_at DESC);

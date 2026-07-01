CREATE TABLE IF NOT EXISTS operational_audit_events (
  audit_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('audit', 'sync', 'security', 'rate_limit')),
  result TEXT NOT NULL CHECK (result IN ('accepted', 'rejected', 'bypassed')),
  incident_id TEXT,
  channel TEXT CHECK (channel IN ('telegram', 'mobile', 'web-ui')),
  scope TEXT,
  action TEXT,
  subject_ref_hash TEXT,
  error_code TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operational_audit_events_scope_created_at
  ON operational_audit_events (scope, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_audit_events_incident_created_at
  ON operational_audit_events (incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (scope, key_hash, window_started_at)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_scope_updated_at
  ON rate_limit_buckets (scope, updated_at DESC);

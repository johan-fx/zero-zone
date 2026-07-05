CREATE TABLE IF NOT EXISTS operational_updates (
  update_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  cell_id TEXT NOT NULL,
  update_type TEXT NOT NULL CHECK (update_type IN ('sos_alert', 'resource_need', 'resource_offer', 'trust_signal', 'dispute', 'system_notice')),
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('sos_alert', 'resource_report', 'trust_signal', 'dispute', 'system')),
  source_entity_id TEXT,
  subject_entity_type TEXT CHECK (subject_entity_type IS NULL OR subject_entity_type IN ('channel_identity', 'incident_membership', 'work_center', 'resource_report', 'dispatch_task', 'sos_alert', 'custom')),
  subject_entity_id TEXT,
  subject_display_ref TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  UNIQUE (incident_id, source_kind, source_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_operational_updates_scope_updated_at
  ON operational_updates (incident_id, cell_id, updated_at DESC, update_id DESC);

CREATE INDEX IF NOT EXISTS idx_operational_updates_source
  ON operational_updates (incident_id, source_kind, source_entity_id);

CREATE TABLE IF NOT EXISTS operational_update_audiences (
  audience_id TEXT PRIMARY KEY,
  update_id TEXT NOT NULL REFERENCES operational_updates(update_id),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  cell_id TEXT NOT NULL,
  channel TEXT CHECK (channel IS NULL OR channel IN ('telegram', 'mobile', 'web-ui')),
  role TEXT CHECK (role IS NULL OR role IN ('volunteer', 'coordinator', 'logistics', 'medical')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (update_id, cell_id, channel, role)
);

CREATE INDEX IF NOT EXISTS idx_operational_update_audiences_scope
  ON operational_update_audiences (incident_id, cell_id, channel, role);

CREATE TABLE IF NOT EXISTS operational_update_deliveries (
  delivery_id TEXT PRIMARY KEY,
  update_id TEXT NOT NULL REFERENCES operational_updates(update_id),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'mobile', 'web-ui')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'read', 'acked', 'failed')),
  target_hash TEXT,
  delivered_at TEXT,
  read_at TEXT,
  acked_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (update_id, channel, target_hash)
);

CREATE INDEX IF NOT EXISTS idx_operational_update_deliveries_update
  ON operational_update_deliveries (update_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS operational_update_actions (
  action_id TEXT PRIMARY KEY,
  update_id TEXT NOT NULL REFERENCES operational_updates(update_id),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  action_type TEXT NOT NULL CHECK (action_type IN ('ack', 'read', 'open', 'corroborate', 'dispute', 'link')),
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'mobile', 'web-ui')),
  actor_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (update_id, action_type, channel, actor_hash, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_operational_update_actions_update_created_at
  ON operational_update_actions (update_id, created_at DESC);

CREATE TABLE IF NOT EXISTS operational_update_delivery_attempts (
  attempt_id TEXT PRIMARY KEY,
  delivery_id TEXT REFERENCES operational_update_deliveries(delivery_id),
  update_id TEXT NOT NULL REFERENCES operational_updates(update_id),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'mobile', 'web-ui')),
  result TEXT NOT NULL CHECK (result IN ('accepted', 'rejected')),
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_operational_update_delivery_attempts_update
  ON operational_update_delivery_attempts (update_id, created_at DESC);

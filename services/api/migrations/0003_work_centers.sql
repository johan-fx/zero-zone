CREATE TABLE IF NOT EXISTS sync_operations (
  op_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  op_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected')),
  result_entity_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_operations_incident_created_at
  ON sync_operations (incident_id, created_at);

CREATE TABLE IF NOT EXISTS work_centers (
  work_center_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  cell_id TEXT NOT NULL,
  name TEXT NOT NULL,
  center_type TEXT,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  initial_need TEXT,
  surplus TEXT,
  latitude REAL,
  longitude REAL,
  source_channel TEXT CHECK (source_channel IN ('telegram', 'mobile', 'web-ui')),
  source_operation_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('reported', 'active', 'inactive', 'archived')),
  activation_state TEXT NOT NULL CHECK (activation_state IN ('pending_corroboration', 'active', 'needs_review')),
  freshness TEXT NOT NULL CHECK (freshness IN ('fresh', 'stale', 'expired')),
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  risk TEXT NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
  signal_count INTEGER NOT NULL DEFAULT 0,
  corroborating_signal_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_centers_incident_updated_at
  ON work_centers (incident_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_centers_incident_status
  ON work_centers (incident_id, status);

CREATE TABLE IF NOT EXISTS work_center_signals (
  work_center_signal_id TEXT PRIMARY KEY,
  work_center_id TEXT NOT NULL REFERENCES work_centers(work_center_id),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  signal_type TEXT NOT NULL CHECK (signal_type IN ('creator_report', 'presence_check_in', 'resource_report', 'coordinator_attestation')),
  source_channel TEXT NOT NULL CHECK (source_channel IN ('telegram', 'mobile', 'web-ui')),
  source_id TEXT NOT NULL,
  actor_key_id TEXT,
  operation_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL,
  UNIQUE (work_center_id, signal_type, source_channel, source_id)
);

CREATE INDEX IF NOT EXISTS idx_work_center_signals_work_center_created_at
  ON work_center_signals (work_center_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_work_center_signals_incident_created_at
  ON work_center_signals (incident_id, created_at DESC);

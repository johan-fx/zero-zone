CREATE TABLE IF NOT EXISTS sos_alerts (
  sos_alert_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  cell_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'medical', 'security', 'trapped', 'other')),
  message TEXT,
  latitude REAL,
  longitude REAL,
  accuracy_meters REAL,
  status TEXT NOT NULL CHECK (status IN ('open', 'cancelled')),
  source_channel TEXT CHECK (source_channel IN ('telegram', 'mobile', 'web-ui')),
  source_operation_id TEXT,
  actor_key_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT,
  cancel_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_incident_updated_at
  ON sos_alerts (incident_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_sos_alerts_incident_status
  ON sos_alerts (incident_id, status);

CREATE TABLE IF NOT EXISTS sos_events (
  sos_event_id TEXT PRIMARY KEY,
  sos_alert_id TEXT NOT NULL REFERENCES sos_alerts(sos_alert_id),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  event_type TEXT NOT NULL CHECK (event_type IN ('sos.created', 'sos.cancelled')),
  source_channel TEXT CHECK (source_channel IN ('telegram', 'mobile', 'web-ui')),
  source_operation_id TEXT,
  actor_key_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sos_events_alert_created_at
  ON sos_events (sos_alert_id, created_at DESC);

CREATE TABLE IF NOT EXISTS critical_fanout_jobs (
  fanout_job_id TEXT PRIMARY KEY,
  sos_alert_id TEXT NOT NULL REFERENCES sos_alerts(sos_alert_id),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  event_type TEXT NOT NULL CHECK (event_type IN ('sos.created', 'sos.cancelled')),
  target_channel TEXT NOT NULL CHECK (target_channel IN ('telegram', 'mobile', 'web-ui')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'pending', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_critical_fanout_jobs_alert_status
  ON critical_fanout_jobs (sos_alert_id, status);

CREATE INDEX IF NOT EXISTS idx_critical_fanout_jobs_status_created_at
  ON critical_fanout_jobs (status, created_at);

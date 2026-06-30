CREATE TABLE IF NOT EXISTS resource_reports (
  resource_report_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  cell_id TEXT NOT NULL,
  work_center_id TEXT REFERENCES work_centers(work_center_id),
  category TEXT NOT NULL,
  quantity_approx TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  constraints_json TEXT NOT NULL DEFAULT '[]',
  report_kind TEXT NOT NULL CHECK (report_kind IN ('needed', 'surplus')),
  freshness TEXT NOT NULL CHECK (freshness IN ('fresh', 'stale', 'expired')),
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  risk TEXT NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
  source_channel TEXT CHECK (source_channel IN ('telegram', 'mobile', 'web-ui')),
  source_operation_id TEXT,
  actor_key_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resource_reports_incident_updated_at
  ON resource_reports (incident_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_resource_reports_match
  ON resource_reports (incident_id, cell_id, category, report_kind);

CREATE TABLE IF NOT EXISTS dispatch_tasks (
  dispatch_task_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  cell_id TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity_approx TEXT NOT NULL,
  from_resource_report_id TEXT REFERENCES resource_reports(resource_report_id),
  to_resource_report_id TEXT REFERENCES resource_reports(resource_report_id),
  target_work_center_id TEXT REFERENCES work_centers(work_center_id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'en_route', 'delivered', 'cancelled')),
  notes TEXT,
  source_channel TEXT CHECK (source_channel IN ('telegram', 'mobile', 'web-ui')),
  source_operation_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispatch_tasks_incident_updated_at
  ON dispatch_tasks (incident_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispatch_tasks_status
  ON dispatch_tasks (incident_id, status);

CREATE TABLE IF NOT EXISTS dispatch_events (
  dispatch_event_id TEXT PRIMARY KEY,
  dispatch_task_id TEXT NOT NULL REFERENCES dispatch_tasks(dispatch_task_id),
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'en_route', 'delivered', 'cancelled')),
  notes TEXT,
  source_channel TEXT CHECK (source_channel IN ('telegram', 'mobile', 'web-ui')),
  source_operation_id TEXT,
  actor_key_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dispatch_events_task_created_at
  ON dispatch_events (dispatch_task_id, created_at DESC);

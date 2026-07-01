DROP TABLE IF EXISTS sync_operations_legacy;
ALTER TABLE sync_operations RENAME TO sync_operations_legacy;

CREATE TABLE sync_operations (
  op_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  cell_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  op_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected')),
  result_entity_id TEXT,
  server_version INTEGER,
  server_updated_at TEXT,
  conflict_code TEXT,
  conflict_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO sync_operations (
  op_id, incident_id, cell_id, entity_id, entity_type, op_type, version, payload_hash,
  payload_json, status, result_entity_id, server_version, server_updated_at, conflict_code, conflict_message, created_at
)
SELECT
  op_id,
  incident_id,
  'legacy-cell',
  entity_id,
  entity_type,
  op_type,
  version,
  payload_hash,
  '{}',
  status,
  result_entity_id,
  NULL,
  NULL,
  CASE WHEN status = 'rejected' THEN 'operation_conflict' ELSE NULL END,
  CASE WHEN status = 'rejected' THEN 'legacy rejected operation' ELSE NULL END,
  created_at
FROM sync_operations_legacy;

DROP TABLE sync_operations_legacy;

CREATE INDEX IF NOT EXISTS idx_sync_operations_incident_cell_created_at
  ON sync_operations (incident_id, cell_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sync_operations_conflicts
  ON sync_operations (incident_id, cell_id, status, conflict_code, created_at);

CREATE TABLE IF NOT EXISTS sync_change_log (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id TEXT NOT NULL,
  cell_id TEXT NOT NULL,
  op_id TEXT NOT NULL UNIQUE,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  op_type TEXT NOT NULL,
  operation_json TEXT NOT NULL,
  server_version INTEGER NOT NULL DEFAULT 0,
  server_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_change_log_scope_sequence
  ON sync_change_log (incident_id, cell_id, sequence);

CREATE INDEX IF NOT EXISTS idx_sync_change_log_scope_updated_at
  ON sync_change_log (incident_id, cell_id, server_updated_at);

CREATE TABLE IF NOT EXISTS incidents (
  incident_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'closed')),
  starts_at TEXT NOT NULL,
  location_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS channel_identities (
  channel_identity_id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('telegram', 'mobile', 'web-ui')),
  external_id TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (channel, external_id)
);

CREATE TABLE IF NOT EXISTS incident_memberships (
  incident_membership_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  channel_identity_id TEXT NOT NULL REFERENCES channel_identities(channel_identity_id),
  role TEXT NOT NULL CHECK (role IN ('volunteer', 'coordinator', 'logistics', 'medical')),
  permissions_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (incident_id, channel_identity_id, role)
);

CREATE TABLE IF NOT EXISTS audit_events (
  audit_event_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  channel_identity_id TEXT NOT NULL REFERENCES channel_identities(channel_identity_id),
  incident_membership_id TEXT NOT NULL REFERENCES incident_memberships(incident_membership_id),
  event_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL
);

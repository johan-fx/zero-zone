INSERT INTO incidents (incident_id, name, status, starts_at, location_name)
VALUES ('incident-zc-demo', 'Zona Cero Demo Incident', 'active', '2026-06-30T09:00:00.000Z', 'Operations Base')
ON CONFLICT(incident_id) DO UPDATE SET
  name = excluded.name,
  status = excluded.status,
  starts_at = excluded.starts_at,
  location_name = excluded.location_name;


INSERT INTO channel_identities (channel_identity_id, channel, external_id, display_name)
VALUES ('chid_web-ui_web-user-1001', 'web-ui', 'web-user-1001', 'Field Web')
ON CONFLICT(channel_identity_id) DO UPDATE SET
  channel = excluded.channel,
  external_id = excluded.external_id,
  display_name = excluded.display_name;

INSERT INTO incident_memberships (incident_membership_id, incident_id, channel_identity_id, role, permissions_json)
VALUES (
  'mship_incident-zc-demo_chid_web-ui_web-user-1001_volunteer',
  'incident-zc-demo',
  'chid_web-ui_web-user-1001',
  'volunteer',
  '{"canReadIncident":true,"canJoinIncident":true,"canManageIncident":false,"canManageLogistics":false,"canManageMedical":false}'
)
ON CONFLICT(incident_membership_id) DO UPDATE SET
  incident_id = excluded.incident_id,
  channel_identity_id = excluded.channel_identity_id,
  role = excluded.role,
  permissions_json = excluded.permissions_json;

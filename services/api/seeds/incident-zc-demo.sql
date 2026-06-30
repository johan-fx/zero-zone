INSERT INTO incidents (incident_id, name, status, starts_at, location_name)
VALUES ('incident-zc-demo', 'Zona Cero Demo Incident', 'active', '2026-06-30T09:00:00.000Z', 'Operations Base')
ON CONFLICT(incident_id) DO UPDATE SET
  name = excluded.name,
  status = excluded.status,
  starts_at = excluded.starts_at,
  location_name = excluded.location_name;

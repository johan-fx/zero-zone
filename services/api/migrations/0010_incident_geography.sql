ALTER TABLE incidents ADD COLUMN country_code TEXT CHECK (country_code IS NULL OR length(country_code) = 2);
ALTER TABLE incidents ADD COLUMN country_name TEXT;
ALTER TABLE incidents ADD COLUMN latitude REAL CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
ALTER TABLE incidents ADD COLUMN longitude REAL CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

CREATE INDEX IF NOT EXISTS idx_incidents_country_status
  ON incidents (country_code, status);

CREATE INDEX IF NOT EXISTS idx_incidents_country_starts_at
  ON incidents (country_code, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_country_location
  ON incidents (country_code, latitude, longitude);

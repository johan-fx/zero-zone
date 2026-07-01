ALTER TABLE channel_identities
  ADD COLUMN preferred_locale TEXT CHECK (preferred_locale IS NULL OR preferred_locale IN ('es', 'en'));

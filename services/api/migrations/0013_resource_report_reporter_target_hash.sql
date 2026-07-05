-- Slice 21.1 — almacena el hash de identidad del reportante (hash(channel:externalId)) para
-- poder dirigir operational updates de match oferta↔demanda al demandante/ofertante concreto.
-- Nullable: los reportes materializados por sync mobile (sin externalId) no son direccionables.
ALTER TABLE resource_reports ADD COLUMN reporter_target_hash TEXT;

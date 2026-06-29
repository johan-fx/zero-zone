# Infrastructure

Adapters for local storage, map packs, signed operations, security, sync transport, and native services live here.

Implemented foundations:

- `security/` — signed operation contracts and signer seams.
- `local-db/` — local operation/view repositories and RxDB SQLite storage factory.
- `oplog/` — append-before-materialize outbox and idempotent materializers.
- `maps/` — MapLibre offline pack metadata, lifecycle, and adapter seams.

Backend sync transport, Meshtastic hardware integration, and full operational UI wiring are intentionally outside the Slice A foundation.

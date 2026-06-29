# Proposal: Offline-First Work Center Spike

## Intent

Prove the first work-center slice: real RxDB + SQLite local operations and real MapLibre offline packs, delivered as chained native foundation then operational UI wiring. Backend sync remains deferred.

## Scope

### In Scope
- **Slice A — native/offline foundation:** Expo dev-build config, RxDB SQLite collections/migrations, signed outbox, local materializer, MapLibre plugin/offline pack lifecycle by incident/cell.
- **Slice B — operational flow wiring:** create incident/work center offline, materialize map markers/selected-center panels, show pending/freshness states, and preserve preview surfaces.
- Focused tests for storage, packs, signed ops, and UI contracts.

### Out of Scope
- Backend push/pull transport, Worker/Durable Object APIs, multi-device replication.
- Real Meshtastic hardware; only critical-message placeholders if needed for schema parity.
- Advanced presence, recommendations, logistics, SOS, reunification, media.

## Capabilities

### New Capabilities
- `local-operation-store`: RxDB SQLite collections, migrations, signed outbox, materialization.
- `offline-map-packs`: MapLibre packs by incident/cell with status, cleanup, and offline state.
- `work-center-operational-flow`: Map-first incident/work-center creation, selected-center display, pending sync, and freshness.

### Modified Capabilities
- None; `openspec/specs/` is empty.

## Approach

Deliver chained PRs. Slice A lands dependencies and native/storage seams behind small infrastructure APIs. Slice B consumes them from operations screens, replacing mock data only for this flow.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app.json`, native config | Modified | Dev-build + MapLibre plugin. |
| `package.json`, `metro.config.js` | Modified | RxDB/SQLite/MapLibre setup. |
| `src/infrastructure/{local-db,oplog,maps}` | New | DB, signed ops, packs. |
| `src/features/operations/**`, `src/shared/ui/**` | Modified | Live work-center map and panels. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| MapLibre needs dev builds. | High | Isolate in Slice A. |
| RxDB schema mistakes are sticky. | Med | Small spike DB, migrations, reset path. |
| Offline packs overuse storage. | Med | Cell bounds, progress, cleanup. |
| Scope exceeds budget. | High | Enforce Slice A/B. |

## Rollback Plan

Revert Slice B to mock-data screens. If native/storage fails, revert Slice A deps/config and infra modules; no backend migration exists. A spike DB name allows local reset.

## Dependencies

- Expo dev build/EAS or `expo run:*`; Expo Go will not cover MapLibre.
- `rxdb`, `expo-sqlite`, `@maplibre/maplibre-react-native`, signing helper.
- MapLibre style URL and small test region.

## Success Criteria

- [ ] Device/dev build creates RxDB SQLite DB and signed operations offline.
- [ ] Offline pack downloads, reports status, and renders without network for a test cell.
- [ ] Work center created offline appears as `pending` on map/panel with outbox/freshness state.
- [ ] Slice A/B remain reviewable within the 800-line chained budget.

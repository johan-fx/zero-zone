# Apply Progress: Offline-First Work Center Spike

## Status

- Mode: Strict TDD
- Current work unit: Slice A — native/offline foundation
- PR boundary: PR #1 from `feature/offline-first-work-center-spike-slice-a` into tracker branch `feature/offline-first-work-center-spike`
- Completed assigned tasks: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4
- Remaining tasks: Slice B tasks 3.1 through 4.4 remain untouched.
- Corrective rerun: Slice A gatekeeper gaps closed for RxDB collection creation/repositories, durable signed outbox ordering, MapLibre adapter integration, and repository-seam migration/reset tests.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/infrastructure/security/operation-signer.test.ts` | Unit | N/A (new) | ✅ Written first; initial run failed on missing `./operation-signer` | ✅ Passed in focused Slice A run | ✅ 4 cases: canonical payload, signed operation, unavailable signer, all operation families | ✅ Pure signer seam and deterministic canonical payload |
| 1.2 | `src/infrastructure/local-db/local-db.test.ts` | Unit | N/A (new) | ✅ Written first; initial run failed on missing local-db/security modules | ✅ Passed in focused Slice A run | ✅ 4 cases: schemas, migrations, repositories, incident reset | ✅ Extracted in-memory repository and schema helpers |
| 1.3 | `src/infrastructure/oplog/materializer.test.ts` | Unit | N/A (new) | ✅ Written first; initial run failed on missing materializer/security modules | ✅ Passed in focused Slice A run | ✅ 4 cases: incident/center, duplicate replay, presence, resource/dispatch/SOS placeholders | ✅ Materializer remains pure and idempotent by `opId` |
| 1.4 | `src/infrastructure/maps/offline-map-packs.test.ts` | Unit | N/A (new) | ✅ Written first; initial run failed on missing `./offline-map-packs` | ✅ Passed in focused Slice A run | ✅ 4 cases: metadata/progress, retry, active cleanup warning, map-vs-operations freshness | ✅ Split repository, service, render-state mapper |
| 2.1 | Same Slice A tests plus config validation | Config/unit | N/A (new config) | ✅ RED coverage already referenced missing seams/mocks before deps/config | ✅ `pnpm expo config --type public` shows `expo-sqlite` and `@maplibre/maplibre-react-native`; tests passed | ➖ Structural config task | ✅ Added deps and Jest native mocks without changing Tamagui plugin order |
| 2.2 | Security, local-db, and oplog test files above | Unit | N/A (new) | ✅ RED tests from 1.1-1.3 drove API shape | ✅ Focused Slice A tests passed: 16/16 | ✅ All signed operation families and materialized placeholder families covered | ✅ Local DB and materializer keep pure seams for RxDB/native integration |
| 2.3 | `src/infrastructure/maps/offline-map-packs.test.ts` | Unit | N/A (new) | ✅ RED tests from 1.4 drove map API shape | ✅ Focused Slice A tests passed | ✅ Lifecycle, retry, cleanup warning, render/freshness separation covered | ✅ MapLibre adapter seam isolated from pure pack service |
| 2.4 | All tests and typecheck | Validation | ✅ Existing + new suite green after implementation | ➖ Validation/refactor task; no new behavior beyond tested Slice A contracts | ✅ `pnpm test`: 9 suites / 35 tests passed; `pnpm typecheck`: passed | ➖ Structural validation task | ✅ Fixed TypeScript/RxDB storage API drift and reran tests/typecheck |
| Corrective 1.2/2.2 | `src/infrastructure/local-db/local-db.test.ts` | Unit/repository seam | ✅ Baseline before edits: 4 infra suites / 16 tests passed | ✅ Written first; failed on missing `map_packs`, missing `createRxdbLocalDatabase`, and missing `createRxdbLocalOperationDatabase` | ✅ Focused corrective run passed | ✅ 4 added cases cover RxDB `addCollections`, RxDB-backed `sync_ops`/`incidents`/`work_centers`/`map_packs`, reset, and migration through repository seam | ✅ Kept RxDB imports lazy so Jest does not parse ESM-only RxDB dependencies during unit tests |
| Corrective 2.2 | `src/infrastructure/oplog/outbox-service.test.ts` | Unit/repository seam | N/A (new service) | ✅ Written first; failed on missing `./outbox-service` | ✅ Focused corrective run passed | ✅ 2 cases prove signed append to `sync_ops` happens before materializing views and signing-unavailable blocks all writes | ✅ Service persists materialized views through the `LocalOperationDatabase` seam, not raw arrays |
| Corrective 2.3 | `src/infrastructure/maps/offline-map-packs.test.ts` | Unit/adapter seam | ✅ Baseline before edits: 4 infra suites / 16 tests passed | ✅ Written first; failed on missing native adapter calls/status method | ✅ Focused corrective run passed | ✅ 2 added cases prove `createPack`, `deletePack`, and native status listing integration | ✅ Adapter remains optional so pure metadata tests stay deterministic |

## Tests Run

| Command | Result | Notes |
|---------|--------|-------|
| `pnpm test -- src/infrastructure/security/operation-signer.test.ts src/infrastructure/local-db/local-db.test.ts src/infrastructure/oplog/materializer.test.ts src/infrastructure/maps/offline-map-packs.test.ts --runInBand` | ❌ Expected RED | Failed because production modules did not exist yet. |
| `pnpm test -- src/infrastructure/security/operation-signer.test.ts src/infrastructure/local-db/local-db.test.ts src/infrastructure/oplog/materializer.test.ts src/infrastructure/maps/offline-map-packs.test.ts --runInBand` | ✅ Passed | 4 suites / 16 tests passed after implementation. |
| `pnpm typecheck` | ✅ Passed | First run exposed RxDB SQLite API drift; fixed to `getRxStorageSQLiteTrial` + `getSQLiteBasicsExpoSQLiteAsync`. |
| `pnpm test --runInBand` | ✅ Passed | 9 suites / 35 tests passed. |
| `pnpm test` | ✅ Passed | 9 suites / 35 tests passed. |
| `pnpm expo config --type public` | ✅ Passed | Public Expo config resolves `expo-sqlite` and `@maplibre/maplibre-react-native` plugins. |
| `pnpm test -- src/infrastructure/security/operation-signer.test.ts src/infrastructure/local-db/local-db.test.ts src/infrastructure/oplog/materializer.test.ts src/infrastructure/maps/offline-map-packs.test.ts --runInBand` | ✅ Safety net | Existing Slice A baseline before corrective edits: 4 suites / 16 tests passed. |
| `pnpm test -- src/infrastructure/local-db/local-db.test.ts src/infrastructure/oplog/outbox-service.test.ts src/infrastructure/maps/offline-map-packs.test.ts --runInBand` | ❌ Expected corrective RED | Failed on missing RxDB collection/repository APIs, missing durable outbox service, and missing MapLibre adapter integration. |
| `pnpm test -- src/infrastructure/local-db/local-db.test.ts src/infrastructure/oplog/outbox-service.test.ts src/infrastructure/maps/offline-map-packs.test.ts --runInBand` | ✅ Corrective GREEN | 3 suites / 15 tests passed after implementation. |
| `pnpm typecheck` | ✅ Corrective GREEN | Passed after explicit `local-db/index.ts` exports and lazy RxDB imports. |
| `pnpm test -- src/infrastructure/security/operation-signer.test.ts src/infrastructure/local-db/local-db.test.ts src/infrastructure/oplog/materializer.test.ts src/infrastructure/oplog/outbox-service.test.ts src/infrastructure/maps/offline-map-packs.test.ts --runInBand` | ✅ Corrective focused validation | 5 suites / 23 tests passed. |
| `pnpm test` | ✅ Corrective full validation | 10 suites / 42 tests passed. |
| `pnpm expo config --type public` | ✅ Corrective config smoke | Public Expo config still resolves `expo-sqlite` and `@maplibre/maplibre-react-native` plugins. |

## Implementation Notes

- Added dependencies: `rxdb`, `expo-sqlite`, and `@maplibre/maplibre-react-native`.
- Added Expo config plugins for SQLite and MapLibre.
- Added Jest native mocks for `expo-sqlite` and `@maplibre/maplibre-react-native` while preserving Tamagui setup.
- Implemented a deterministic `OperationSigner` seam, canonical payload builder, fake signer, and signing-unavailable error.
- Implemented local schema/migration/reset contracts and an in-memory repository used by tests until Slice B wires live UI.
- Implemented pure idempotent materialization for incident, work center, presence, resource report, dispatch event, and SOS placeholder views.
- Implemented offline map pack metadata repository/service, lifecycle state transitions, retry, active-pack deletion warning, render-state mapper, and map freshness separation.
- Corrective rerun added real RxDB collection registration via `addCollections` for `sync_ops`, `incidents`, `work_centers`, `map_packs`, and all designed view collections.
- Corrective rerun added an RxDB-backed `LocalOperationDatabase` repository seam plus reset/migration evidence through that seam.
- Corrective rerun added `appendSignedOperationAndMaterialize()` so critical mutations sign first, persist to durable `sync_ops`, then materialize views in order; signing errors block both persistence and materialization.
- Corrective rerun wired `OfflineMapPackService` to the optional MapLibre native adapter for pack creation, native status lookup, and confirmed deletion.

## Deviations

- RxDB v17 exposes `getRxStorageSQLiteTrial` in the installed package instead of the documented `getRxStorageSQLite`; Slice A uses the installed API with Expo SQLite async basics. This should be revisited before production hardening if a non-trial SQLite storage package is selected.
- No real native dev build was executed in this apply phase; `pnpm expo config --type public` is the dev-build smoke note available in this environment. Real device/simulator validation remains for the orchestrator/verify phase.
- Corrective rerun still did not execute a real dev-build/device smoke because this executor has no confirmed booted simulator/device or EAS credentials in the launch context; native validation remains environment-limited and must be performed by verify/orchestrator on a configured dev-build target.
- No commits were created despite task 2.4 mentioning commit units, because the executor launch explicitly reserved commit/push/PR work for the orchestrator.
- `docs/zona_cero_telegram_web_ui_matrix.md` remains unrelated untracked work and was not modified for PR #1.

## Out of Scope Preserved

- No backend sync transport was implemented.
- No real Meshtastic hardware integration was implemented.
- No Slice B operational UI wiring was implemented.
- Resource report, dispatch event, and SOS are schema-compatible outbox/materializer placeholders only.

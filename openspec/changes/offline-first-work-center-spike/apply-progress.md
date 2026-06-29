# Apply Progress: Offline-First Work Center Spike

## Status

- Mode: Strict TDD
- Current work unit: Slice B — operational flow wiring
- PR boundary: PR #5 / Slice B from `feat/offline-first-operational-ui` into parent branch `feat/offline-first-map-packs` (feature-branch-chain)
- Completed assigned tasks: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4
- Remaining tasks: None for the assigned Slice B work-unit; ready for SDD verify/orchestrator review.
- Corrective rerun: Slice A gatekeeper gaps closed for RxDB collection creation/repositories, durable signed outbox ordering, MapLibre adapter integration, and repository-seam migration/reset tests.
- Slice B rerun: live operational entry now creates local incident/work-center operations through the signed outbox/materializer seam, renders pending/offline state, prevents false activation, and preserves mock-backed design-system/visual-audit preview surfaces.

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
| 3.1 | `src/features/operations/liveOperations.test.tsx` | RNTL integration | ✅ Baseline before edits: 8 suites / 36 tests passed | ✅ Written first; failed on missing `./liveOperations` | ✅ Focused Slice B run passed | ✅ 4 cases: prepared incident entry, offline incident creation, offline center creation, false-activation/selected-center fields | ✅ Extracted command/state loaders and kept assertions user-visible |
| 3.2 | `src/app/previewRoutes.test.tsx` | RNTL integration | ✅ Baseline before edits: 8 suites / 36 tests passed | ✅ Written first; failed on missing explicit mock-backed preview labels | ✅ Focused Slice B run passed | ✅ 4 cases: design-system mock label, visual-audit mock fixture, gallery mock data, mockData separation | ✅ Preview route labels make live vs mock separation explicit |
| 4.1 | `src/features/operations/liveOperations.tsx`, materializer/local DB extensions | Integration/unit | ✅ Existing Slice A + preview baseline passed before production edits | ✅ RED coverage from 3.1 referenced missing live commands/screens | ✅ Focused Slice B run passed | ✅ Incident and center creation both append signed pending operations and materialize views; prepared incident reads local map pack state | ✅ `LiveOperationalEntryScreen` uses local DB/outbox seams and MapLibre render-state indicator while preserving preview components |
| 4.2 | `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/visual-audit.tsx`, `src/app/design-system.tsx` | Route integration | ✅ Existing route/preview tests passed before production edits | ✅ RED coverage from 3.2 expected explicit mock-backed route separation | ✅ Focused Slice B run passed | ✅ Home is live operational entry; design-system and visual-audit expose mock-backed labels and content | ✅ Route titles and buttons separate live operational flow from previews/audit |
| 4.3 | `.maestro/ios-smoke.yaml`, `.maestro/ios-visual-audit.yaml`, `dev-build-smoke.md` | E2E smoke/docs | ✅ Config smoke from Slice A passed before edits | ✅ Smoke coverage defined for pending/offline indicators and visual-audit access before native execution | ⚠️ Maestro attempted but device lacked installed `app.zonacero.mobile` dev build | ✅ Smoke flows cover incident pending, center pending, false activation, design preview, and all visual-audit capture targets | ✅ Documented dev-build signing/native checks and environment limitation |
| 4.4 | All Slice B files and OpenSpec artifacts | Refactor/validation | ✅ Focused suite green before final validation | ➖ Validation/refactor task; no new behavior beyond Slice B contracts | ✅ `pnpm test`: 12 suites / 50 tests passed; `pnpm typecheck`: passed | ➖ Structural validation task | ✅ No commits created per executor instructions; out-of-scope items preserved |

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
| `pnpm test -- src/features/operations/liveOperations.test.tsx src/app/previewRoutes.test.tsx --runInBand` | ❌ Expected Slice B RED | Failed on missing `./liveOperations` and missing explicit mock-backed preview labels. |
| `pnpm test -- src/features/operations/liveOperations.test.tsx src/app/previewRoutes.test.tsx --runInBand` | ✅ Slice B GREEN | 2 suites / 8 tests passed after live route and preview-preservation implementation. |
| `pnpm test -- src/features/operations/liveOperations.test.tsx src/app/previewRoutes.test.tsx src/features/operations/visualAudit.test.tsx src/shared/ui/operational.test.tsx src/shared/ui/operational-patterns.test.tsx src/infrastructure/oplog/materializer.test.ts src/infrastructure/oplog/outbox-service.test.ts src/infrastructure/local-db/local-db.test.ts --runInBand` | ✅ Focused regression | 8 suites / 34 tests passed. |
| `pnpm typecheck` | ✅ Slice B validation | Passed. |
| `pnpm test` | ✅ Slice B full validation | 12 suites / 50 tests passed. |
| `pnpm expo config --type public` | ✅ Slice B config smoke | Public Expo config still resolves app id, SQLite, and MapLibre plugin. |
| `pnpm maestro:smoke:ios` | ⚠️ Environment-limited | Maestro 2.6.1 found simulator, but failed because `app.zonacero.mobile` dev build is not installed (`Failed to get app binary directory for bundle app.zonacero.mobile`). |

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
- Slice B added `LiveOperationalEntryScreen` plus `createOfflineIncident`, `createOfflineWorkCenter`, and `loadLiveOperationalState` so the home route can create/read incident-scoped pending local state through the Slice A outbox/database seams.
- Work center materialized views now preserve minimal selected-center fields needed for the live panel: type, description, priority, initial need, confidence, risk, surplus, role count, activation state, and approximate location.
- Home (`/`) is now the live operational entry; `design-system` and `visual-audit` remain explicitly mock-backed preview/audit routes.
- Maestro smoke coverage now targets the dev-build bundle id `app.zonacero.mobile` and covers pending/offline indicators plus preserved visual-audit access.

## Deviations

- RxDB v17 exposes `getRxStorageSQLiteTrial` in the installed package instead of the documented `getRxStorageSQLite`; Slice A uses the installed API with Expo SQLite async basics. This should be revisited before production hardening if a non-trial SQLite storage package is selected.
- No real native dev build was executed in this apply phase; `pnpm expo config --type public` is the dev-build smoke note available in this environment. Real device/simulator validation remains for the orchestrator/verify phase.
- Corrective rerun still did not execute a real dev-build/device smoke because this executor has no confirmed booted simulator/device or EAS credentials in the launch context; native validation remains environment-limited and must be performed by verify/orchestrator on a configured dev-build target.
- No commits were created despite task 2.4 mentioning commit units, because the executor launch explicitly reserved commit/push/PR work for the orchestrator.
- `docs/zona_cero_telegram_web_ui_matrix.md` remains unrelated untracked work and was not modified for PR #1.
- Slice B does not execute a real native dev-build smoke in this environment because the simulator does not have the `app.zonacero.mobile` dev build installed; the Maestro failure is environment/setup, not a Jest/typecheck failure.
- `MapLibreOperationalMap` is represented by a live MapLibre state surface/testID and render-state indicator in JS; real native MapLibre rendering still requires the documented dev-build smoke.

## Out of Scope Preserved

- No backend sync transport was implemented.
- No real Meshtastic hardware integration was implemented.
- Resource report, dispatch event, and SOS remain schema-compatible outbox/materializer placeholders only.
- Recommendations, logistics, SOS full UI, reunification, backend sync, and real Meshtastic hardware remain out of scope for Slice B.

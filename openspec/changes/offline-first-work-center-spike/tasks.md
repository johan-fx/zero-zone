# Tasks: Offline-First Work Center Spike

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900-1400 across config, storage, maps, UI |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Gate → Slice A PR → Slice B PR |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| Gate | Approved feature issue | pre-apply | Search duplicates, create issue, add/verify `status:approved`, link all PRs. |
| A | Native/offline foundation | PR 1 | Commits: config, DB/outbox, MapLibre; dev-build validation included. |
| B | Operational flow wiring | PR 2 | Depends on PR 1; keep UI, tests, docs with behavior. |

## Phase 0: Pre-Apply Issue Gate

- [x] 0.1 Search duplicate GitHub issues, create a feature issue, and verify `status:approved` before coding. Issue: https://github.com/johan-fx/zero-zone/issues/1
- [x] 0.2 Record the issue number in Slice A/B notes and require every PR body to close/link it. Issue: #1; chain strategy: feature-branch-chain.

## Phase 1: Slice A RED — Foundation Contracts

- [x] 1.1 RED: add failing Jest tests for `src/infrastructure/security/**` covering `OperationSigner`, canonical payloads, signing-unavailable blocking, and all operation families.
- [x] 1.2 RED: add failing tests for `src/infrastructure/local-db/**` schemas, migrations, reset, and `sync_ops`/view collections.
- [x] 1.3 RED: add failing tests for `src/infrastructure/oplog/**` idempotent materialization of incident, center, presence, resource report, dispatch event, and SOS placeholders.
- [x] 1.4 RED: add failing tests for `src/infrastructure/maps/**` pack metadata, lifecycle states, cleanup protection, and map-vs-operations freshness separation.

## Phase 2: Slice A GREEN/REFACTOR — Native Offline Foundation

- [x] 2.1 Add deps/config in `package.json`, `pnpm-lock.yaml`, `app.json`, `metro.config.js`, `babel.config.js`, `jest.config.js`, and `jest.setup.ts` for RxDB SQLite, MapLibre, signing mocks, and Tamagui compatibility.
- [x] 2.2 Implement `src/infrastructure/local-db/**`, `src/infrastructure/security/**`, and `src/infrastructure/oplog/**` so signed operations materialize pending views idempotently.
- [x] 2.3 Implement `src/infrastructure/maps/**` with MapLibre seams, pack metadata repository, render-state mapper, retry, and deletion warning.
- [x] 2.4 REFACTOR and commit Slice A units: config, local store/outbox, map packs; validate `pnpm test`, `pnpm typecheck`, and dev-build smoke for MapLibre/RxDB/signing.

Corrective Slice A rerun note: RxDB `addCollections`/repository coverage, durable signed outbox ordering, MapLibre native adapter calls, repository-seam reset/migration tests, `pnpm test`, `pnpm typecheck`, and Expo config smoke are recorded in `apply-progress.md`. Real dev-build smoke remains environment-limited.

## Phase 3: Slice B RED — Operational UI Contracts

- [ ] 3.1 RED: add RNTL tests for `src/features/operations/**` incident entry, offline incident/center creation, pending state, false-activation prevention, and selected-center fields.
- [ ] 3.2 RED: add tests proving `src/app/design-system.tsx`, `src/app/visual-audit.tsx`, preview components, and `src/features/operations/mockData.ts` remain mock-backed.

## Phase 4: Slice B GREEN/REFACTOR — Live Operational Wiring

- [ ] 4.1 Wire `src/features/operations/**` hooks/commands/screens to local DB/outbox and MapLibre state while keeping previews stable.
- [ ] 4.2 Update `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/visual-audit.tsx`, and `src/app/design-system.tsx` to separate live operational entry from preview/audit routes.
- [ ] 4.3 Add Maestro/dev-build smoke coverage for pending/offline indicators and preserved visual-audit access; document device signing/native checks.
- [ ] 4.4 REFACTOR and commit Slice B as UI flow, preview preservation, and E2E/docs work units; keep backend sync, real Meshtastic hardware, recommendations, logistics, SOS full UI, and reunification out of scope.

# Design: Offline-First Work Center Spike

## Technical Approach

Deliver two chained slices. Slice A proves Expo SDK 56 dev-build compatibility for RxDB over `expo-sqlite`, signed append-only operations, local materialization, and MapLibre offline packs. Slice B wires the current operations gallery into live local incident/work-center state while keeping `design-system` and `visual-audit` mock-backed.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Review slicing | Slice A foundation, Slice B UI wiring | One PR | Native config, DB, map, and UI together exceed safe review scope. |
| Local store | RxDB collections on `expo-sqlite`, `multiInstance: false` | AsyncStorage, hand SQL repos | Specs require durable reactive local views and versioned schemas. |
| Mutation path | `createSignedOperation()` writes `sync_ops`, then materializer updates views | Direct entity writes | The auditable outbox is the source of truth for critical mutations. |
| Signing seam | `OperationSigner` interface + fake signer tests + SDK 56 compatibility spike before implementation | Hard-code one crypto library | Tasks must first validate the signing helper works in Expo SDK 56/Hermes/dev builds. |
| Map path | MapLibre adapter for live route, `MapShell` remains preview-only | Keep `MapShell` as map implementation | Specs require real offline packs and render states, not decorative mock maps. |

## Data Flow

```text
Signed mutation -> outbox -> materializer
UI command
  -> createSignedOperation(input, signer, clock, device)
  -> signer.sign(canonicalPayload)  [block on unavailable key]
  -> sync_ops RxDB insert, syncState=pending
  -> materializer replay by opId/hlc
  -> incidents/work_centers/presence/resource_reports/dispatch_events/sos/local_summary
  -> operations hooks -> MapLibre markers, panels, outbox/freshness badges

Map pack -> rendering state
Prepare cell -> maps service -> MapLibre offline pack download/status
  -> map_packs metadata (incidentId, cellId, bounds, state, progress, age)
  -> render adapter selects online/offline/partial/missing coverage
  -> map screen shows map coverage separately from operational freshness
```

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `pnpm-lock.yaml` | Modify | Add RxDB, `expo-sqlite`, MapLibre, signing helper after compatibility check, test support. |
| `app.json`, `metro.config.js`, `babel.config.js`, `jest.config.js`, `jest.setup.ts` | Modify | Dev-build/native plugin config and Jest mocks while preserving Tamagui. |
| `src/infrastructure/local-db/**` | Create | RxDB database, schemas, migrations, reset path, collection factories. |
| `src/infrastructure/oplog/**` | Create | Signed operation builder, outbox repository, idempotency/materializer helpers. |
| `src/infrastructure/security/**` | Create | `OperationSigner`, actor key access seam, fake signer. |
| `src/infrastructure/maps/**` | Create | MapLibre adapter, pack service, metadata repository, render-state mapper. |
| `src/features/operations/**` | Modify/Create | Live hooks/commands/screens; retain `mockData.ts` for previews only. |
| `src/app/_layout.tsx`, `src/app/index.tsx`, `src/app/visual-audit.tsx`, `src/app/design-system.tsx` | Modify | Separate live operational entry from preview/audit surfaces. |

## Interfaces / Contracts

```ts
type SyncState = 'pending' | 'sent' | 'confirmed' | 'conflict' | 'rejected';
type OperationFamily = 'incident' | 'work_center' | 'presence' | 'resource_report' | 'dispatch_event' | 'sos';
type OperationType =
  | 'incident.create'
  | 'work_center.create'
  | 'presence.check_in' | 'presence.pause' | 'presence.check_out'
  | 'resource_report.create'
  | 'dispatch_event.create' | 'dispatch_event.update'
  | 'sos.create' | 'sos.cancel';

type OperationSigner = { sign(input: { canonicalPayload: string; actorKeyId: string }): Promise<string> };
type SignedOperation = {
  opId: string; version: 1; actorKeyId: string; deviceId: string;
  incidentId: string; cellId: string; entityType: OperationFamily; entityId: string;
  opType: OperationType; payload: unknown; hlc: string; createdAtDevice: string;
  signature: string; syncState: SyncState;
};
```

`resource_report`, `dispatch_event`, and `sos` are schema-compatible outbox/materializer contracts in this change. Their full UI/business flows remain out of scope except existing preview screens and minimal placeholder commands needed to prove signing, idempotency, and materialization shape.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Schemas, signer seam, canonical payload, all `OperationType` families, idempotent materialization, pack-state mapper | Strict TDD with fake signer/clock/device and native mocks. |
| Integration | RxDB SQLite writes, outbox-to-materialized work center, map pack metadata, operations hooks | Jest/RNTL with mocked native modules; dev-build smoke notes for real native behavior. |
| E2E/Visual | Preview routes stay mock-backed; live route shows pending/offline states | Maestro visual-audit remains stable; add dev-build smoke when available. |

## Migration / Rollout

No production migration required. Use a spike DB name/version and explicit local reset. Slice A lands dependencies/config/infrastructure; Slice B consumes contracts in operations UI. Expo Go is insufficient for MapLibre/signing validation; use dev builds.

## Open Questions

- [ ] Which MapLibre style URL and small test cell bounds should seed the first pack?
- [ ] Which signing helper passes Expo SDK 56/Hermes/dev-build compatibility?
- [ ] Should the live route replace `/` immediately or remain behind a separate route until accepted?

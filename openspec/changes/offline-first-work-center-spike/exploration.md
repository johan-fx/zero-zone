## Exploration: offline-first work center spike

### Current State
- The app is still boilerplate-plus-preview: `src/features/operations/*` renders static operational mock screens, and `src/app/*` only exposes home, design-system, and visual-audit routes.
- There is no real persistence/sync layer yet: `README.md` and `src/infrastructure/README.md` explicitly state RxDB, SQLite, signed outbox, sync, MapLibre, and Meshtastic are not implemented.
- `package.json` does not include `rxdb`, `expo-sqlite`, or `@maplibre/maplibre-react-native`; `app.json` only has Expo Router + splash-screen plugins.
- The docs already lock in the target architecture: local-first per incident/cell, signed operations, RxDB + SQLite, MapLibre offline packs, and append-only `sync_ops` materialized into local views.
- Existing tests only cover static visual contracts and theme/design-system behavior; they do not cover persistence, native map, or sync flows.

### Affected Areas
- `app.json`, `metro.config.js`, `package.json` — native plugin/dependency setup for RxDB and MapLibre dev-build support.
- `src/infrastructure/local-db`, `src/infrastructure/oplog`, `src/infrastructure/sync`, `src/infrastructure/maps`, `src/infrastructure/security` — future home for the local database, signed outbox, sync transport, offline packs, and key material.
- `src/features/operations/screens.tsx`, `src/features/operations/mockData.ts`, `src/shared/ui/operational*.tsx` — current static screens/components that would be replaced or wired to live data.
- `src/app/index.tsx`, `src/app/design-system.tsx`, `src/app/visual-audit.tsx` — preview routes that will need to coexist with or be adapted to the real flow.
- `.maestro/*.yaml`, `src/features/operations/*.test.tsx`, `src/shared/ui/*.test.tsx` — test surfaces that will need dev-build-aware coverage.
- `docs/zona_cero_prd_funcional.md`, `docs/zona_cero_technical_design.md`, `docs/zona_cero_screen_design.md` — source-of-truth requirements and screen intent.

### Approaches
1. **Single monster slice** — land RxDB, SQLite, signed outbox, local materialization, and real MapLibre offline all in one change.
   - Pros: one end-to-end proof, no artificial pause between infra and UX.
   - Cons: native config + data layer + UI + tests in one PR; very likely to exceed review budget and make rollback painful.
   - Effort: High

2. **Chained foundation + vertical slice** — split into two reviewable slices.
   - Slice A: Expo dev-build/native foundation, RxDB + SQLite storage, signed outbox/materializer, MapLibre plugin/offline pack bootstrap, and a minimal live data model.
   - Slice B: incident/work-center UI wiring, pending sync state, selected-center/map integration, and operational screen replacement for the static mock data.
   - Pros: keeps each PR understandable, isolates native-module failure modes, fits the 800-line review budget better.
   - Cons: requires disciplined handoff and temporary overlap with existing preview screens.
   - Effort: Medium/High

3. **UI-first with stubbed offline plumbing** — keep the current fake map and only wire the visible flow.
   - Pros: quick UX demonstration.
   - Cons: does not satisfy the request for full RxDB and real MapLibre offline immediately.
   - Effort: Medium

### Recommendation
Use the chained foundation + vertical slice approach. The smallest safe path that still honors the request is to make the first slice prove the native stack (RxDB + SQLite + MapLibre offline) and the second slice prove the operational flow (create incident/work center -> signed op/outbox -> local materialization -> map/panel/pending sync). This avoids turning the first PR into a cross-cutting native migration.

Concrete split:
- **Slice A**: app config/deps, RxDB local DB, signed outbox, local materializer, MapLibre plugin + offline pack scaffolding, and one minimal live incident/work-center model.
- **Slice B**: wire the existing operational screens/components to live collections and sync state, replace static map shell usage, and add focused tests.

### Risks
- Expo Go will no longer be enough: MapLibre needs a dev build/native plugin, so the current Maestro smoke flow (`host.exp.Exponent`) must be revisited.
- RxDB on Expo needs the SQLite adapter and a clear `multiInstance: false` choice; storage/migration mistakes can be hard to unwind.
- Real offline packs add native API surface and cache cleanup concerns; pack boundaries must match incident/cell scope.
- The current UI is mostly static preview code, so replacing it with live data may break existing visual-audit assumptions and snapshots.
- If the first slice also tries to include full sync transport/backend semantics, the change will likely blow past the review budget.

### Ready for Proposal
Yes — but only as a chained proposal. The proposal should explicitly name Slice A and Slice B, call out the dev-build requirement, and keep the first slice narrow enough to prove the offline stack without absorbing the whole product.

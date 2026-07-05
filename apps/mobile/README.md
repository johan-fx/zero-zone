# Mobile app workspace

Expo React Native app for offline-first field operations. It owns native runtime behavior: local operational data, outbox-first sync, MapLibre offline map support, and device-facing operational UI.

## Ownership boundary

| Area | Mobile owns | Mobile must not own |
|---|---|---|
| Runtime | Expo Router, React Native screens, native services, local persistence, offline map packs | API authorization, Telegram conversation state, staging deploys |
| UX | Field operator flows that must work offline or on device sensors | Public web-only flows and private web-link flows |
| Shared contracts | Consumes `@zona-cero/contracts` and `@zona-cero/ui` | Redefining API schemas or design tokens locally |
| Data | Local repositories, materialized views, append-before-materialize outbox | Server truth, D1 migrations, webhook persistence |

## Commands

Run from the repository root unless a workspace command is explicitly needed.

| Task | Root command | Workspace command |
|---|---|---|
| Start Expo | `pnpm mobile:start` | `pnpm --filter @zona-cero/mobile start` |
| Open iOS | `pnpm mobile:ios` | `pnpm --filter @zona-cero/mobile ios` |
| Open Android | `pnpm mobile:android` | `pnpm --filter @zona-cero/mobile android` |
| Run iOS native build | `pnpm run:ios` | `pnpm --filter @zona-cero/mobile run:ios` |
| Run Android native build | `pnpm run:android` | `pnpm --filter @zona-cero/mobile run:android` |
| Start web target | `pnpm mobile:web` | `pnpm --filter @zona-cero/mobile web` |
| Headless iOS agent | `pnpm ios:agent` | `pnpm --filter @zona-cero/mobile ios:agent` |

## Tests and verification

| Check | Command | When to run |
|---|---|---|
| Typecheck | `pnpm mobile:typecheck` | Any TypeScript or contract consumption change |
| Jest CI | `pnpm mobile:test` | App logic, hooks, adapters, or screen behavior changes |
| Strict mobile check | `pnpm mobile:test:strict` | Before handing off mobile changes |
| Maestro smoke | `pnpm maestro:smoke:ios` | Native operational flow changes |
| Visual audit access | `pnpm visual:audit:check` | Design-system or visual-audit route changes |

## Consumers

- Field operators using the native app.
- `@zona-cero/contracts` for shared schemas and operation vocabulary.
- `@zona-cero/ui` for operational tokens shared with web.
- `@zona-cero/testing` for deterministic fixtures.

## Change rules

- Keep offline-first behavior explicit: append operations before materializing views.
- Do not duplicate server authorization or Telegram flow rules in mobile.
- Route shared schema changes through `packages/contracts` first, then update mobile tests.
- Keep reusable native boundaries under `src/domain`, `src/features`, and `src/infrastructure`; avoid one-off cross-layer imports.
- Never commit Simulator screenshots or generated visual artifacts from `/output`.

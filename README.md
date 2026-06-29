# Zona Cero

Monorepo for the Zona Cero emergency coordination system.

## Current workspaces

- `apps/mobile` — Expo + React Native app foundations.
- `apps/web-ui` — reserved workspace for secure web links and lightweight panels.
- `apps/telegram-channel` — reserved workspace for Telegram flows and adapters.
- `services/api` — reserved workspace for the Cloudflare Workers API and Telegram webhook runtime.
- `packages/*` — reserved shared packages for domain, contracts, crypto, UI, config, and testing.

## Mobile stack

- Expo SDK 56
- React Native 0.85
- TypeScript
- Expo Router
- Tamagui
- RxDB + Expo SQLite trial storage seam
- Signed local operation outbox
- MapLibre offline pack seam
- pnpm workspaces

## Commands

Run these from the repository root:

```bash
pnpm install
pnpm mobile:start
pnpm mobile:ios
pnpm mobile:android
pnpm mobile:web
pnpm mobile:typecheck
pnpm mobile:test
pnpm test:strict
```

Root shortcuts such as `pnpm start`, `pnpm ios`, `pnpm web`, `pnpm typecheck`, and `pnpm test:strict` currently delegate to `@zona-cero/mobile`.

## Scope

The current mobile app includes the offline-first work-center spike foundations: Tamagui UI, a signed local operation outbox, RxDB/Expo SQLite local-store seams, MapLibre offline-pack seams, and a live operational spike route. Backend sync, real Meshtastic hardware, recommendations/logistics, full SOS UI, and reunification remain out of scope.

The current mobile home route is explicitly a spike/dev entry backed by an in-memory local database. Durable RxDB-backed production routing remains blocked until the RxDB SQLite `getRxStorageSQLiteTrial` dependency is replaced or accepted as a production risk.

## Strict TDD loop

Use Jest + jest-expo + React Native Testing Library for fast unit and component tests. Do not bypass failing tests with `--passWithNoTests`; the default scripts fail when the suite is missing or broken.

```bash
pnpm test:tdd      # watch changed tests during TDD, delegated to mobile
pnpm test          # run the unit/component suite, delegated to mobile
pnpm test:ci       # deterministic CI run, delegated to mobile
pnpm test:strict   # typecheck + deterministic tests, delegated to mobile
```

## Smoke tests

Smoke flows target the iOS development build (`app.zonacero.mobile`) because MapLibre and SQLite native modules are not available in Expo Go.

```bash
pnpm maestro:smoke:ios
pnpm maestro:offline-spike:ios
pnpm visual:audit:check
```

The iOS smoke flow verifies the live offline-first spike, mock-backed design-system/visual-audit routes, and deterministic operational E2E scenarios.

Install Maestro locally before running the flow:

```bash
brew tap mobile-dev-inc/tap
brew trust --formula mobile-dev-inc/tap/maestro
brew install mobile-dev-inc/tap/maestro
```

For agent-driven validation from Codex, use the headless Expo start script to avoid launching the React Native DevTools Electron app from the Codex process:

```bash
pnpm ios:agent
pnpm maestro:smoke:ios
```

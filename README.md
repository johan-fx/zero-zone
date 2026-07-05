# Zona Cero

Zona Cero is a pnpm monorepo for emergency coordination across mobile, web, Telegram, Cloudflare Workers, and shared domain packages.

## Quick start

```bash
pnpm install
pnpm api:migrate:local
pnpm api:seed:local
pnpm api:dev
pnpm web:dev
pnpm mobile:start
```

Use three terminals for `api:dev`, `web:dev`, and `mobile:start`. For the full local path, see [Local development runbook](docs/runbooks/local-development.md).

## Workspace map

| Workspace | Purpose | Start here |
|---|---|---|
| `apps/mobile` | Expo React Native app with offline-first work-center foundations. | [apps/mobile/README.md](apps/mobile/README.md) |
| `apps/web-ui` | Vite/React web UI for secure links and operational panels. | [apps/web-ui/README.md](apps/web-ui/README.md) |
| `apps/telegram-channel` | Telegram bot flows, rendering, and channel adapters. | [apps/telegram-channel/README.md](apps/telegram-channel/README.md) |
| `services/api` | Cloudflare Workers API, Telegram webhook, sync, authorization, audit, and D1 integration. | [services/api/README.md](services/api/README.md) |
| `packages/contracts` | Shared API and operation schemas. | [packages/contracts/README.md](packages/contracts/README.md) |
| `packages/domain` | Pure domain policies and entities. | [packages/domain/README.md](packages/domain/README.md) |
| `packages/crypto` | Signing and canonical payload helpers. | [packages/crypto/README.md](packages/crypto/README.md) |
| `packages/ui` | Shared design tokens and lightweight React DOM primitives. | [packages/ui/README.md](packages/ui/README.md) |
| `packages/config` | Shared TypeScript/Vitest presets. | [packages/config/README.md](packages/config/README.md) |
| `packages/testing` | Cross-workspace fixtures and test helpers. | [packages/testing/README.md](packages/testing/README.md) |
| `packages/i18n` | Shared localization messages and formatting. | [packages/i18n/README.md](packages/i18n/README.md) |

Indexes:

- [apps/README.md](apps/README.md) — application routing guide.
- [services/README.md](services/README.md) — service routing guide.
- [packages/README.md](packages/README.md) — shared package routing guide.

## Command matrix

Run these from the repository root.

| Need | Command | Delegates to / notes |
|---|---|---|
| Install dependencies | `pnpm install` | Uses `pnpm@11.7.0`. |
| Mobile dev server | `pnpm mobile:start` | `@zona-cero/mobile start` / Expo. |
| Mobile iOS | `pnpm mobile:ios` | Expo iOS launcher. |
| Mobile Android | `pnpm mobile:android` | Expo Android launcher. |
| Mobile web | `pnpm mobile:web` | Expo web launcher. |
| API dev server | `pnpm api:dev` | `@zona-cero/api dev` / Wrangler on port `8787`. |
| Web UI dev server | `pnpm web:dev` | `@zona-cero/web-ui dev` on `127.0.0.1:5173`. |
| Local API migration | `pnpm api:migrate:local` | Applies D1 migrations locally. |
| Local API seed | `pnpm api:seed:local` | Seeds demo incident data locally. |
| Unit/component tests | `pnpm test` | Mobile Jest suite. |
| Strict tests | `pnpm test:strict` | Mobile strict tests + workspace strict tests + integration tests. |
| Workspace tests | `pnpm test:workspaces` | API, Web UI, Telegram, and packages. |
| Integration tests | `pnpm test:integration` | API, Web UI, and Telegram integration tests. |
| Playwright E2E | `pnpm e2e` | Root Playwright test suite. |
| Playwright UI | `pnpm e2e:ui` | Interactive Playwright runner. |
| iOS smoke | `pnpm maestro:smoke:ios` | Maestro smoke flow. |
| Web staging build | `pnpm web:build:staging` | Builds `apps/web-ui/dist` with staging env defaults. |
| API staging deploy | `pnpm api:deploy:staging` | Wrangler deploy for API staging. |
| Web staging deploy | `pnpm web:deploy:staging` | Builds and uploads Pages staging artifact. |
| Telegram E2E auth | `pnpm e2e:telegram:auth` | Creates/refreshes local GramJS session. |
| Telegram E2E dry run | `pnpm e2e:telegram:dry-run` | Prints planned staging messages without contacting Telegram. |
| Telegram staging E2E | `pnpm e2e:staging:telegram` | Opt-in real staging Telegram flow. |

## Runbooks

- [Local development](docs/runbooks/local-development.md) — prerequisites, install, local app/service starts, migrations, seeding, and verification.
- [Cloudflare staging](docs/runbooks/cloudflare-staging.md) — Cloudflare staging deployment and smoke checklist.
- [Real staging Telegram E2E](e2e/README.md) — Telegram test account flow and sensitive test handling.

## Current implementation notes

- Mobile includes the offline-first work-center spike foundations: Tamagui UI, signed local operation outbox, RxDB/Expo SQLite local-store seams, MapLibre offline-pack seams, and a live operational spike route.
- API, Web UI, Telegram channel, and shared packages are active workspaces rather than future-only slots.
- The current mobile home route remains a spike/dev entry backed by an in-memory local database. Durable RxDB-backed production routing depends on accepting or replacing the RxDB SQLite trial storage seam.

## Testing discipline

Use the strict scripts before release or cross-workspace changes. Do not bypass failing suites with `--passWithNoTests`; the project expects missing or broken suites to fail.

```bash
pnpm test:tdd
pnpm test
pnpm test:ci
pnpm test:strict
```

For iOS smoke validation, install Maestro locally and use the development build target (`app.zonacero.mobile`):

```bash
brew tap mobile-dev-inc/tap
brew trust --formula mobile-dev-inc/tap/maestro
brew install mobile-dev-inc/tap/maestro

pnpm ios:agent
pnpm maestro:smoke:ios
```

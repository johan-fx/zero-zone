# Local development runbook

Use this runbook to start the local Zona Cero stack from a fresh checkout and verify the main developer paths.

## Prerequisites

- Node.js compatible with the repository toolchain.
- `pnpm@11.7.0`.
- Cloudflare Wrangler through the `@zona-cero/api` workspace dependency.
- Expo tooling through the `@zona-cero/mobile` workspace dependency.
- Optional for native smoke tests: Xcode/iOS Simulator, Android tooling, and Maestro.

Do not create or edit committed secret files. Local Telegram E2E secrets belong in the untracked file documented by [e2e/README.md](../../e2e/README.md).

## Install

From the repository root:

```bash
pnpm install
```

## Prepare local data

Apply local D1 migrations, then seed the demo incident data:

```bash
pnpm api:migrate:local
pnpm api:seed:local
```

These commands delegate to `@zona-cero/api` and target the local Wrangler/D1 environment.

## Start the local API

Terminal 1:

```bash
pnpm api:dev
```

Expected local API base URL:

```text
http://127.0.0.1:8787
```

## Start the Web UI

Terminal 2:

```bash
pnpm web:dev
```

Expected local Web UI URL:

```text
http://127.0.0.1:5173
```

The Web UI package also supports:

```bash
pnpm web:build
pnpm web:test
pnpm web:test:strict
```

## Start Mobile

Terminal 3:

```bash
pnpm mobile:start
```

Useful mobile targets:

```bash
pnpm mobile:ios
pnpm mobile:android
pnpm mobile:web
```

For agent-driven iOS validation, use the headless launcher before Maestro:

```bash
pnpm ios:agent
pnpm maestro:smoke:ios
```

## Verify the workspace

Run the fastest relevant check while developing, then run the full strict gate before handing off broad changes.

| Scope | Command |
|---|---|
| Mobile TDD loop | `pnpm test:tdd` |
| Mobile unit/component suite | `pnpm test` |
| Mobile CI suite | `pnpm test:ci` |
| API tests | `pnpm api:test` |
| Web UI tests | `pnpm web:test` |
| Telegram tests | `pnpm telegram:test` |
| Contracts tests | `pnpm contracts:test` |
| Package strict tests | `pnpm test:packages` |
| Workspace strict tests | `pnpm test:workspaces` |
| Integration tests | `pnpm test:integration` |
| Full strict gate | `pnpm test:strict` |

## Local E2E

General Playwright entry points:

```bash
pnpm e2e
pnpm e2e:ui
```

The local operational map E2E expects local API and Web UI servers:

```bash
pnpm exec playwright test e2e/operational-map.spec.ts
```

See [e2e/README.md](../../e2e/README.md) for staging Telegram E2E, dry runs, and secret handling.

## Staging is separate

Use staging scripts only when intentionally touching Cloudflare staging:

```bash
pnpm api:migrate:staging
pnpm api:seed:staging
pnpm api:deploy:staging
pnpm web:deploy:staging
```

Follow the [Cloudflare staging runbook](cloudflare-staging.md) before running those commands.

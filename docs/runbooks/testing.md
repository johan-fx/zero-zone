# Testing runbook

Use the smallest test that proves the change, then run the broader gate before review. Fast feedback first; full confidence before handoff.

## Quick path

```bash
pnpm test:strict
pnpm e2e:telegram:typecheck
pnpm e2e:telegram:dry-run
```

For mobile UI smoke:

```bash
pnpm maestro:smoke:ios
```

## Which test should I run?

| Change area | First test | Broader gate |
| --- | --- | --- |
| Mobile app logic | `pnpm mobile:test` | `pnpm mobile:test:strict` |
| Mobile native smoke | `pnpm maestro:smoke:ios` | Add visual or focused Maestro flows when UI risk is high. |
| API Worker | `pnpm api:test` | `pnpm api:test:strict` and `pnpm test:integration` when contracts or persistence are touched. |
| Web UI | `pnpm web:test` | `pnpm web:test:strict` and `pnpm e2e` for browser/API behavior. |
| Telegram handlers | `pnpm telegram:test` | `pnpm telegram:test:strict` plus Telegram dry-run or staging E2E when flows change. |
| Shared contracts | `pnpm contracts:test` | `pnpm contracts:test:strict` and affected workspace strict tests. |
| Cross-workspace behavior | Targeted workspace tests | `pnpm test:workspaces` then `pnpm test:strict`. |
| Browser journey | `pnpm e2e` or targeted `playwright test` | `pnpm e2e:ui` only when interactive debugging helps. |

## Root gates

| Command | What it covers | Use when |
| --- | --- | --- |
| `pnpm test:strict` | Mobile strict tests, workspace strict tests, and integration tests. | Default pre-review gate. |
| `pnpm test:workspaces` | API, Web UI, Telegram channel, and packages. | Code or docs change references workspace behavior. |
| `pnpm test:integration` | API, Web UI, and Telegram integration tests. | Contracts, API adapters, or cross-workspace behavior changed. |
| `pnpm test:packages` | All shared packages under `packages/*`. | Contracts/domain/i18n/testing/config packages changed. |

## Workspace tests

| Workspace | Commands |
| --- | --- |
| Mobile | `pnpm mobile:test`, `pnpm mobile:test:strict`, `pnpm mobile:typecheck` |
| API | `pnpm api:test`, `pnpm api:test:strict` |
| Web UI | `pnpm web:test`, `pnpm web:test:strict`, `pnpm web:build` |
| Telegram channel | `pnpm telegram:test`, `pnpm telegram:test:strict` |
| Contracts | `pnpm contracts:test`, `pnpm contracts:test:strict` |

Prefer the workspace command while developing. Run the matching strict command before asking for review.

## Integration tests

```bash
pnpm test:integration
```

This runs integration suites for API, Web UI, and Telegram channel. Use it when a change crosses package boundaries, touches API contracts, changes Telegram adapters, or modifies behavior that a unit test cannot prove alone.

## Playwright

```bash
pnpm e2e
pnpm e2e:ui
pnpm exec playwright test e2e/operational-map.spec.ts
```

Use Playwright for browser-visible flows, local API/Web UI interaction, and simulated Telegram webhook behavior that must be observed through the web surface.

## Maestro and mobile smoke

```bash
pnpm maestro:smoke:ios
pnpm maestro:offline-spike:ios
pnpm visual:audit:check
```

Use Maestro when the native iOS app shell, navigation, offline path, or visual behavior is the risk. Keep Playwright for Web UI/API flows; do not use it as a replacement for native mobile smoke.

## Telegram E2E

Safe checks:

```bash
pnpm e2e:telegram:typecheck
pnpm e2e:telegram:dry-run
pnpm e2e:telegram:dry-run:natural-sos
pnpm e2e:telegram:dry-run:family-reunification
pnpm e2e:telegram:dry-run:dispatch
pnpm e2e:telegram:dry-run:incident-join
```

Real staging checks:

```bash
pnpm e2e:staging:telegram
pnpm e2e:staging:telegram:incident-join
```

Use Telegram E2E when bot behavior, real Telegram delivery, staging API/D1 persistence, or staging Web UI evidence matters. Configure staging locally in `e2e/telegram-e2e.local`; never document or paste secret values.

## Pre-review checklist

- [ ] Ran the smallest relevant test while developing.
- [ ] Ran the strict or integration gate that matches the changed surface.
- [ ] Used dry-runs before real Telegram staging E2E.
- [ ] Captured only non-secret evidence.
- [ ] Did not use Playwright as a substitute for native Maestro smoke, or Maestro as a substitute for Web/API E2E.

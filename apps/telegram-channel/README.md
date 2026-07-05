# Telegram channel

`@zona-cero/telegram-channel` owns Telegram conversation behavior. Keep it small, pure, and easy to test: the package turns Telegram-like updates plus injected ports into typed responses and next conversation state.

## Quick path

```bash
pnpm telegram:test
pnpm telegram:test:strict
pnpm --filter @zona-cero/telegram-channel test:integration
```

Use this workspace when changing bot commands, conversation prompts, Telegram parsing, or channel-specific safety gates.

## Package boundary

| Concern | Owner | Notes |
| --- | --- | --- |
| Telegram update parsing, commands, conversation state machines, localized Telegram copy | `apps/telegram-channel` | Prefer pure handlers that accept state, update, ports, and optional flow context. |
| HTTP webhook runtime, D1 persistence, telemetry, Workers AI intent routing, API adapters | `services/api` | `/telegram/webhook` loads/persists Telegram state and calls this package. |
| Shared request/response schemas, operation payloads, stable errors, fixtures | `packages/contracts` | Update when a Telegram flow needs a new durable API contract or typed payload. |
| Cross-channel business permissions and domain rules | `packages/domain` | Update when behavior is not Telegram-specific. |
| Localized shared messages | `packages/i18n` | Use for copy that is shared or translated across surfaces. |

## Current command surface

| Command / input | Flow |
| --- | --- |
| `/start` | Incident join onboarding. Handles incident selection, pseudonym, role selection, and candidate role confirmation. |
| `/idioma`, `/language` | Preferred Telegram locale selection. |
| `/workcenter` plus natural-language work-center reports | Work-center reporting with confirmation before persistence. |
| `/resource` plus natural-language resource reports | Resource need/offer reporting with confirmation before persistence. |
| `/dispatch` plus dispatch status/update phrases | Dispatch coordination against API-managed tasks. |
| `/sos` plus natural-language SOS phrases | SOS collection with exact confirmation requirements before creating an alert. |
| `/reunificacion` plus family-reunification phrases | Sensitive family-reunification handoff to a private web link. |
| Native Telegram location messages | Location enrichment for supported operational flows. |

## Pure handler pattern

Handlers should stay deterministic and side-effect free except through injected ports.

- Accept the current flow state and a `TelegramUpdateLike`.
- Read command arguments and native Telegram fields through helpers.
- Call injected ports for API-backed actions such as listing incidents or creating reports.
- Return response text plus the next typed state.
- Let `services/api` decide how to persist, delete, or route conversation state.

That separation is NOT decoration. It is what keeps Telegram flows testable without a real bot, D1 database, or Cloudflare Worker runtime.

## Relationship to `/telegram/webhook`

`services/api` exposes the real webhook boundary. It is responsible for:

1. Receiving the Telegram webhook update.
2. Loading the relevant conversation state from D1.
3. Routing an existing pending flow before starting a new one.
4. Creating the ports that adapt Telegram handlers to API persistence.
5. Persisting non-terminal state or deleting terminal state.
6. Returning the handler response to Telegram.

Do not move Worker bindings, database access, HTTP response shaping, or secret handling into this package.

## Tests

| Command | Use when |
| --- | --- |
| `pnpm telegram:test` | Fast package test run while editing Telegram handlers. |
| `pnpm telegram:test:strict` | Typecheck plus package tests before handing off Telegram changes. |
| `pnpm --filter @zona-cero/telegram-channel test:integration` | Focused channel integration coverage. |
| `pnpm test:workspaces` | Verify API, Web UI, Telegram channel, and packages together. |
| `pnpm test:strict` | Root strict gate before review. |
| `pnpm e2e:telegram:dry-run:natural-sos` | Inspect the natural-language SOS staging scenario without contacting Telegram. |
| `pnpm e2e:telegram:dry-run:family-reunification` | Inspect the family reunification staging scenario without contacting Telegram. |
| `pnpm e2e:telegram:dry-run:dispatch` | Inspect the dispatch staging scenario without contacting Telegram. |
| `pnpm e2e:telegram:dry-run:incident-join` | Inspect the incident join staging scenario without contacting Telegram. |
| `pnpm e2e:staging:telegram` | Opt-in real staging Telegram test after staging is configured and safe to mutate. |

## When to update contracts, domain, or API

Use this checklist before adding Telegram-only code:

- [ ] New persisted payload, webhook response, operation type, or API error? Update `packages/contracts` first.
- [ ] Rule applies to mobile, web, and Telegram? Put it in `packages/domain`, not a handler branch.
- [ ] Flow needs D1, Workers AI, telemetry, auth, rate limits, or HTTP behavior? Implement the adapter in `services/api` and keep handlers pure.
- [ ] New command or conversation state? Add Telegram package tests and consider a dry-run E2E scenario.
- [ ] New real staging behavior? Update `e2e/README.md` and `docs/runbooks/telegram-e2e.md` without documenting secret values.

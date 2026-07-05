# Zona Cero API service

`@zona-cero/api` is the Hono Cloudflare Worker that fronts the operational API for Zona Cero. It owns HTTP routing, Cloudflare bindings, D1 persistence, Telegram webhook delivery, and the edge-facing adapters around the shared contracts/domain packages.

## Responsibilities

| Area | What this Worker does |
| --- | --- |
| Health and discovery | Exposes health, incident list/config, map countries, and operational map responses. |
| Incident access | Joins channel identities to incidents and returns role/channel permission snapshots. |
| Field operations | Creates and reads work centers, resource reports, dispatch tasks, and SOS alerts. |
| Sync | Accepts signed operation pushes and serves scoped pull cursors for incident/cell clients. |
| Private links | Issues, validates, consumes, and audits private family-reunification web links. |
| Telegram | Receives `/telegram/webhook`, verifies the Telegram secret header, routes commands/conversations, and replies through the Telegram Bot API. |
| Observability and safety | Records operational audit/rate-limit data and structured operational events. |

Shared behavior lives in workspace packages:

- `@zona-cero/contracts` for request/response schemas and stable contract types.
- `@zona-cero/domain` for pure operational policies and derived state.
- `@zona-cero/telegram-channel` for Telegram conversation state machines.
- `@zona-cero/testing` for test fixtures and Cloudflare test helpers.

## Key routes

Verified from `services/api/src/index.ts`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API health and version. |
| `GET` | `/incidents` | List known incidents. |
| `GET` | `/map/countries` | List map country options. |
| `GET` | `/map?countryCode=<ISO2>` | Operational country map. |
| `GET` | `/incidents/:incidentId/config` | Incident config, roles, channels, permissions. |
| `POST` | `/incidents/:incidentId/join` | Join an incident from a channel identity. |
| `POST` | `/incidents/:incidentId/private-links` | Issue private family-reunification links. |
| `POST` | `/private-links/validate` | Validate a private link without consuming it. |
| `POST` | `/private-links/consume` | Consume a private link. |
| `POST` | `/private-links/family-reunification/search` | Run protected family-reunification search. |
| `POST` | `/incidents/:incidentId/work-centers` | Create a connected work center. |
| `GET` | `/incidents/:incidentId/work-centers` | List work centers. |
| `GET` | `/incidents/:incidentId/work-centers/:workCenterId` | Read work center detail. |
| `POST` | `/incidents/:incidentId/resource-reports` | Create a connected resource report. |
| `GET` | `/incidents/:incidentId/resource-reports` | List resource reports. |
| `GET` | `/incidents/:incidentId/resource-reports/matches` | Match compatible resource reports. |
| `GET` | `/incidents/:incidentId/resource-reports/:resourceReportId` | Read resource report detail. |
| `POST` | `/incidents/:incidentId/dispatch-tasks` | Create a dispatch task. |
| `GET` | `/incidents/:incidentId/dispatch-tasks` | List dispatch tasks. |
| `PATCH` | `/incidents/:incidentId/dispatch-tasks/:dispatchTaskId` | Update dispatch task status. |
| `POST` | `/incidents/:incidentId/sos` | Create an SOS alert. |
| `GET` | `/incidents/:incidentId/sos` | Read SOS alerts and fanout status. |
| `POST` | `/sync/push` | Legacy/unscoped sync push. |
| `POST` | `/incidents/:incidentId/cells/:cellId/sync/push` | Scoped sync push with rate limiting. |
| `GET` | `/sync/pull` | Legacy empty sync pull. |
| `GET` | `/incidents/:incidentId/cells/:cellId/sync/pull` | Scoped sync pull with cursor/limit. |
| `POST` | `/telegram/webhook` | Telegram webhook entrypoint. |

## Cloudflare bindings and configuration

| Binding/config | Source | Notes |
| --- | --- | --- |
| `DB` | D1 database `zona-cero-api-staging` | Main relational store. Migrations are in `services/api/migrations/`. |
| `INCIDENT_CELL_OBJECTS` | Durable Object namespace | Bound to `IncidentCellObject`; currently exposes a simple DO health response and reserves per-cell state ownership. |
| `AI` | Workers AI binding | Used by the Telegram intent classifier when the intent router is enabled. |
| `API_VERSION` | Wrangler vars | Returned by `/health`. |
| `TURNSTILE_ROLLOUT` | Wrangler vars | `off`, `observe`, or `enforce` behavior for protected family-reunification search. Staging uses `observe`. |
| `TELEGRAM_INTENT_ROUTER_ENABLED` | Wrangler vars | Staging enables AI-assisted Telegram intent routing. |
| `TELEGRAM_BOT_TOKEN` | Worker secret | Required to send Telegram replies. Do not commit or print it. |
| `TELEGRAM_WEBHOOK_SECRET_TOKEN` | Worker secret | Must match Telegram `setWebhook.secret_token`. |
| `TURNSTILE_SECRET_KEY` | Worker secret | Required before enforcing Turnstile. |

Wrangler config lives in `services/api/wrangler.jsonc`.

## Commands

Run from the repository root unless noted.

| Task | Command |
| --- | --- |
| Start local Worker | `pnpm api:dev` |
| API tests | `pnpm api:test` |
| API typecheck + tests | `pnpm api:test:strict` |
| API integration contracts | `pnpm --filter @zona-cero/api test:integration` |
| Local D1 migrations | `pnpm api:migrate:local` |
| Local demo seed | `pnpm api:seed:local` |
| Staging D1 migrations | `pnpm api:migrate:staging` |
| Staging demo seed | `pnpm api:seed:staging` |
| Staging Worker deploy | `pnpm api:deploy:staging` |
| Worker dry-run build | `pnpm --filter @zona-cero/api build` |

Workspace equivalents are defined in `services/api/package.json`.

## Migrations and seeding

- Migration files: `services/api/migrations/0001_*.sql` through `0010_incident_geography.sql`.
- Demo seed: `services/api/seeds/incident-zc-demo.sql`.
- Apply migrations before seeding.
- Local commands use Wrangler D1 `--local`; staging commands use `--remote --env staging`.

See [API migrations and seeding](../../docs/runbooks/api-migrations-and-seeding.md) for the safe workflow.

## Deployment

Staging deploy is Worker-only:

```sh
pnpm api:migrate:staging
pnpm api:seed:staging
pnpm api:deploy:staging
curl -fsS https://zona-cero-api-staging.jauss.workers.dev/health
```

For the full staging release order, Web UI Pages deploy, Telegram webhook setup, smoke checks, and rollback notes, use [Cloudflare staging runbook](../../docs/runbooks/cloudflare-staging.md).

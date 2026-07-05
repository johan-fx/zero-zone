# Services

Backend and runtime workspaces for Zona Cero. Start here when working on API, webhook, storage, authorization, audit, or deployment behavior.

## Start here

| Workspace | What lives here | Read next |
|---|---|---|
| `services/api` | Cloudflare Workers API, Telegram webhook entrypoint, sync endpoints, authorization, audit, queues, D1 migrations, and staging deploy scripts. | [services/api/README.md](api/README.md) |

## Common entry points

| Need | Root command |
|---|---|
| Local API dev server | `pnpm api:dev` |
| API tests | `pnpm api:test` |
| API strict tests | `pnpm api:test:strict` |
| Local D1 migrations | `pnpm api:migrate:local` |
| Local D1 seed | `pnpm api:seed:local` |
| Staging D1 migrations | `pnpm api:migrate:staging` |
| Staging D1 seed | `pnpm api:seed:staging` |
| Staging API deploy | `pnpm api:deploy:staging` |

## Boundaries

- Put runtime-specific Cloudflare, webhook, D1, queue, authorization, and audit logic in `services/api`.
- Put shared schemas in `packages/contracts` and pure business rules in `packages/domain`.
- Keep Telegram flow rendering in `apps/telegram-channel`; the API owns the webhook runtime boundary.

Run local setup through the [local development runbook](../docs/runbooks/local-development.md). Use the [Cloudflare staging runbook](../docs/runbooks/cloudflare-staging.md) before touching Cloudflare staging.

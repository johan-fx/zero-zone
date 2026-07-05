# Cloudflare staging runbook

Use this runbook to deploy and smoke-check the Cloudflare staging API and Web UI. Keep secrets out of files, shell history, screenshots, and chat.

For deeper historical context, see [`docs/zona_cero_staging_release_runbook.md`](../zona_cero_staging_release_runbook.md). This page keeps the current happy path short.

## Staging targets

| Surface | Target |
| --- | --- |
| API Worker | `zona-cero-api-staging` |
| API URL | `https://zona-cero-api-staging.jauss.workers.dev` |
| D1 database | `zona-cero-api-staging` |
| Web UI Pages project | `zona-cero-web-ui-staging` |
| Pages branch | `staging` |
| Demo incident/cell | `incident-zc-demo` / `cell-zc-demo` |

## Pre-flight

Run from the repository root:

```sh
pnpm test:strict
pnpm web:build:staging
```

Confirm required Worker secrets are already configured before deploying API changes that use them:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET_TOKEN`
- `TURNSTILE_SECRET_KEY` when moving Turnstile beyond observe mode

Set secrets interactively only:

```sh
pnpm --filter @zona-cero/api exec wrangler secret put TELEGRAM_BOT_TOKEN --env staging
pnpm --filter @zona-cero/api exec wrangler secret put TELEGRAM_WEBHOOK_SECRET_TOKEN --env staging
```

## Deploy order

1. Apply D1 migrations.
2. Seed demo staging data if the demo incident/cell must be refreshed.
3. Deploy the API Worker.
4. Deploy the Web UI Pages site if UI assets or API base assumptions changed.
5. Run smoke checks.

```sh
pnpm api:migrate:staging
pnpm api:seed:staging
pnpm api:deploy:staging
pnpm web:deploy:staging
```

`pnpm web:deploy:staging` builds `apps/web-ui/dist` with the staging API base URL and uploads it to Cloudflare Pages through the API workspace Wrangler dependency.

## Smoke checks

### API

```sh
curl -fsS https://zona-cero-api-staging.jauss.workers.dev/health
curl -fsS https://zona-cero-api-staging.jauss.workers.dev/incidents
curl -fsS "https://zona-cero-api-staging.jauss.workers.dev/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull?limit=1"
```

Expected result: successful JSON responses, no secret values, and `/health` returns `ok: true`.

### Web UI

- Open the staging Pages URL for `zona-cero-web-ui-staging`.
- Confirm the UI points to `https://zona-cero-api-staging.jauss.workers.dev`.
- Check the demo incident/cell loads.
- Smoke the critical staging paths that changed, especially help points, resource reports, dispatch tasks, SOS, or private family-reunification links when relevant.

### Telegram, when webhook behavior changed

- Confirm the webhook still points to `https://zona-cero-api-staging.jauss.workers.dev/telegram/webhook`.
- Run the Telegram staging E2E flow only from a trusted terminal with the required local secrets.
- Never paste Telegram tokens into committed docs, logs, screenshots, or chat.

Useful commands:

```sh
pnpm e2e:telegram:dry-run
pnpm e2e:staging:telegram
```

## Rollback and cautions

- **Migrations first means rollback is not just redeploy.** Prefer a forward corrective migration or Cloudflare D1 backup/time-travel recovery for data issues.
- **Do not manually edit staging D1 data** unless the command, reason, and expected repair are recorded.
- **API Worker rollback:** use Wrangler/Cloudflare deployment rollback for `zona-cero-api-staging`.
- **Pages rollback:** redeploy the last known-good build or Git revision to `zona-cero-web-ui-staging` on branch `staging`.
- **Telegram rollback:** point the webhook back to the last known-good Worker URL or temporarily delete it while investigating.
- Keep `TURNSTILE_ROLLOUT=observe` in staging until the real widget and smoke checks are proven.

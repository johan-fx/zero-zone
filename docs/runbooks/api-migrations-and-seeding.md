# API migrations and seeding runbook

Use this runbook when changing the API D1 schema or refreshing demo data. The safe rule is simple: migrate first, seed second, deploy after the database shape is ready.

## Files and database

| Item | Location/value |
| --- | --- |
| Migrations | `services/api/migrations/` |
| Current migration range | `0001_incidents.sql` through `0010_incident_geography.sql` |
| Demo seed | `services/api/seeds/incident-zc-demo.sql` |
| D1 database name | `zona-cero-api-staging` |
| Wrangler config | `services/api/wrangler.jsonc` |

## Local workflow

Use local D1 while developing or verifying docs/schema changes:

```sh
pnpm api:migrate:local
pnpm api:seed:local
pnpm api:dev
```

Then smoke the local Worker, usually at `http://127.0.0.1:8787`:

```sh
curl -fsS http://127.0.0.1:8787/health
curl -fsS http://127.0.0.1:8787/incidents
```

## Staging workflow

Run from the repository root:

```sh
pnpm api:migrate:staging
pnpm api:seed:staging
pnpm api:deploy:staging
curl -fsS https://zona-cero-api-staging.jauss.workers.dev/health
```

The staging commands map to:

| Root command | Workspace command |
| --- | --- |
| `pnpm api:migrate:staging` | `wrangler d1 migrations apply zona-cero-api-staging --remote --env staging` |
| `pnpm api:seed:staging` | `wrangler d1 execute zona-cero-api-staging --remote --env staging --file ./seeds/incident-zc-demo.sql --yes` |

## Safety checklist

Before staging:

- [ ] The migration is additive or has a reviewed data-migration/rollback plan.
- [ ] Local migrations apply cleanly from a fresh local D1 state.
- [ ] The seed is idempotent or safe to re-run for the demo incident.
- [ ] API tests or contract tests cover the affected route/schema.
- [ ] No secret values are embedded in SQL, docs, logs, or command history.

During staging:

- [ ] Apply migrations before seeding.
- [ ] Seed only the intended demo dataset.
- [ ] Deploy the Worker after the remote database shape is ready.
- [ ] Smoke `/health`, `/incidents`, and any changed route.

If something fails:

- Stop and capture the failing command and error.
- Do not hand-edit D1 rows as a shortcut. That is how you create invisible state debt.
- Prefer a forward corrective migration or Cloudflare D1 backup/time-travel recovery.
- If the Worker is incompatible with the remote schema, roll back the Worker deployment while preparing the database fix.

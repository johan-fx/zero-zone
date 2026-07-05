# @zona-cero/testing

Shared deterministic fixtures and builders for contract, API, Telegram, Web UI, mobile, and package tests.

## Ownership boundary

| Owns | Does not own |
|---|---|
| Reusable test fixtures, valid/invalid payload builders, deterministic sample data | Production defaults, migrations, runtime seed data, secrets |

## Commands

| Task | Command |
|---|---|
| Typecheck | `pnpm --filter @zona-cero/testing typecheck` |
| Test | `pnpm --filter @zona-cero/testing test` |
| Strict check | `pnpm --filter @zona-cero/testing test:strict` |
| Build | `pnpm --filter @zona-cero/testing build` |

## Tests

`packages/testing/src/index.test.ts` verifies fixture validity against `@zona-cero/contracts`. Run it whenever contracts or fixture builders change.

## Consumers

- `services/api`
- `apps/mobile`
- `apps/telegram-channel`
- Root E2E and package-level tests that need stable contract examples

## Change rules

- Keep fixtures deterministic: no live time, random IDs, network calls, or environment-dependent values.
- Update fixtures immediately when a required contract field changes.
- Include both valid and invalid examples when adding a new schema surface.
- Do not use production credentials, real personal data, or sensitive incident details in fixtures.

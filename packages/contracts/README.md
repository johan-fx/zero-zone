# @zona-cero/contracts

Canonical TypeScript and Zod contract package for shared schemas, operation vocabulary, stable error semantics, locale support, and API payload boundaries.

## Ownership boundary

| Owns | Does not own |
|---|---|
| Schemas, exported contract types, operation vocabulary, contract error codes, locale primitives | Domain policy decisions, API persistence, UI copy, Telegram conversation state |

Breaking contract changes require coordination across API, domain, web, mobile, Telegram, and testing fixtures.

## Commands

| Task | Command |
|---|---|
| Typecheck | `pnpm --filter @zona-cero/contracts typecheck` |
| Test | `pnpm contracts:test` |
| Strict check | `pnpm contracts:test:strict` |
| Build | `pnpm --filter @zona-cero/contracts build` |

## Tests

- Package-level coverage lives in `packages/contracts/src/index.test.ts`.
- Cross-workspace expectations are covered by API, Web UI, Telegram, mobile, domain, and testing package checks.
- See `docs/runbooks/contracts-change-process.md` before changing schemas.

## Consumers

- `services/api`
- `apps/web-ui`
- `apps/mobile`
- `apps/telegram-channel`
- `packages/domain`
- `packages/i18n`
- `packages/testing`

## Change rules

- Add or change schemas here before updating consumers.
- Prefer additive changes; preserve existing enum values and response fields unless a migration plan exists.
- Update fixtures in `@zona-cero/testing` with any new required field.
- Update package tests and every consumer integration test that validates the changed shape.
- Keep exported types aligned with Zod schemas; do not export hand-written types that can drift.

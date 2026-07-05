# @zona-cero/domain

Pure domain package for Zona Cero policies, derived operational state, channel permissions, resource matching, and business rules that must be shared across runtimes.

## Ownership boundary

| Owns | Does not own |
|---|---|
| Pure business rules, derived states, cross-channel policies, resource matching logic | React/React Native UI, Cloudflare Worker adapters, Telegram grammar, persistence drivers |

## Commands

| Task | Command |
|---|---|
| Typecheck | `pnpm --filter @zona-cero/domain typecheck` |
| Test | `pnpm --filter @zona-cero/domain test` |
| Strict check | `pnpm --filter @zona-cero/domain test:strict` |
| Build | `pnpm --filter @zona-cero/domain build` |

## Tests

`packages/domain/src/index.test.ts` should cover business-rule examples and boundary cases. Run API and UI consumer tests when a domain rule changes visible or persisted behavior.

## Consumers

- `services/api` for server-side policy and derived state.
- Future clients that need pure, runtime-neutral operational rules.
- `@zona-cero/contracts` provides the schema types consumed by this package.

## Change rules

- Keep this package dependency-light and runtime-neutral.
- Domain rules should accept data and return data; no network, storage, or framework side effects.
- Add or update examples in tests before changing policy behavior.
- If a rule depends on a schema shape, change `@zona-cero/contracts` first and follow the contract-change runbook.

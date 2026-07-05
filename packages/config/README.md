# @zona-cero/config

Shared workspace configuration package for TypeScript and Vitest defaults used by reusable packages and app workspaces.

## Ownership boundary

| Owns | Does not own |
|---|---|
| Shared TS/test presets and small config metadata | App runtime configuration, secrets, staging env values, package-specific business rules |

## Commands

| Task | Command |
|---|---|
| Typecheck | `pnpm --filter @zona-cero/config typecheck` |
| Test | `pnpm --filter @zona-cero/config test` |
| Strict check | `pnpm --filter @zona-cero/config test:strict` |
| Build | `pnpm --filter @zona-cero/config build` |

## Tests

`test:strict` runs `tsc --noEmit -p tsconfig.json` and `vitest run`.

## Consumers

- `@zona-cero/contracts`
- `@zona-cero/crypto`
- `@zona-cero/domain`
- `@zona-cero/i18n`
- `@zona-cero/testing`
- `@zona-cero/ui`
- `@zona-cero/telegram-channel`

## Change rules

- Keep presets runtime-neutral and safe for Workers, Node-based tests, web, and mobile packages.
- Do not add application secrets, deployment targets, or environment-specific values here.
- Run `pnpm test:packages` when changing exported presets because every shared package can be affected.

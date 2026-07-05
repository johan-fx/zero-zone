# @zona-cero/i18n

Shared internationalization package for supported locales, message catalogs, and formatted visible copy used by Telegram and Web UI flows.

## Ownership boundary

| Owns | Does not own |
|---|---|
| Locale resolution, message keys, localized copy catalogs, formatting helpers | Schema definitions, UI layout, Telegram transport, API persistence |

## Commands

| Task | Command |
|---|---|
| Typecheck | `pnpm --filter @zona-cero/i18n typecheck` |
| Test | `pnpm --filter @zona-cero/i18n test` |
| Strict check | `pnpm --filter @zona-cero/i18n test:strict` |
| Build | `pnpm --filter @zona-cero/i18n build` |

## Tests

`packages/i18n/src/index.test.ts` should verify locale fallback, required message keys, and formatting behavior for changed copy.

## Consumers

- `apps/web-ui` for browser-visible copy.
- `apps/telegram-channel` for bot-visible copy.
- `@zona-cero/contracts` provides supported locale primitives consumed here.

## Change rules

- Add every user-visible key for all supported locales before using it in an app.
- Keep message keys stable; rename only with consumer updates in the same change.
- Do not put business policy or schema validation in this package.
- Sensitive-flow copy must stay explicit about limitations, confirmation requirements, and privacy boundaries.

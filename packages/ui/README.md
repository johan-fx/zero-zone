# @zona-cero/ui

Shared operational design system for Zona Cero. The root export provides framework-agnostic tokens and CSS-variable generation; `@zona-cero/ui/web` provides lightweight React DOM primitives for Web UI.

## Ownership boundary

| Owns | Does not own |
|---|---|
| Design tokens, status tones, CSS variable generation, small DOM primitives | App-specific layout decisions, business copy, mobile native component wiring, one-off screen styles |

## Exports

| Export | Purpose | Consumers |
|---|---|---|
| `@zona-cero/ui` | Operational palettes, radii, spacing, typography, z-index, status tone metadata, `generateOperationalCss()`, `generateThemeCss()` | Mobile and Web UI |
| `@zona-cero/ui/web` | `StatusBadge`, `Card`, `SectionHeader`, `MetaRow` plus primitive CSS | Web UI |

## Commands

| Task | Command |
|---|---|
| Typecheck | `pnpm --filter @zona-cero/ui typecheck` |
| Test | `pnpm --filter @zona-cero/ui test` |
| Strict check | `pnpm --filter @zona-cero/ui test:strict` |
| Build | `pnpm --filter @zona-cero/ui build` |

## Tests

- Token and CSS-variable coverage: `packages/ui/src/tokens.test.ts`, `packages/ui/src/css-variables.test.ts`.
- DOM primitive coverage: `packages/ui/src/web/components.test.tsx`.
- Run visual QA when token, radius, color, or primitive changes affect visible screens.

## Consumers

- `apps/mobile` consumes root tokens for Tamagui/React Native alignment.
- `apps/web-ui` consumes root tokens and `@zona-cero/ui/web` primitives.
- Design docs and mockups in `docs/mockups` provide the visual reference.

## Change rules

- Change shared tokens before patching local app styles.
- Keep root exports framework-agnostic; React DOM code belongs under `./web`.
- Add tests for new tokens, generated CSS variables, and primitives.
- Run `pnpm visual:audit:check` or the visual QA runbook for visible design-system changes.

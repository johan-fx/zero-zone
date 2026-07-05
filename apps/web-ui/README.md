# Web UI workspace

Vite React workspace for civil-facing web screens, public map/help views, and private links that complement Telegram and API flows. It is intentionally static/edge-friendly and does not require a long-running Node.js server.

## Ownership boundary

| Area | Web UI owns | Web UI must not own |
|---|---|---|
| Runtime | React DOM screens, Vite build, MapLibre browser rendering | Cloudflare Worker API behavior, D1 migrations, Telegram bot state |
| UX | Public/civil helper views and short-lived private web-link surfaces | Offline mobile guarantees or native-only sensor flows |
| Contracts | Client-side parsing and integration expectations from `@zona-cero/contracts` | Forked schema definitions or hidden response assumptions |
| Design | DOM primitives from `@zona-cero/ui/web` and generated `--zc-*` CSS variables | Local design tokens that diverge from shared tokens |

## Commands

| Task | Root command | Workspace command |
|---|---|---|
| Start dev server | `pnpm web:dev` | `pnpm --filter @zona-cero/web-ui dev` |
| Build | `pnpm web:build` | `pnpm --filter @zona-cero/web-ui build` |
| Preview build | — | `pnpm --filter @zona-cero/web-ui preview` |
| Staging build | `pnpm web:build:staging` | `pnpm --filter @zona-cero/web-ui build:staging` |
| Deploy staging | `pnpm web:deploy:staging` | `pnpm --filter @zona-cero/web-ui deploy:staging` |

## Tests and verification

| Check | Command | When to run |
|---|---|---|
| Unit tests | `pnpm web:test` | UI logic, copy routing, theme behavior |
| Integration contract test | `pnpm --filter @zona-cero/web-ui test:integration` | API response shape or contract consumption changes |
| Strict web check | `pnpm web:test:strict` | Before handing off web changes |
| Local Playwright E2E | `pnpm e2e` | Cross-workspace user flows |

## Consumers

- Public helpers and volunteers using browser flows.
- Telegram private-link flows that hand off sensitive or structured input to web.
- Staging E2E checks that verify visible web behavior.

## Change rules

- Keep API base URL and incident/cell staging configuration in build-time environment wiring, not hardcoded inside components.
- Parse and render API data through shared contracts; update `src/contracts.integration.test.tsx` when schemas change.
- Use `@zona-cero/i18n` for visible copy and locale behavior.
- Use `@zona-cero/ui` and `@zona-cero/ui/web` for tokens and primitives before adding local styles.
- Do not commit Playwright reports, screenshots, traces, or `/output` artifacts.

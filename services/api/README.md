# API service workspace placeholder

Owner: Equipo B.

Reserved for the Cloudflare Workers API and Telegram webhook runtime.

## Initial responsibilities

- Incident config, join, channel identity, permissions, and audit.
- Operation push/pull and idempotency once sync slices start.
- Telegram webhook integration while keeping Telegram flow logic in `apps/telegram-channel`.
- Secure web-link token validation for `apps/web-ui`.

## Minimum shared package dependencies

- `packages/contracts`: API types, schemas, stable errors, fixtures.
- `packages/domain`: pure domain policies and entities.
- `packages/crypto`: canonical payload and signing helpers.
- `packages/testing`: contract fixtures/builders for cross-team tests.

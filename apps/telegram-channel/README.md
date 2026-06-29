# Telegram channel workspace placeholder

Owner: Equipo A.

Reserved for Telegram bot flows, command rendering, conversational state transitions, and channel-specific copy.

## Boundary

- Keep domain rules in `packages/domain` or `services/api`, not in Telegram handlers.
- Keep API/webhook runtime concerns in `services/api`.
- Use `packages/contracts` for operation payloads, stable errors, and shared fixtures once available.

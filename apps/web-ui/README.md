# Web UI workspace placeholder

Owner: Equipo A.

Reserved for secure web links and lightweight operational panels that complement Telegram flows.

## Initial runtime needs

- TypeScript + React UI suitable for short-lived secure links.
- Edge/static-friendly build; do not require a long-running Node.js server for the MVP.
- Online map/detail views only; offline guarantees stay in the native app.
- Consume shared contracts from `packages/contracts` once slice 1 creates them.
- Delegate token validation, authorization, rate limits, and audit writes to `services/api`.

Final framework selection belongs to the Web UI implementation slice; slice 0 only fixes the workspace boundary.

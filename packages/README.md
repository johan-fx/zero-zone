# Packages

Shared workspace packages for Zona Cero.

## Ownership summary

| Package | Owner | Purpose |
|---|---|---|
| `packages/domain` | Equipo B | Pure entities, policies, and domain rules. |
| `packages/contracts` | Equipo B | API/operation schemas, stable errors, and fixtures. |
| `packages/crypto` | Equipo B | Canonical payload/signing interfaces and safe helpers. |
| `packages/ui` | Equipo C or shared | Shared UI only when mobile and web truly converge. |
| `packages/config` | Shared | Shared TypeScript/lint/test presets when extracted. |
| `packages/testing` | Shared | Fixtures, builders, and contract test helpers. |

Do not put runtime-specific code in shared packages.

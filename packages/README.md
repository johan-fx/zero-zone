# Packages

Shared workspace packages for Zona Cero. Use this index to find the owning package README before adding shared code.

## Start here

| Package | Purpose | Read next |
|---|---|---|
| `packages/contracts` | API schemas, operation contracts, stable errors, and shared fixtures. | [packages/contracts/README.md](contracts/README.md) |
| `packages/domain` | Pure entities, policies, and domain rules. | [packages/domain/README.md](domain/README.md) |
| `packages/crypto` | Canonical payload helpers, signing interfaces, verification helpers, and safe primitives. | [packages/crypto/README.md](crypto/README.md) |
| `packages/ui` | Framework-agnostic design tokens and React DOM primitives shared by mobile/web. | [packages/ui/README.md](ui/README.md) |
| `packages/config` | Shared TypeScript and Vitest presets. | [packages/config/README.md](config/README.md) |
| `packages/testing` | Cross-team fixtures, builders, contract-test helpers, and deterministic test data. | [packages/testing/README.md](testing/README.md) |
| `packages/i18n` | Shared localization messages and formatting. | [packages/i18n/README.md](i18n/README.md) |

## Common entry points

| Need | Root command |
|---|---|
| All package strict tests | `pnpm test:packages` |
| Contracts tests | `pnpm contracts:test` |
| Contracts strict tests | `pnpm contracts:test:strict` |
| All workspace tests | `pnpm test:workspaces` |
| Full strict gate | `pnpm test:strict` |

## Shared-package rules

- Shared packages must stay runtime-neutral unless the package README says otherwise.
- Do not put React Native, Telegram, Cloudflare, browser, or secret handling into `packages/domain`.
- Breaking `packages/contracts` changes require API, web/Telegram, and mobile consumer review.
- Prefer package-local tests plus the relevant root strict command before changing shared behavior.

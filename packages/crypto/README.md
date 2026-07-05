# @zona-cero/crypto

Runtime-neutral cryptographic helpers for canonical payload handling and hashing seams shared by clients and services.

## Ownership boundary

| Owns | Does not own |
|---|---|
| Deterministic canonical payload serialization, safe hash helpers, reusable signing primitives | Secret storage, key material, environment-specific crypto configuration, authorization policy |

## Commands

| Task | Command |
|---|---|
| Typecheck | `pnpm --filter @zona-cero/crypto typecheck` |
| Test | `pnpm --filter @zona-cero/crypto test` |
| Strict check | `pnpm --filter @zona-cero/crypto test:strict` |
| Build | `pnpm --filter @zona-cero/crypto build` |

## Tests

`test:strict` runs `tsc --noEmit -p tsconfig.json` and `vitest run`.

## Consumers

Use this package wherever a client or service needs the same canonical payload behavior. Keep consumers runtime-neutral unless a future adapter explicitly scopes browser, Worker, or native behavior.

## Change rules

- Never commit secrets, private keys, `.pem`, `.key`, or environment files in this package.
- Keep helpers deterministic across runtimes; contract-signing behavior must not depend on object insertion order.
- Add tests for every canonicalization edge case before changing payload serialization.
- Coordinate with `@zona-cero/contracts` when signed payload schemas change.

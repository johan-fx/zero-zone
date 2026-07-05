# Contracts change process

Use this runbook when changing shared schemas, operation vocabulary, response shapes, stable error semantics, locale primitives, or fixtures. The safe path is contracts first, consumers second, verification last.

## Quick path

1. Change `packages/contracts` and its tests.
2. Update `packages/testing` fixtures for every new required shape.
3. Update domain/API/Web/Mobile/Telegram consumers in the same work unit.
4. Run the narrow package tests, then strict workspace tests.
5. Document any breaking behavior and the migration or compatibility plan in the PR.

## Ownership map

| Workspace | Contract responsibility | Expected tests |
|---|---|---|
| `packages/contracts` | Zod schemas, exported types, operation vocabulary, error codes, locale primitives | `pnpm contracts:test:strict` |
| `packages/domain` | Pure policy derived from contract types | `pnpm --filter @zona-cero/domain test:strict` |
| `services/api` | Request/response validation, persistence mapping, stable error semantics | `pnpm api:test:strict` and relevant `test:integration` |
| `apps/web-ui` | Browser parsing, visible state, integration assumptions | `pnpm web:test:strict`; `pnpm --filter @zona-cero/web-ui test:integration` for response shapes |
| `apps/mobile` | Offline operation payloads, sync service, local materializers | `pnpm mobile:test:strict`; Maestro when native behavior changes |
| `apps/telegram-channel` | Conversation payload creation and user-facing error handling | `pnpm telegram:test:strict`; staging Telegram E2E when bot behavior changes |
| `packages/testing` | Valid/invalid fixtures and builders | `pnpm --filter @zona-cero/testing test:strict` |

## Safe-change checklist

- [ ] Prefer additive fields, enum values, or optional schema extensions.
- [ ] If a required field is unavoidable, define defaulting or migration behavior before consumers read it.
- [ ] Keep Zod schemas and exported TypeScript types aligned.
- [ ] Update stable error codes and user-visible mappings together.
- [ ] Update fixtures before consumer tests, so downstream failures describe real gaps.
- [ ] Verify every channel that creates or reads the changed payload.
- [ ] Call out breaking changes in the PR with affected routes, flows, and test evidence.

## Change order

### 1. Contracts

Update `packages/contracts/src/*` first. Add tests for:

- accepted valid payloads;
- rejected invalid payloads;
- backward-compatible optional/missing fields when applicable;
- enum or operation-vocabulary additions;
- stable error semantics if a new error code is introduced.

Run:

```bash
pnpm contracts:test:strict
```

### 2. Fixtures

Update `packages/testing/src/index.ts` so valid fixtures still pass and invalid fixtures still fail for the new shape.

Run:

```bash
pnpm --filter @zona-cero/testing test:strict
```

### 3. Domain

If the contract affects policy, derived states, matching, permissions, freshness, risk, or channel rules, update `packages/domain` next.

Run:

```bash
pnpm --filter @zona-cero/domain test:strict
```

### 4. API

Update request parsing, response serialization, persistence mapping, and error mapping in `services/api`. Keep API errors aligned with `contractErrorCodes`.

Run:

```bash
pnpm api:test:strict
pnpm --filter @zona-cero/api test:integration
```

### 5. Web UI

Update Web UI contract parsing, rendering, i18n keys, and integration tests for visible browser behavior.

Run:

```bash
pnpm web:test:strict
pnpm --filter @zona-cero/web-ui test:integration
```

### 6. Mobile

Update offline payload creation, materializers, sync handling, and local tests for any changed operation or response shape.

Run:

```bash
pnpm mobile:test:strict
pnpm maestro:smoke:ios
```

Run Maestro only when the changed contract affects a native flow or visual state.

### 7. Telegram

Update bot flow payloads, confirmation copy, stable error handling, and tests for command and natural-language paths.

Run:

```bash
pnpm telegram:test:strict
pnpm e2e:telegram:dry-run
```

For staging-impacting bot changes, also run the targeted staging E2E scenario from `e2e/README.md` after secrets are loaded.

## Final verification

For broad or risky contract changes, run the workspace gate:

```bash
pnpm test:strict
```

If the contract affects deployed web/API/Telegram behavior, add the relevant integration or E2E evidence to the PR. Do not treat typecheck-only evidence as enough for cross-channel schema changes.

## Breaking-change rules

A change is breaking when an existing client, fixture, route, or bot flow can no longer send or read a previously valid payload.

Before merging a breaking change:

- [ ] State which consumers break and why.
- [ ] Provide a compatibility window, migration, or coordinated release order.
- [ ] Keep old enum values or response fields accepted until every deployed consumer has moved.
- [ ] Add regression tests for both old and new shapes when compatibility is required.

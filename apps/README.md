# Apps

Application workspaces for Zona Cero. Use this index to choose the right app README, then follow the workspace-specific commands there.

## Start here

| Workspace | What lives here | Read next |
|---|---|---|
| `apps/mobile` | Expo React Native app, native operational surfaces, offline-first work-center foundations. | [apps/mobile/README.md](mobile/README.md) |
| `apps/web-ui` | Vite/React secure web links and lightweight operational panels. | [apps/web-ui/README.md](web-ui/README.md) |
| `apps/telegram-channel` | Telegram command/natural-language flows, channel rendering, and adapters. | [apps/telegram-channel/README.md](telegram-channel/README.md) |

## Common entry points

| Need | Root command |
|---|---|
| Mobile dev | `pnpm mobile:start` |
| Mobile iOS | `pnpm mobile:ios` |
| Mobile Android | `pnpm mobile:android` |
| Mobile web | `pnpm mobile:web` |
| Web UI dev | `pnpm web:dev` |
| Web UI build | `pnpm web:build` |
| Web UI tests | `pnpm web:test` |
| Telegram tests | `pnpm telegram:test` |

## Boundaries

- Keep channel-specific behavior in the owning app workspace.
- Keep shared contracts in `packages/contracts` and shared domain rules in `packages/domain`.
- Keep API runtime, authorization, audit, queues, and storage concerns in `services/api`.

For local startup order, use the [local development runbook](../docs/runbooks/local-development.md).

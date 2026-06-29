# Mobile app workspace

Owner: Equipo C.

This workspace contains the existing Expo React Native app after migration phase 1.

## Commands

Run from the repository root through the orchestration scripts:

| Root alias | Mobile workspace command |
|---|---|
| `pnpm mobile:start` | `pnpm --filter @zona-cero/mobile start` |
| `pnpm mobile:ios` | `pnpm --filter @zona-cero/mobile ios` |
| `pnpm mobile:android` | `pnpm --filter @zona-cero/mobile android` |
| `pnpm mobile:web` | `pnpm --filter @zona-cero/mobile web` |
| `pnpm mobile:typecheck` | `pnpm --filter @zona-cero/mobile typecheck` |
| `pnpm mobile:test` | `pnpm --filter @zona-cero/mobile test:ci` |
| `pnpm mobile:test:strict` | `pnpm --filter @zona-cero/mobile test:strict` |

The app keeps Expo Router under `src/app`, Tamagui config beside the app package, and mobile assets under `assets/`.

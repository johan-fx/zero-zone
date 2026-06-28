# Zona Cero Mobile App

Expo + React Native boilerplate for Zona Cero.

## Stack

- Expo SDK 56
- React Native 0.85
- TypeScript
- Expo Router
- Tamagui
- pnpm

## Commands

```bash
pnpm install
pnpm start
pnpm ios
pnpm android
pnpm web
pnpm typecheck
```

## Scope

This is only the app boilerplate. It includes Tamagui as the UI/design-system foundation, but intentionally does not implement the first technical spike: no RxDB, SQLite persistence, signed outbox, sync, MapLibre, or Meshtastic gateway logic yet.

## Strict TDD loop

Use Jest + jest-expo + React Native Testing Library for fast unit and component tests. Do not bypass failing tests with `--passWithNoTests`; the default scripts fail when the suite is missing or broken.

```bash
pnpm test:tdd      # watch changed tests during TDD
pnpm test          # run the unit/component suite
pnpm test:ci       # deterministic CI run
pnpm test:strict   # typecheck + deterministic tests
```

## Smoke tests

This boilerplate includes a first Maestro smoke test for the Expo Go iOS flow.

```bash
pnpm ios
pnpm maestro:smoke:ios
```

The iOS smoke flow opens `exp://127.0.0.1:8081`, then verifies the initial Zona Cero screen and the Tamagui smoke button.

Install Maestro locally before running the flow:

```bash
brew tap mobile-dev-inc/tap
brew trust --formula mobile-dev-inc/tap/maestro
brew install mobile-dev-inc/tap/maestro
```


For agent-driven validation from Codex, use the headless Expo start script to avoid launching the React Native DevTools Electron app from the Codex process:

```bash
pnpm ios:agent
pnpm maestro:smoke:ios
```

# Dev-build Smoke Notes: Offline-First Work Center Spike

## Scope

These checks cover Slice B live operational entry, pending/offline indicators, preserved visual-audit access, and the native seams introduced in Slice A.

## Required target

- A development build is required; Expo Go is insufficient because `@maplibre/maplibre-react-native`, RxDB SQLite storage, and signing/key-access seams require native modules.
- Bundle/package id: `app.zonacero.mobile`.

## Smoke commands

```bash
pnpm expo config --type public
pnpm maestro:smoke:ios
pnpm visual:audit:check
```

## Manual native checks for verify/orchestrator

- Launch a dev build on a signed iOS simulator/device or Android emulator.
- Confirm the home route opens the live operational entry, not the preview gallery.
- Create a local incident and confirm `Outbox: 1 pending`, `Status: unverified`, and MapLibre map surface visibility.
- Create a pending work center and confirm `Pending sync`, `State: pending`, and `Activation requires sufficient evidence`.
- Confirm visual audit remains reachable and shows `Visual audit: mock-backed operational-map` with mock preview content.
- Confirm native MapLibre/RxDB/signing checks run in a dev build; no backend sync or real Meshtastic hardware is expected in this slice.

## Environment-limited note

This executor cannot complete real device signing/native smoke without a booted simulator/device and installed dev build. The Maestro flows are committed as executable smoke coverage for a configured dev-build target.

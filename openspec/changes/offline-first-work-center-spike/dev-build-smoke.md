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
pnpm maestro:offline-spike:ios
pnpm visual:audit:check
```

## Current Maestro evidence

- 2026-06-29: `pnpm maestro:smoke:ios` ✅ passed on booted iOS simulator `iPhone 17 - iOS 26.5` against bundle id `app.zonacero.mobile`.
- 2026-06-29: `pnpm maestro:offline-spike:ios` ✅ passed; this is an explicit alias for the offline-first spike coverage flow.
- 2026-06-29: `pnpm visual:audit:check` ✅ passed on the same dev build.

Covered scenarios: live entry launch, local incident creation, pending work center creation without false activation, aggregate/no-identity selected-center details, presence check-in/pause/check-out, missing local data explanation, stale center degradation, offline map-preparation local-vs-unavailable packs, design-system mock separation, and visual-audit mock separation.

## Manual native checks for verify/orchestrator

- Launch a dev build on a signed iOS simulator/device or Android emulator.
- Confirm the home route opens the live operational entry, not the preview gallery.
- Create a local incident and confirm `Outbox: 1 pending`, `Status: unverified`, and MapLibre map surface visibility.
- Create a pending work center and confirm `Pending sync`, `State: pending`, and `Activation requires sufficient evidence`.
- Confirm visual audit remains reachable and shows `Visual audit: mock-backed operational-map` with mock preview content.
- Confirm native MapLibre/RxDB/signing checks run in a dev build; no backend sync or real Meshtastic hardware is expected in this slice.

## Environment-limited note

The iOS dev build is now installed and Maestro can run against it. The flows account for Expo dev-client launcher behavior by using cached development-server state and operational deep links; if the dev-client cache is cleared and no development server is listed, start Metro/dev-client again before running Maestro.

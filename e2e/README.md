# Real staging Telegram E2E

This folder contains the opt-in real staging flow:

`Telegram test account -> @Zona_Cero_Bot -> staging API/D1 -> staging Web UI`

## Secrets

Local secrets live in `e2e/telegram-e2e.local`. Do not commit that file and do not paste its values in logs, issues, or PRs.

From the repository root, load the environment in your shell:

```bash
set -a
source e2e/telegram-e2e.local
set +a
```

Expected variables:

- `TELEGRAM_E2E_API_ID`
- `TELEGRAM_E2E_API_HASH`
- `TELEGRAM_E2E_PHONE`
- `TELEGRAM_E2E_BOT_USERNAME`
- `TELEGRAM_E2E_SESSION_FILE`
- `E2E_API_BASE_URL`
- `E2E_WEB_UI_URL`
- `E2E_INCIDENT_ID`
- `E2E_CELL_ID`

## Authenticate once

The runner uses GramJS/MTProto and stores a reusable local session in `TELEGRAM_E2E_SESSION_FILE`.
It asks for the Telegram login code and 2FA password only when the session file does not exist.

```bash
pnpm e2e:telegram:auth
```

## Dry-run the planned sequence

This validates configuration and prints only the planned E2E messages plus a generated marker. It does not contact Telegram.

```bash
pnpm e2e:telegram:dry-run
```

## Run the real staging test

```bash
pnpm e2e:staging:telegram
```

The test sends a safe sequence to the bot (`/start` incident join, language selection, work-center report, explicit resource report, and a natural-language resource report completed through confirmation), then opens `E2E_WEB_UI_URL`. If the marker is not visible in the UI, the test falls back to staging API reads for work centers and resource reports.

## Sensitive helpers

Helpers for `/sos` and `/reunificacion` exist in the runner, but they are skipped by default to avoid sensitive mutations. To exercise them deliberately, run the runner directly with the opt-in flag:

```bash
pnpm tsx e2e/telegram/staging-telegram-runner.ts run --include-sensitive-flows
```

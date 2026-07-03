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

This prints only the planned E2E messages plus a generated marker. It does not contact Telegram and uses safe placeholders when the local secret file has not been sourced.

```bash
pnpm e2e:telegram:dry-run
```

To inspect only the command + natural-language SOS scenario without secrets or Telegram access:

```bash
pnpm e2e:telegram:dry-run:natural-sos
```

To inspect only the family reunification scenario without secrets or Telegram access:

```bash
pnpm e2e:telegram:dry-run:family-reunification
```

## Run the real staging test

```bash
pnpm e2e:staging:telegram
```

The test sends a safe sequence to the bot: `/start` incident join, language selection, command-oriented `/workcenter` report, natural-language work-center report (`Hay un puesto médico {marker} en la escuela con prioridad alta y necesitan medicamentos.`), explicit `/resource` report, and natural-language resource report. Work-center and resource flows must reach a summary and explicit confirmation before persistence. For the natural work-center step, the runner checks the staging API before sending `yes` when running against real staging, then the Playwright test verifies the marker after confirmation via `E2E_WEB_UI_URL` or API fallback. If the marker is not visible in the UI, the test falls back to staging API reads for work centers and resource reports.

To target only the natural SOS coverage in staging:

```bash
pnpm e2e:staging:telegram --grep "natural sos"
```

The natural SOS scenario resets any pending bot flow, joins the demo incident, sets Spanish with `/idioma es`, sends a natural Spanish SOS phrase like `Necesito ayuda médica urgente en el refugio norte. Hay humo y 3 personas afectadas.`, selects the incident, verifies that a weak `confirm` reply is rejected with an exact `CONFIRM SOS` requirement, and only then sends `CONFIRM SOS`. The bot should show the localized safe summary from normalized facts only in the initial natural-message reply. Those extracted details are not persisted in Telegram SOS conversation state, are not repeated after incident selection, and the textual location hint must not become an exact SOS payload location.

To target only the family reunification coverage in staging:

```bash
pnpm e2e:staging:telegram --grep "family reunification"
```

The family reunification scenario resets any pending bot flow, sets Spanish with `/idioma es`, covers `/reunificacion`, selects the configured incident, then sends a safe natural-language phrase: `Necesito ayuda de reunificación familiar para encontrar a mi familiar.` The phrase intentionally avoids real PII. The bot should acknowledge family reunification, explain that sensitive details belong in the private web channel rather than Telegram, and issue a private link after incident selection for both command and natural-language paths.

## Sensitive helpers

Additional helpers for `/sos` and `/reunificacion` exist in the default full runner, but they are skipped by default to avoid sensitive mutations. To exercise those helpers deliberately, run the runner directly with the opt-in flag:

```bash
pnpm tsx e2e/telegram/staging-telegram-runner.ts run --include-sensitive-flows
```

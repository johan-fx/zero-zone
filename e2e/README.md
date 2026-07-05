# E2E workflows

This folder contains Playwright E2E coverage and the opt-in real staging Telegram runner.

## Quick path

| Need | Command | Notes |
| --- | --- | --- |
| Run local Playwright E2E | `pnpm e2e` | Uses `playwright.config.ts` and local dev servers. |
| Open Playwright UI | `pnpm e2e:ui` | Useful when debugging local browser flows. |
| Typecheck Telegram E2E helpers | `pnpm e2e:telegram:typecheck` | Safe; no Telegram or staging calls. |
| Run Slice 20 social-trust E2E | `pnpm e2e:slice20:social-trust` | Reduced local flow for trust API lifecycle plus Telegram natural-language dry-run. |
| Run Slice 21 proactive updates E2E | `pnpm e2e:slice21:proactive-updates` | Targeted local API flow plus Telegram proactive-updates dry-run. |
| Preview Telegram staging messages | `pnpm e2e:telegram:dry-run` | Safe; does not contact Telegram. |
| Run real Telegram staging E2E | `pnpm e2e:staging:telegram` | Opt-in; requires local staging config and mutates staging. |

See also:

- `docs/runbooks/testing.md` for the full test-command decision guide.
- `docs/runbooks/telegram-e2e.md` for Telegram auth, safety gates, targeted scenarios, and troubleshooting.

## Local Playwright E2E

The local operational map E2E runs against the default Playwright web servers:

- API: `http://127.0.0.1:8787`
- Web UI: `http://127.0.0.1:5173`
- Web UI API target: `VITE_API_BASE_URL` points at the local API server.

```bash
pnpm exec playwright test e2e/operational-map.spec.ts
```

The test drives the local Telegram webhook by joining the incident as `logistics`, creating a work center through `/workcenter`, sending a native Telegram `message.location`, waiting for `/map?countryCode=ES`, opening `/#/map`, verifying accessible map content, and writing `test-results/operational-map-dashboard.png`.


## Slice 20 social trust E2E

```bash
pnpm e2e:slice20:social-trust
```

This reduced flow runs only `e2e/social-trust.spec.ts`. It covers the command/API trust lifecycle locally by joining web identities, creating a self-declaration, adding peer corroboration, creating a dispute, forcing a degraded state with a negative signal, and asserting sensitive permission fields are not returned or granted by trust responses.

The natural-language path is covered through the deterministic Telegram dry-run scenario `social-trust`. It does not require secrets or mutate staging; it verifies the planned natural wording for contextual corroboration, dispute, and the product boundary that social trust does not grant sensitive permissions or replace coordination/rescue.


## Slice 21 proactive updates E2E

```bash
pnpm e2e:slice21:proactive-updates
pnpm e2e:telegram:dry-run:proactive-updates
```

The targeted local flow runs `e2e/proactive-social-updates.spec.ts`. It creates proactive operational updates through connected resource/SOS API paths, pulls the update inbox for `incident-zc-demo/connected-telegram`, exercises ACK/open/link/corroborate/dispute actions, verifies trust/audit outputs, checks a non-member cannot act, and asserts volunteer permissions are not escalated by social trust or update actions.

The Telegram dry-run scenario `proactive-updates` is safe: it does not contact Telegram or mutate staging. It prints the planned command messages (`/updates`, `/ack`, `/open`, `/corroborate`, `/dispute`) plus natural-language copy that preserves the product boundary: proactive updates provide context only and do not grant sensitive permissions, replace rescue, or assign responders.

No real-staging proactive-updates gate is currently registered. The active Slice 21 gates are the local targeted flow and the Telegram dry-run only; real staging will stay README-tracked until the runner can seed or discover a concrete operational update id before sending action commands.

## Real staging Telegram E2E

The real staging flow is opt-in:

```text
Telegram test account -> @Zona_Cero_Bot -> staging API/D1 -> staging Web UI
```

Configure the local environment in `e2e/telegram-e2e.local`. Do not commit that file, paste its values, or ask another developer to share values in chat, issues, or PRs.

Load local configuration only in the shell that will run the test:

```bash
set -a
source e2e/telegram-e2e.local
set +a
```

### Authenticate once

The runner uses GramJS/MTProto and stores a reusable local session at the configured session-file location. It asks for the Telegram login code and 2FA password only when the session file does not exist.

```bash
pnpm e2e:telegram:auth
```

### Dry-run scenarios

Dry-runs print the planned E2E messages plus a generated marker. They do not contact Telegram and use safe placeholders when local staging config has not been sourced.

| Scenario | Command |
| --- | --- |
| Full planned sequence | `pnpm e2e:telegram:dry-run` |
| Natural SOS | `pnpm e2e:telegram:dry-run:natural-sos` |
| Family reunification | `pnpm e2e:telegram:dry-run:family-reunification` |
| Dispatch | `pnpm e2e:telegram:dry-run:dispatch` |
| Incident join onboarding | `pnpm e2e:telegram:dry-run:incident-join` |
| Slice 20 social trust | `pnpm e2e:telegram:dry-run:social-trust` |
| Slice 21 proactive updates | `pnpm e2e:telegram:dry-run:proactive-updates` |

### Real staging run

```bash
pnpm e2e:staging:telegram
```

The default real staging test sends a safe sequence to the bot: incident join, language selection, command-oriented `/workcenter`, natural-language work-center reporting, explicit `/resource`, and natural-language resource reporting. Work-center and resource flows must reach a summary and explicit confirmation before persistence. If the marker is not visible in the UI, the test falls back to staging API reads for work centers and resource reports.

Targeted real staging runs:

```bash
pnpm e2e:staging:telegram --grep "natural sos"
pnpm e2e:staging:telegram --grep "family reunification"
pnpm e2e:staging:telegram --grep "dispatch"
pnpm e2e:staging:telegram:incident-join
```

### Scenario expectations

| Scenario | What it verifies |
| --- | --- |
| Natural SOS | Resets pending bot flow, joins the demo incident, sets Spanish, rejects weak `confirm`, requires exact `CONFIRM SOS`, and avoids persisting extracted hint text as an exact SOS payload location. |
| Family reunification | Keeps sensitive details out of Telegram and issues a private web link after incident selection for command and natural-language paths. |
| Dispatch | Exercises command or natural-language dispatch coordination while preserving API-owned task validation. |
| Incident join onboarding | Covers explicit `/start` onboarding plus natural-language join. Extracted desired roles remain candidate-only until the human confirms. |
| Proactive updates | Not registered as a real staging gate yet; local API E2E and Telegram dry-run are the active Slice 21 gates until webhook action commands can use a real seeded update id. |

## Sensitive helpers

Additional helpers for `/sos` and `/reunificacion` exist in the default full runner, but they are skipped by default to avoid sensitive mutations. Exercise them only when the staging test account and incident are safe for that run:

```bash
pnpm exec tsx e2e/telegram/staging-telegram-runner.ts run --include-sensitive-flows
```

## Safety rules

- Never commit `e2e/telegram-e2e.local` or a Telegram session file.
- Do not print, paste, or request secret values in logs, issues, PRs, or chat.
- Prefer dry-runs before real staging runs.
- Use targeted `--grep` runs when validating one Telegram scenario.
- Treat real staging runs as mutating: they can send bot messages and write staging records.

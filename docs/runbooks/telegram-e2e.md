# Telegram E2E runbook

Use this runbook when validating Telegram flows against staging. Start with dry-runs; run the real Telegram test only when staging is intentionally configured for mutation.

## Quick path

```bash
pnpm e2e:telegram:typecheck
pnpm e2e:telegram:dry-run:incident-join
pnpm e2e:staging:telegram:incident-join
```

## Local configuration

Configure staging values in `e2e/telegram-e2e.local`. Keep that file local. Do not commit it, paste its values, or request values through chat, issues, or PRs.

Load it only into the shell that will run the helper:

```bash
set -a
source e2e/telegram-e2e.local
set +a
```

## Auth helper

Authenticate the Telegram test account once per local session file:

```bash
pnpm e2e:telegram:auth
```

What happens:

- The helper uses GramJS/MTProto, not the bot webhook.
- It stores the reusable Telegram session at the configured local session-file path.
- It prompts for login code or 2FA only when the session file is missing or expired.
- The session file is local-only and must not be committed.

## Dry-run scenarios

Dry-runs are the safest way to inspect the planned message sequence. They do not contact Telegram.

| Scenario | Command | Use when |
| --- | --- | --- |
| Full sequence | `pnpm e2e:telegram:dry-run` | Checking the default staging flow before a release run. |
| Natural SOS | `pnpm e2e:telegram:dry-run:natural-sos` | Verifying exact confirmation behavior and safe SOS text. |
| Family reunification | `pnpm e2e:telegram:dry-run:family-reunification` | Confirming the flow avoids PII in Telegram and hands off to private web. |
| Dispatch | `pnpm e2e:telegram:dry-run:dispatch` | Checking dispatch coordination messages before touching staging tasks. |
| Incident join | `pnpm e2e:telegram:dry-run:incident-join` | Validating onboarding, pseudonym, role selection, and role confirmation. |

## Real staging run

Run the full staging test only after dry-run output looks correct and staging is safe to mutate:

```bash
pnpm e2e:staging:telegram
```

Target one scenario when debugging:

```bash
pnpm e2e:staging:telegram --grep "natural sos"
pnpm e2e:staging:telegram --grep "family reunification"
pnpm e2e:staging:telegram --grep "dispatch"
pnpm e2e:staging:telegram:incident-join
```

The real run sends messages from the Telegram test account to the configured bot, waits for staging API/D1 side effects, and checks the staging Web UI or API fallback for evidence.

## Safety gates

Before a real run:

- [ ] Local staging config is loaded from `e2e/telegram-e2e.local` in the current shell.
- [ ] The Telegram session file is local and untracked.
- [ ] The selected staging incident and cell are safe for test mutations.
- [ ] Dry-run output matches the scenario you intend to run.
- [ ] You are using a targeted command if only one scenario changed.
- [ ] You will not paste secret values or Telegram login details into logs, issues, PRs, or chat.

After a real run:

- [ ] Confirm the Playwright result and any marker evidence.
- [ ] Capture only non-secret evidence in PR notes.
- [ ] If the run failed, keep the generated marker and scenario name for debugging.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Auth prompts repeatedly | The configured local session file may be missing, expired, or pointing to a different path. Re-run `pnpm e2e:telegram:auth`. |
| Runner cannot find staging config | Load `e2e/telegram-e2e.local` in the same shell before running the command. Do not print the values. |
| Bot replies do not match the expected step | Reset any pending flow with the scenario's reset path, then rerun the targeted dry-run and targeted real test. |
| Marker is not visible in Web UI | The test should fall back to staging API reads. If both fail, inspect whether the API deploy and staging data are current. |
| Natural-language extraction misses optional hints | Treat hints as candidate data only. The runner should provide explicit pseudonym or role values when needed and still require human confirmation. |
| Weak SOS confirmation is accepted | Stop. That is a safety bug: SOS creation must require exact `CONFIRM SOS` in the covered flow. |
| Family reunification asks for sensitive details in Telegram | Stop. The expected path keeps sensitive details in the private web channel. |

## Related docs

- `e2e/README.md` for the local E2E folder overview.
- `docs/runbooks/testing.md` for when to use Telegram E2E versus unit, integration, Playwright, or Maestro tests.
- `apps/telegram-channel/README.md` for the Telegram package boundary and handler pattern.

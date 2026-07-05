# Visual QA runbook

Use visual verification when a change affects layout, colors, map presentation, copy density, responsive behavior, or any user-facing flow where screenshots are better evidence than test logs.

## When to run visual verification

| Change type | Visual check |
|---|---|
| Shared tokens, radii, spacing, colors, or UI primitives | Maestro visual audit and contact sheets |
| Mobile operational screens or visual-audit routes | `pnpm visual:audit:check`, then screenshot capture if the route changed visibly |
| Web UI public/civil screens | Playwright screenshots or E2E report artifacts |
| Map, SOS, help-point, task, or resource surfaces | Visual verification on desktop/mobile or day/night states as applicable |
| Copy changes that can wrap or crowd controls | Screenshot the affected viewport sizes |

## Mobile Maestro visual audit

The repository has two Maestro flows:

| Command | Flow | Purpose |
|---|---|---|
| `pnpm maestro:smoke:ios` | `.maestro/ios-smoke.yaml` | Native operational smoke coverage |
| `pnpm visual:audit:check` | `.maestro/ios-visual-audit.yaml` | Opens visual-audit screens and asserts expected content |

Preconditions:

- iOS Simulator is booted.
- Expo app is available and can open the development route.
- Maestro is installed and can see the simulator.

Run:

```bash
pnpm visual:audit:check
```

This verifies access to the mock-backed visual-audit routes for operational map, selected center, and SOS/outbox states in day and night themes.

## Mobile screenshot capture and contact sheets

Use the visual-regression scripts when reviewers need image evidence against `docs/mockups`.

```bash
pnpm visual:audit:capture
pnpm visual:audit:contact-sheet
```

Artifacts are written under:

| Artifact | Path |
|---|---|
| Current screenshots | `docs/design-system-visual-regression/current/` |
| Mock/current contact sheets | `docs/design-system-visual-regression/contact-sheets/` |
| Contact-sheet audit notes | `docs/design-system-visual-regression/notes.json` |

`docs/design-system-visual-regression/audit-report.md` is a manually maintained summary, not an output of `pnpm visual:audit:contact-sheet`.

If capture fails, check Simulator, Expo, Expo Go/development client routing, and Maestro availability before changing app code.

## Web Playwright screenshots and reports

Use Playwright when the web app or a cross-workspace browser flow changes.

| Command | Purpose |
|---|---|
| `pnpm e2e` | Run local Playwright E2E suite |
| `pnpm e2e:ui` | Debug E2E interactively |
| `pnpm exec playwright test <spec>` | Run a targeted spec |
| `pnpm e2e:staging:telegram` | Run real staging Telegram-to-Web UI flow when secrets are loaded |

Common Playwright artifacts:

- `test-results/` for screenshots, traces, and failure artifacts.
- `playwright-report/` for HTML reports.
- Targeted specs may also write named screenshots such as `test-results/operational-map-dashboard.png`.

Do not commit Playwright reports, traces, or generated screenshots unless a maintainer explicitly asks for a tracked artifact.

## `/output` artifacts

`/output` is an untracked workspace artifact area used for ad-hoc screenshots and reports from agent or manual visual QA.

Rules:

- Treat `/output` as evidence, not source.
- Do not delete, rewrite, stage, commit, or rely on `/output` as the only project record.
- If a finding matters, summarize it in a tracked doc, issue, or PR comment instead of committing the raw artifact.
- When multiple workers are active, assume `/output` may contain someone else's evidence.

## Review checklist

- [ ] Screenshots cover the changed viewport, theme, and state.
- [ ] The evidence path is named in the PR or handoff.
- [ ] Generated artifacts are left untracked unless explicitly requested.
- [ ] Visual differences are classified as pass, warning, or blocker.
- [ ] Fixes happen in shared tokens/primitives before local one-off styles.
- [ ] Contract or data changes that affect visible UI also include functional tests.

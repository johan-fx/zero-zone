# @zona-cero/ui

Shared operational design system for Zona Cero: the tokens (`.`) are framework-agnostic
plain values consumed by `apps/mobile` (via Tamagui/React Native), and the DOM primitives
(`./web`) are consumed by `apps/web-ui` (plain React DOM, no Tamagui dependency).

Extracted from `apps/mobile/src/shared/theme/tokens.ts` once web and mobile needed the same
status-tone palette, radii, and spacing scale — see `docs/design-system-visual-acceptance.md`
and `docs/mockups` for the visual reference these tokens are calibrated against.

## Exports

- `@zona-cero/ui` — `operationalThemePalettes`, `operationalRadii`, `operationalControlHeights`,
  `operationalFontSizes`, `operationalLineHeights`, `operationalSpacing`, `operationalOpacity`,
  `operationalZIndex`, `operationalLayout`, `statusToneLabels`, `statusToneMarkers`, and
  `generateOperationalCss()` / `generateThemeCss()` to turn tokens into `--zc-*` CSS custom
  properties.
- `@zona-cero/ui/web` — `StatusBadge`, `Card`, `SectionHeader`, `MetaRow`: small React DOM
  components styled entirely through the `--zc-*` variables, matching the tone-coded card and
  badge language from the mockups (`operational-map.png`, `recommendations.png`,
  `sos-and-outbox.png`).

## Adding to mobile or web

Both apps consume this via `"@zona-cero/ui": "workspace:*"`. Mobile only needs the root export
(tokens); web-ui needs both the root export (to inject the generated CSS) and `./web` (for the
components).

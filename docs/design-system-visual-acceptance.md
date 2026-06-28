# Zona Cero design system visual acceptance

Use this checklist before adding or approving new operational screens.

## Shape and density

- Buttons use compact operational radius (`control = 12`) unless they are true pills.
- Main cards use operational radius (`card = 18`) and do not look more rounded than the source mockups.
- Bottom panels use a larger but still controlled radius (`panel = 24`).
- Normal actions use 44 px visual height; primary and critical actions use 48 px.
- Internal cards and section surfaces keep compact padding; avoid inflated nested cards.

## Surfaces and hierarchy

- Day mode keeps a stable light background with white elevated cards and visible borders.
- Night mode keeps a dark background with cards visibly lighter than the screen background.
- Shadows are subtle; separation should come primarily from surface, border, and hierarchy.
- Map/panel proportion should preserve the intent of the operational-map and selected-center mocks.

## Operational states

- SOS, warning, success, stale, pending, and conflict must be distinguishable by label/marker plus color.
- Status badges must always include a marker and readable text.
- Critical actions must not rely only on red fill; the label must describe the action.

## Implementation rules

- Screens must not hardcode colors, radius, or shadow values.
- New screens must compose existing tokens, primitives, or compound patterns first.
- If a visual pattern repeats twice, promote it to the design system before adding a third copy.
- Use `docs/mockups` as the visual reference for operational density, spacing, and hierarchy.

## Reference screens

- `docs/mockups/screens/operational-map.png`
- `docs/mockups/day-mode/operational-map-day-v2.png`
- `docs/mockups/screens/selected-center-panel.png`
- `docs/mockups/day-mode/selected-center-panel-day-v2.png`
- `docs/mockups/screens/sos-and-outbox.png`
- `docs/mockups/day-mode/sos-and-outbox-day-v2.png`

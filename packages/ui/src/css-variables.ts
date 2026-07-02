import {
  operationalControlHeights,
  operationalFontSizes,
  operationalLayout,
  operationalLineHeights,
  operationalOpacity,
  operationalRadii,
  operationalSpacing,
  operationalThemePalettes,
  operationalZIndex,
  type OperationalThemeName,
} from './tokens';

/**
 * Converts camelCase token keys (e.g. `surfaceMuted`) into kebab-case CSS
 * custom property fragments (e.g. `surface-muted`).
 */
function kebabCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function toCssLines(prefix: string, values: Record<string, number>, unit: string): string[] {
  return Object.entries(values).map(([key, value]) => `  --zc-${prefix}-${kebabCase(key)}: ${value}${unit};`);
}

/**
 * CSS custom properties for a single theme's color palette, e.g.
 * `--zc-color-background`, `--zc-color-sos`, `--zc-color-sos-surface`.
 */
export function generateThemeCss(themeName: OperationalThemeName): string {
  const palette = operationalThemePalettes[themeName];
  return Object.entries(palette)
    .map(([key, value]) => `  --zc-color-${kebabCase(key)}: ${value};`)
    .join('\n');
}

/**
 * Theme-independent scale variables shared by both palettes: radii, control
 * heights, type scale, spacing, opacity, z-index, and layout constants.
 */
function generateScaleCss(): string {
  return [
    ...toCssLines('radius', operationalRadii, 'px'),
    ...toCssLines('height', operationalControlHeights, 'px'),
    ...toCssLines('font', operationalFontSizes, 'px'),
    ...toCssLines('line', operationalLineHeights, 'px'),
    ...toCssLines('space', operationalSpacing, 'px'),
    ...toCssLines('opacity', operationalOpacity, ''),
    ...toCssLines('z', operationalZIndex, ''),
    `  --zc-border-width: ${operationalLayout.borderWidth}px;`,
    `  --zc-min-touch-target: ${operationalLayout.minTouchTarget}px;`,
  ].join('\n');
}

/**
 * Full stylesheet text exposing every token as a `--zc-*` CSS custom
 * property. Defaults to the dark (night) palette on `:root`, since Zona
 * Cero's operational surfaces default to night mode, and exposes the light
 * (day) palette under `[data-zc-theme="light"]` for an eventual toggle.
 * Consumers inject this once (e.g. in a top-level `<style>` tag) instead of
 * hardcoding colors/radii in app-level stylesheets.
 */
export function generateOperationalCss(): string {
  return [
    ':root, [data-zc-theme="dark"] {',
    generateThemeCss('dark'),
    generateScaleCss(),
    '}',
    '',
    '[data-zc-theme="light"] {',
    generateThemeCss('light'),
    '}',
  ].join('\n');
}

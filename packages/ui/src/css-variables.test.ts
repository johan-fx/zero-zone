import { describe, expect, it } from 'vitest';

import { generateCivilThemeCss, generateOperationalCss, generateThemeCss } from './css-variables';

describe('generateThemeCss', () => {
  it('emits kebab-case custom properties for every palette color', () => {
    const css = generateThemeCss('dark');
    expect(css).toContain('--zc-color-background: #07111F;');
    expect(css).toContain('--zc-color-surface-muted: #12263A;');
    expect(css).toContain('--zc-color-sos-surface: #3A070A;');
  });
});

describe('generateCivilThemeCss', () => {
  it('emits handoff-compatible civil custom properties', () => {
    const css = generateCivilThemeCss('dark');
    expect(css).toContain('--canvas: #07111F;');
    expect(css).toContain('--surface2: #12263A;');
    expect(css).toContain('--accent-ink: #F8FAFC;');
    expect(css).toContain('--dangerbg: #3A070A;');
    expect(css).toContain('--maproad: #60A5FA;');
  });
});

describe('generateOperationalCss', () => {
  it('defaults :root to the dark palette and scopes light under legacy and civil data attributes', () => {
    const css = generateOperationalCss();
    expect(css).toMatch(/:root, \[data-zc-theme="dark"\], \[data-theme="noche"\] \{[\s\S]*--zc-color-background: #07111F;/);
    expect(css).toMatch(/:root, \[data-zc-theme="dark"\], \[data-theme="noche"\] \{[\s\S]*--canvas: #07111F;/);
    expect(css).toMatch(/\[data-zc-theme="light"\], \[data-theme="dia"\] \{[\s\S]*--zc-color-background: #EEF3F7;/);
    expect(css).toMatch(/\[data-zc-theme="light"\], \[data-theme="dia"\] \{[\s\S]*--canvas: #EEF3F7;/);
  });

  it('includes every civil variable name required by the web-ui handoff', () => {
    const css = generateOperationalCss();
    const civilVariables = [
      '--canvas',
      '--bg',
      '--surface',
      '--surface2',
      '--ink',
      '--ink2',
      '--line',
      '--linestrong',
      '--accent',
      '--accent-ink',
      '--ok',
      '--okbg',
      '--warn',
      '--warnbg',
      '--danger',
      '--dangerbg',
      '--info',
      '--infobg',
      '--map',
      '--mapline',
      '--maproad',
    ];

    for (const variableName of civilVariables) {
      expect(css).toContain(`${variableName}:`);
    }
  });

  it('includes theme-independent scale tokens once', () => {
    const css = generateOperationalCss();
    expect(css).toContain('--zc-radius-card: 18px;');
    expect(css).toContain('--zc-radius-pill: 999px;');
    expect(css).toContain('--zc-height-critical-action: 48px;');
    expect((css.match(/--zc-radius-card:/g) ?? []).length).toBe(1);
  });
});

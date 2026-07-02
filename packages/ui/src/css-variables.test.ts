import { describe, expect, it } from 'vitest';

import { generateOperationalCss, generateThemeCss } from './css-variables';

describe('generateThemeCss', () => {
  it('emits kebab-case custom properties for every palette color', () => {
    const css = generateThemeCss('dark');
    expect(css).toContain('--zc-color-background: #07111F;');
    expect(css).toContain('--zc-color-surface-muted: #12263A;');
    expect(css).toContain('--zc-color-sos-surface: #3A070A;');
  });
});

describe('generateOperationalCss', () => {
  it('defaults :root to the dark palette and scopes light under a data attribute', () => {
    const css = generateOperationalCss();
    expect(css).toMatch(/:root, \[data-zc-theme="dark"\] \{[\s\S]*--zc-color-background: #07111F;/);
    expect(css).toMatch(/\[data-zc-theme="light"\] \{[\s\S]*--zc-color-background: #EEF3F7;/);
  });

  it('includes theme-independent scale tokens once', () => {
    const css = generateOperationalCss();
    expect(css).toContain('--zc-radius-card: 18px;');
    expect(css).toContain('--zc-radius-pill: 999px;');
    expect(css).toContain('--zc-height-critical-action: 48px;');
    expect((css.match(/--zc-radius-card:/g) ?? []).length).toBe(1);
  });
});

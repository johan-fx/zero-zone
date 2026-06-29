/// <reference types="jest" />
import { resolveOperationalTheme } from './OperationalThemeProvider';

describe('resolveOperationalTheme', () => {
  it('uses the explicit day preference over the system scheme', () => {
    expect(resolveOperationalTheme('day', 'dark')).toBe('light');
  });

  it('uses the explicit night preference over the system scheme', () => {
    expect(resolveOperationalTheme('night', 'light')).toBe('dark');
  });

  it('falls back to light when system preference is not dark', () => {
    expect(resolveOperationalTheme('system', 'unspecified')).toBe('light');
  });
});

import { describe, expect, it } from 'vitest';

import { assertCatalogParity, formatMessage, resolveLocaleFromCandidates } from './index';

describe('@zona-cero/i18n', () => {
  it('keeps Spanish and English catalogs key-compatible', () => {
    expect(() => assertCatalogParity()).not.toThrow();
  });

  it('formats ICU messages with canonical locale fallback', () => {
    expect(formatMessage('en-US', 'telegram.sos.success', {
      sosAlertId: 'sos-1',
      status: 'open',
      total: 1,
      queued: 1,
      pending: 0,
      failed: 0,
      cancelled: 0,
    })).toContain('SOS ID: sos-1');
    expect(formatMessage('ca', 'web.sos.submit')).toBe('Enviar SOS');
  });

  it('resolves the first supported locale candidate', () => {
    expect(resolveLocaleFromCandidates([null, 'en-US', 'es'])).toBe('en');
    expect(resolveLocaleFromCandidates([null, 'ca'])).toBe('es');
  });
});

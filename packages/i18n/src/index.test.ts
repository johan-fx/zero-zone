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

  it('formats incident join candidate-only safety copy in both locales', () => {
    expect(formatMessage('en', 'telegram.join.role.candidate', { desiredRole: 'medical', roleList: '1. volunteer' })).toContain('only a candidate');
    expect(formatMessage('en', 'telegram.join.role.candidate', { desiredRole: 'medical', roleList: '1. volunteer' })).toContain('backend will validate');
    expect(formatMessage('es', 'telegram.join.role.candidate', { desiredRole: 'medical', roleList: '1. volunteer' })).toContain('solo un candidato');
    expect(formatMessage('es', 'telegram.join.role.candidate', { desiredRole: 'medical', roleList: '1. volunteer' })).toContain('backend validará');
  });
});

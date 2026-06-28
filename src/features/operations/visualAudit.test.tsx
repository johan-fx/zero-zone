/// <reference types="jest" />

import { resolveVisualAuditScreenId, resolveVisualAuditThemeId, visualAuditScreenConfigs } from './visualAudit';

describe('visual audit route configuration', () => {
  it('resolves supported screen ids and falls back to the operational map', () => {
    expect(resolveVisualAuditScreenId('selected-center')).toBe('selected-center');
    expect(resolveVisualAuditScreenId('sos-outbox')).toBe('sos-outbox');
    expect(resolveVisualAuditScreenId('unknown')).toBe('operational-map');
  });

  it('resolves day/night themes and defaults to day', () => {
    expect(resolveVisualAuditThemeId('night')).toBe('night');
    expect(resolveVisualAuditThemeId('day')).toBe('day');
    expect(resolveVisualAuditThemeId(undefined)).toBe('day');
  });

  it('defines stable expected text for every capture target', () => {
    expect(visualAuditScreenConfigs['operational-map'].expectedText).toBe('Available');
    expect(visualAuditScreenConfigs['selected-center'].expectedText).toBe('Escuela Norte');
    expect(visualAuditScreenConfigs['sos-outbox'].expectedText).toBe('SOS raised');
  });
});

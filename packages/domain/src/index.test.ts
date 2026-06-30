import { describe, expect, it } from 'vitest';

import {
  canAccessRestrictedIncidentData,
  canChannelSubmitOperation,
  deriveWorkCenterActivationState,
  deriveWorkCenterConfidence,
  deriveWorkCenterFreshness,
  deriveWorkCenterRisk,
  deriveWorkCenterState,
  isCriticalOperation,
} from './index';

describe('domain package', () => {
  it('keeps sensitive permissions behind org verification', () => {
    expect(canAccessRestrictedIncidentData('field_attested')).toBe(false);
    expect(canAccessRestrictedIncidentData('org_verified')).toBe(true);
  });

  it('prevents web-ui from inventing native presence operations', () => {
    expect(canChannelSubmitOperation('web-ui', 'presence.check_in')).toBe(false);
    expect(canChannelSubmitOperation('telegram', 'resource_report.create')).toBe(true);
  });

  it('marks SOS as a critical operation family', () => {
    expect(isCriticalOperation('sos.create')).toBe(true);
  });

  it('does not activate a work center from one weak signal', () => {
    expect(deriveWorkCenterActivationState([{ signalType: 'creator_report', sourceId: 'telegram-user-1' }])).toBe('pending_corroboration');
  });

  it('activates a work center only after corroborating signal types', () => {
    expect(
      deriveWorkCenterState({
        signals: [
          { signalType: 'creator_report', sourceId: 'telegram-user-1' },
          { signalType: 'presence_check_in', sourceId: 'mobile-device-1' },
        ],
        updatedAt: '2026-06-30T10:00:00.000Z',
        now: new Date('2026-06-30T11:00:00.000Z'),
        priority: 'medium',
      }),
    ).toMatchObject({
      status: 'active',
      activationState: 'active',
      freshness: 'fresh',
      confidence: 'medium',
      risk: 'low',
      signalCount: 2,
      corroboratingSignalCount: 2,
    });
  });

  it('derives freshness confidence and risk deterministically', () => {
    expect(deriveWorkCenterFreshness('2026-06-27T10:00:00.000Z', new Date('2026-06-30T11:00:00.000Z'))).toBe('expired');
    expect(deriveWorkCenterConfidence({ activationState: 'active', corroboratingSignalCount: 3 })).toBe('high');
    expect(deriveWorkCenterRisk({ confidence: 'low', freshness: 'fresh', priority: 'critical' })).toBe('high');
  });
});

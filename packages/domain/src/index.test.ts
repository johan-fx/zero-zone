import { describe, expect, it } from 'vitest';
import type { ResourceReportSummary } from '@zona-cero/contracts';

import {
  canAccessRestrictedIncidentData,
  canChannelSubmitOperation,
  deriveWorkCenterActivationState,
  deriveWorkCenterConfidence,
  deriveWorkCenterFreshness,
  deriveWorkCenterRisk,
  deriveResourceReportState,
  deriveWorkCenterState,
  matchResourceReports,
  normalizeResourceCategory,
  recommendResourceNeeds,
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

  it('derives resource report freshness confidence and risk', () => {
    expect(
      deriveResourceReportState({
        updatedAt: '2026-06-30T10:00:00.000Z',
        now: new Date('2026-06-30T11:00:00.000Z'),
        reportKind: 'needed',
        urgency: 'critical',
        constraints: ['cold chain'],
      }),
    ).toEqual({ freshness: 'fresh', confidence: 'medium', risk: 'medium' });
  });

  it('matches needed and surplus reports by incident cell and category', () => {
    const base = {
      incidentId: 'incident-zc-demo',
      cellId: 'cell-a',
      category: 'Water',
      quantityApprox: '20 boxes',
      urgency: 'high' as const,
      constraints: [] as string[],
      freshness: 'fresh' as const,
      confidence: 'medium' as const,
      risk: 'medium' as const,
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
    };

    const reports: ResourceReportSummary[] = [
      { ...base, resourceReportId: 'need-1', reportKind: 'needed' },
      { ...base, resourceReportId: 'surplus-1', category: 'water', reportKind: 'surplus' },
      { ...base, resourceReportId: 'surplus-2', cellId: 'cell-b', reportKind: 'surplus' },
    ];
    const matches = matchResourceReports(reports);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ need: { resourceReportId: 'need-1' }, surplus: { resourceReportId: 'surplus-1' }, reasons: ['same_cell', 'same_category'] });
  });

  it('normalizes frequent resource category synonyms deterministically', () => {
    expect(normalizeResourceCategory('medicamentos')).toBe('medicine');
    expect(normalizeResourceCategory('medicina')).toBe('medicine');
    expect(normalizeResourceCategory('fármacos')).toBe('medicine');
    expect(normalizeResourceCategory('agua potable')).toBe('water');
    expect(normalizeResourceCategory('alimentos')).toBe('food');
  });

  it('recommends needed reports by normalized category with deterministic ranking', () => {
    const base = {
      incidentId: 'incident-zc-demo',
      cellId: 'cell-a',
      category: 'medicina',
      quantityApprox: '10 boxes',
      constraints: [] as string[],
      reportKind: 'needed' as const,
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
    };

    const recommendations = recommendResourceNeeds({
      resourceLabel: 'medicamentos',
      needs: [
        {
          ...base,
          resourceReportId: 'need-medium-work-center',
          workCenterId: 'wc-medical',
          urgency: 'medium',
          freshness: 'fresh',
          confidence: 'high',
          risk: 'low',
        },
        {
          ...base,
          resourceReportId: 'need-critical-stale',
          category: 'fármacos',
          urgency: 'critical',
          freshness: 'stale',
          confidence: 'medium',
          risk: 'medium',
        },
        {
          ...base,
          resourceReportId: 'need-high-food',
          category: 'food',
          urgency: 'high',
          freshness: 'fresh',
          confidence: 'high',
          risk: 'low',
        },
      ],
    });

    expect(recommendations.map((recommendation) => recommendation.need.resourceReportId)).toEqual([
      'need-critical-stale',
      'need-medium-work-center',
    ]);
    expect(recommendations[0]).toMatchObject({ normalizedCategory: 'medicine', reasons: expect.arrayContaining(['same_category', 'urgency_critical']) });
    expect(recommendations[1]?.reasons).toContain('linked_work_center');
  });


});

import { describe, expect, it, vi } from 'vitest';

import {
  DispatchTaskConnectedUpdateRequestSchema,
  DispatchTaskListResponseSchema,
  DispatchTaskResponseSchema,
  HealthResponseSchema,
  OperationalUpdateActionResponseSchema,
  OperationalUpdatePullResponseSchema,
  ResourceReportListResponseSchema,
  SosAlertCreateResponseSchema,
  SosAlertStatusResponseSchema,
  SosConnectedCreateRequestSchema,
  TrustSignalCreateRequestSchema,
  TrustSignalCreateResponseSchema,
  TrustStateResponseSchema,
  WorkCenterConnectedCreateRequestSchema,
  WorkCenterCreateResponseSchema,
  WorkCenterDetailResponseSchema,
  WorkCenterListResponseSchema,
} from '@zona-cero/contracts';
import {
  webWorkCenterCreateRequestFixture,
  sosAlertCreateResponseHappyFixture,
  sosAlertStatusHappyFixture,
  telegramSosCreateRequestFixture,
  workCenterCreateResponseHappyFixture,
  workCenterDetailHappyFixture,
  workCenterListHappyFixture,
} from '../../../packages/testing/src';
import { acknowledgeOperationalUpdate, createDispute, createOperationalUpdateLink, createSosAlert, createTrustSignal, createWorkCenter, fetchApiHealth, fetchDispatchTasks, fetchOperationalUpdates, fetchResourceReports, fetchSosStatus, fetchTrustState, fetchWorkCenterDetail, fetchWorkCenters, updateDispatchTask } from './api';


const resourceReportListFixture = {
  resourceReports: [
    {
      resourceReportId: 'resource-needed-water',
      incidentId: 'incident-zc-demo',
      cellId: 'cell-zc-demo',
      workCenterId: 'center-north-triage',
      category: 'water',
      quantityApprox: '20 bottles',
      urgency: 'high',
      constraints: ['sealed bottles'],
      reportKind: 'needed',
      freshness: 'fresh',
      confidence: 'low',
      risk: 'medium',
      sourceChannel: 'telegram',
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
    },
  ],
} as const;

const dispatchTaskListFixture = {
  dispatchTasks: [
    {
      dispatchTaskId: 'dispatch-task-water-1',
      incidentId: 'incident-zc-demo',
      cellId: 'cell-zc-demo',
      category: 'water',
      quantityApprox: '20 bottles',
      fromResourceReportId: 'resource-surplus-water',
      toResourceReportId: 'resource-needed-water',
      targetWorkCenterId: 'center-north-triage',
      status: 'pending',
      notes: 'Use sealed bottles',
      sourceChannel: 'web-ui',
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
    },
  ],
} as const;

const dispatchTaskResponseFixture = {
  dispatchTask: { ...dispatchTaskListFixture.dispatchTasks[0], status: 'accepted', updatedAt: '2026-06-30T10:05:00.000Z' },
  audit: { auditEventId: 'audit_dispatch_task_updated' },
  idempotent: false,
} as const;

const trustStateFixture = {
  incidentId: 'incident-zc-demo',
  subject: {
    entityType: 'work_center',
    entityId: 'center-north-triage',
    incidentId: 'incident-zc-demo',
    displayRef: 'North triage point',
  },
  status: 'trusted_by_context',
  visibility: 'normal',
  priorityWeight: 0.7,
  score: 0.84,
  explanation: ['Canonical server trust state.'],
  signalCount: 2,
  disputeCount: 0,
  updatedAt: '2026-07-05T10:00:00.000Z',
} as const;

const trustSignalCreateResponseFixture = {
  trustSignal: {
    trustSignalId: 'trust-signal-web-1',
    incidentId: 'incident-zc-demo',
    subject: trustStateFixture.subject,
    signalType: 'context_corroboration',
    sourceKind: 'peer',
    sourceChannel: 'web-ui',
    sourceExternalId: 'web-user-1001',
    confidence: 0.5,
    createdAt: '2026-07-05T10:01:00.000Z',
  },
  trustState: trustStateFixture,
  audit: { auditEventId: 'audit_trust_signal_created' },
  idempotent: false,
} as const;

const disputeCreateResponseFixture = {
  dispute: {
    disputeId: 'dispute-web-1',
    incidentId: 'incident-zc-demo',
    subject: trustStateFixture.subject,
    reason: 'other',
    sourceChannel: 'web-ui',
    sourceExternalId: 'web-user-1001',
    description: 'Needs local follow-up.',
    createdAt: '2026-07-05T10:02:00.000Z',
  },
  trustState: { ...trustStateFixture, status: 'disputed', disputeCount: 1 },
  audit: { auditEventId: 'audit_dispute_created' },
  idempotent: false,
} as const;

const operationalUpdateFixture = {
  updateId: 'upd-sos-1',
  incidentId: 'incident-zc-demo',
  cellId: 'cell-zc-demo',
  type: 'sos_alert',
  urgency: 'critical',
  title: 'Critical SOS nearby',
  summary: 'A critical SOS was reported near this cell.',
  source: { kind: 'sos_alert', entityId: 'sos-public-1' },
  subject: {
    entityType: 'sos_alert',
    entityId: 'sos-public-1',
    incidentId: 'incident-zc-demo',
    displayRef: 'SOS public ref',
  },
  actions: [
    { type: 'ack', label: 'Acknowledge' },
    { type: 'link', label: 'Open detail' },
  ],
  delivery: { channel: 'web-ui', status: 'pending', attemptCount: 0 },
  createdAt: '2026-07-05T12:00:00.000Z',
  updatedAt: '2026-07-05T12:00:00.000Z',
  metadata: { confidence: 0.78 },
} as const;

const operationalUpdateReceiptFixture = {
  actionId: 'act-ack-1',
  updateId: 'upd-sos-1',
  actionType: 'ack',
  status: 'accepted',
  idempotent: false,
  createdAt: '2026-07-05T12:01:00.000Z',
} as const;

describe('web ui contract integration', () => {
  it('parses API health through the shared health contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ service: 'zona-cero-api', ok: true, version: 'integration' }));

    await expect(fetchApiHealth(fetcher)).resolves.toEqual(HealthResponseSchema.parse({ service: 'zona-cero-api', ok: true, version: 'integration' }));
  });

  it('parses work center list/detail/create responses through shared schemas', async () => {
    expect(WorkCenterListResponseSchema.parse(workCenterListHappyFixture).workCenters[0]?.risk).toBe('medium');
    expect(WorkCenterDetailResponseSchema.parse(workCenterDetailHappyFixture).workCenter.latestSignals).toHaveLength(1);
    expect(WorkCenterConnectedCreateRequestSchema.parse(webWorkCenterCreateRequestFixture).channel).toBe('web-ui');
    expect(WorkCenterCreateResponseSchema.parse(workCenterCreateResponseHappyFixture).workCenter.activationState).toBe('pending_corroboration');
  });

  it('fetches work center list and detail from the API client endpoints', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(workCenterListHappyFixture))
      .mockResolvedValueOnce(jsonResponse(workCenterDetailHappyFixture));

    await expect(fetchWorkCenters('incident-zc-demo', fetcher)).resolves.toEqual(workCenterListHappyFixture);
    await expect(fetchWorkCenterDetail('incident-zc-demo', 'center-north-triage', fetcher)).resolves.toEqual(workCenterDetailHappyFixture);

    expect(fetcher).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:8787/incidents/incident-zc-demo/work-centers');
    expect(fetcher).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:8787/incidents/incident-zc-demo/work-centers/center-north-triage');
  });



  it('fetches resource reports and dispatch tasks from canonical API endpoints', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(resourceReportListFixture))
      .mockResolvedValueOnce(jsonResponse(dispatchTaskListFixture))
      .mockResolvedValueOnce(jsonResponse(dispatchTaskResponseFixture));

    await expect(fetchResourceReports('incident-zc-demo', fetcher)).resolves.toEqual(ResourceReportListResponseSchema.parse(resourceReportListFixture));
    await expect(fetchDispatchTasks('incident-zc-demo', fetcher)).resolves.toEqual(DispatchTaskListResponseSchema.parse(dispatchTaskListFixture));
    await expect(updateDispatchTask('incident-zc-demo', 'dispatch-task-water-1', { channel: 'web-ui', externalId: 'web-user-1001', status: 'accepted' }, fetcher)).resolves.toEqual(DispatchTaskResponseSchema.parse(dispatchTaskResponseFixture));

    expect(fetcher).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:8787/incidents/incident-zc-demo/resource-reports');
    expect(fetcher).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:8787/incidents/incident-zc-demo/dispatch-tasks');
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:8787/incidents/incident-zc-demo/dispatch-tasks/dispatch-task-water-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(DispatchTaskConnectedUpdateRequestSchema.parse(JSON.parse(String(vi.mocked(fetcher).mock.calls[2]?.[1]?.body))).status).toBe('accepted');
  });

  it('validates create requests with WorkCenterConnectedCreateRequestSchema before posting', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(workCenterCreateResponseHappyFixture));

    await expect(createWorkCenter('incident-zc-demo', webWorkCenterCreateRequestFixture, fetcher)).resolves.toEqual(
      workCenterCreateResponseHappyFixture,
    );

    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:8787/incidents/incident-zc-demo/work-centers',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(webWorkCenterCreateRequestFixture) }),
    );
  });

  it('fetches and creates SOS alerts through shared schemas', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(sosAlertStatusHappyFixture))
      .mockResolvedValueOnce(jsonResponse(sosAlertCreateResponseHappyFixture));

    await expect(fetchSosStatus('incident-zc-demo', fetcher)).resolves.toEqual(SosAlertStatusResponseSchema.parse(sosAlertStatusHappyFixture));
    await expect(createSosAlert('incident-zc-demo', telegramSosCreateRequestFixture, fetcher)).resolves.toEqual(
      SosAlertCreateResponseSchema.parse(sosAlertCreateResponseHappyFixture),
    );

    expect(fetcher).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:8787/incidents/incident-zc-demo/sos');
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8787/incidents/incident-zc-demo/sos',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(SosConnectedCreateRequestSchema.parse(telegramSosCreateRequestFixture)) }),
    );
  });

  it('fetches trust state and posts trust/dispute actions through canonical endpoints', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ trustState: trustStateFixture }))
      .mockResolvedValueOnce(jsonResponse(trustSignalCreateResponseFixture))
      .mockResolvedValueOnce(jsonResponse(disputeCreateResponseFixture));
    const trustRequest = TrustSignalCreateRequestSchema.parse({
      channel: 'web-ui',
      externalId: 'web-user-1001',
      subject: trustStateFixture.subject,
      signalType: 'context_corroboration',
      sourceKind: 'peer',
    });

    await expect(fetchTrustState('incident-zc-demo', trustStateFixture.subject, fetcher)).resolves.toEqual(
      TrustStateResponseSchema.parse({ trustState: trustStateFixture }),
    );
    await expect(createTrustSignal('incident-zc-demo', trustRequest, fetcher)).resolves.toEqual(
      TrustSignalCreateResponseSchema.parse(trustSignalCreateResponseFixture),
    );
    await expect(createDispute('incident-zc-demo', {
      channel: 'web-ui',
      externalId: 'web-user-1001',
      subject: trustStateFixture.subject,
      reason: 'other',
      description: 'Needs local follow-up.',
    }, fetcher)).resolves.toEqual(disputeCreateResponseFixture);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8787/incidents/incident-zc-demo/trust-state?entityType=work_center&entityId=center-north-triage',
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8787/incidents/incident-zc-demo/trust-signals',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(trustRequest) }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:8787/incidents/incident-zc-demo/disputes',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fetches operational updates and posts safe update actions through canonical endpoints', async () => {
    const pullResponse = { updates: [operationalUpdateFixture], cursor: null, hasMore: false };
    const ackResponse = {
      update: { ...operationalUpdateFixture, delivery: { channel: 'web-ui', status: 'acked', attemptCount: 1, deliveredAt: '2026-07-05T12:00:30.000Z', readAt: '2026-07-05T12:00:45.000Z', ackedAt: '2026-07-05T12:01:00.000Z' } },
      action: operationalUpdateReceiptFixture,
    };
    const linkResponse = {
      update: operationalUpdateFixture,
      action: { ...operationalUpdateReceiptFixture, actionType: 'link' },
      link: {
        href: '/operational-updates/private-detail#token=opaque&scope=operational_update.detail&correlationId=corr-update',
        scope: 'operational_update.detail',
        expiresAt: '2026-07-05T12:16:00.000Z',
      },
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pullResponse))
      .mockResolvedValueOnce(jsonResponse(ackResponse))
      .mockResolvedValueOnce(jsonResponse(linkResponse));

    await expect(fetchOperationalUpdates('incident-zc-demo', 'cell-zc-demo', { limit: 5, channel: 'web-ui', externalId: 'web-user-1001' }, fetcher)).resolves.toEqual(
      OperationalUpdatePullResponseSchema.parse(pullResponse),
    );
    await expect(acknowledgeOperationalUpdate('incident-zc-demo', 'upd-sos-1', {
      channel: 'web-ui',
      externalId: 'web-user-1001',
      idempotencyKey: 'ack-1',
    }, fetcher)).resolves.toEqual(OperationalUpdateActionResponseSchema.parse(ackResponse));
    await expect(createOperationalUpdateLink('incident-zc-demo', 'upd-sos-1', {
      channel: 'web-ui',
      externalId: 'web-user-1001',
      returnState: 'web-ui:update:upd-sos-1',
    }, fetcher)).resolves.toEqual(linkResponse);

    expect(fetcher).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:8787/incidents/incident-zc-demo/cells/cell-zc-demo/updates?limit=5&channel=web-ui&externalId=web-user-1001');
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8787/incidents/incident-zc-demo/updates/upd-sos-1/ack',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      'http://127.0.0.1:8787/incidents/incident-zc-demo/updates/upd-sos-1/links',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

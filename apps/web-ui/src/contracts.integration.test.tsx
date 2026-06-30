import { describe, expect, it, vi } from 'vitest';

import {
  DispatchTaskConnectedUpdateRequestSchema,
  DispatchTaskListResponseSchema,
  DispatchTaskResponseSchema,
  HealthResponseSchema,
  ResourceReportListResponseSchema,
  WorkCenterConnectedCreateRequestSchema,
  WorkCenterCreateResponseSchema,
  WorkCenterDetailResponseSchema,
  WorkCenterListResponseSchema,
} from '@zona-cero/contracts';
import {
  webWorkCenterCreateRequestFixture,
  workCenterCreateResponseHappyFixture,
  workCenterDetailHappyFixture,
  workCenterListHappyFixture,
} from '../../../packages/testing/src';
import { createWorkCenter, fetchApiHealth, fetchDispatchTasks, fetchResourceReports, fetchWorkCenterDetail, fetchWorkCenters, updateDispatchTask } from './api';


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
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

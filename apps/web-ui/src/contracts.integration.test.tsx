import { describe, expect, it, vi } from 'vitest';

import {
  HealthResponseSchema,
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
import { createWorkCenter, fetchApiHealth, fetchWorkCenterDetail, fetchWorkCenters } from './api';

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

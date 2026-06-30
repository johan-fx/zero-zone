import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DispatchTaskListResponse, DispatchTaskResponse, ResourceReportListResponse, SosAlertCreateResponse, SosAlertStatusResponse } from '@zona-cero/contracts';
import { sosAlertCreateResponseHappyFixture, sosAlertStatusHappyFixture, workCenterDetailHappyFixture, workCenterListHappyFixture } from '../../../packages/testing/src';
import { App } from './App';


const resourceReportListFixture: ResourceReportListResponse = {
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
    {
      resourceReportId: 'resource-surplus-blankets',
      incidentId: 'incident-zc-demo',
      cellId: 'cell-zc-demo',
      category: 'blankets',
      quantityApprox: '10 boxes',
      urgency: 'medium',
      constraints: [],
      reportKind: 'surplus',
      freshness: 'fresh',
      confidence: 'medium',
      risk: 'low',
      sourceChannel: 'web-ui',
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
    },
  ],
};

const dispatchTaskListFixture: DispatchTaskListResponse = {
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
};

const dispatchTaskResponseFixture: DispatchTaskResponse = {
  dispatchTask: { ...dispatchTaskListFixture.dispatchTasks[0]!, status: 'accepted', updatedAt: '2026-06-30T10:05:00.000Z' },
  audit: { auditEventId: 'audit_dispatch_task_updated' },
  idempotent: false,
};

const sosStatusFixture: SosAlertStatusResponse = sosAlertStatusHappyFixture;
const sosCreateFixture: SosAlertCreateResponse = {
  ...sosAlertCreateResponseHappyFixture,
  sosAlert: {
    ...sosAlertCreateResponseHappyFixture.sosAlert,
    sosAlertId: 'sos-web-critical-1',
    sourceChannel: 'web-ui',
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('web ui work center shell', () => {
  it('renders backend health plus work center list, detail and map-lite from shared contracts', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return jsonResponse({ service: 'zona-cero-api', ok: true, version: 'test' });
      }
      if (url.endsWith('/incidents/incident-zc-demo/work-centers')) {
        return jsonResponse(workCenterListHappyFixture);
      }
      if (url.endsWith('/incidents/incident-zc-demo/work-centers/center-north-triage')) {
        return jsonResponse(workCenterDetailHappyFixture);
      }
      if (url.endsWith('/incidents/incident-zc-demo/resource-reports')) {
        return jsonResponse(resourceReportListFixture);
      }
      if (url.endsWith('/incidents/incident-zc-demo/dispatch-tasks')) {
        return jsonResponse(dispatchTaskListFixture);
      }
      if (url.endsWith('/incidents/incident-zc-demo/dispatch-tasks/dispatch-task-water-1')) {
        return jsonResponse(dispatchTaskResponseFixture);
      }
      if (url.endsWith('/incidents/incident-zc-demo/sos')) {
        return jsonResponse(sosStatusFixture);
      }
      return new Response('not found', { status: 404 });
    });

    render(<App />);

    expect(screen.getByRole('heading', { name: /work centers live operations panel/i })).toBeInTheDocument();
    expect(screen.getByText('Loading work centers…')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId('api-health')).toHaveTextContent('zona-cero-api is online'));
    await waitFor(() => expect(screen.getAllByText('North triage point').length).toBeGreaterThan(0));

    expect(screen.getByText('41.3800, 2.1700')).toBeInTheDocument();
    expect(screen.getByText(/Triage and water distribution/)).toBeInTheDocument();
    expect(screen.getByText('creator_report from telegram')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Needs and surplus' })).toBeInTheDocument();
    expect(screen.getByText('20 bottles · Urgency high')).toBeInTheDocument();
    expect(screen.getByText('10 boxes · Urgency medium')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dispatch tasks' })).toBeInTheDocument();
    expect(screen.getByText('20 bottles · Status pending')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connected SOS' })).toBeInTheDocument();
    expect(screen.getByText('SOS ID: sos-mobile-critical-1')).toBeInTheDocument();
    expect(screen.getByText('Status: open · Severity critical')).toBeInTheDocument();
    expect(screen.getByLabelText('SOS backend fan-out status')).toBeInTheDocument();

    const status = screen.getAllByLabelText('North triage point backend status')[0];
    expect(within(status).getByText('reported')).toBeInTheDocument();
    expect(within(status).getByText('pending_corroboration')).toBeInTheDocument();
    expect(within(status).getByText('fresh')).toBeInTheDocument();
    expect(within(status).getByText('low')).toBeInTheDocument();
    expect(within(status).getByText('medium')).toBeInTheDocument();
  });

  it('displays stable API errors for work center loading failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return jsonResponse({ service: 'zona-cero-api', ok: true, version: 'test' });
      }
      return new Response(JSON.stringify({ error: 'permission_denied' }), { status: 403 });
    });

    render(<App />);

    await waitFor(() => expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Work center list failed with status 403'));
  });

  it('displays backend-derived status values without recalculating activation logic', async () => {
    const backendOnlyList = {
      workCenters: [
        {
          ...workCenterListHappyFixture.workCenters[0],
          status: 'active',
          activationState: 'needs_review',
          freshness: 'expired',
          confidence: 'high',
          risk: 'low',
          signalCount: 0,
          corroboratingSignalCount: 0,
        },
      ],
    } as const;
    const backendOnlyDetail = {
      workCenter: {
        ...workCenterDetailHappyFixture.workCenter,
        ...backendOnlyList.workCenters[0],
        latestSignals: [],
      },
    } as const;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return jsonResponse({ service: 'zona-cero-api', ok: true, version: 'test' });
      }
      if (url.endsWith('/incidents/incident-zc-demo/work-centers')) {
        return jsonResponse(backendOnlyList);
      }
      if (url.endsWith('/incidents/incident-zc-demo/resource-reports')) {
        return jsonResponse(resourceReportListFixture);
      }
      if (url.endsWith('/incidents/incident-zc-demo/dispatch-tasks')) {
        return jsonResponse(dispatchTaskListFixture);
      }
      if (url.endsWith('/incidents/incident-zc-demo/sos')) {
        return jsonResponse(sosStatusFixture);
      }
      return jsonResponse(backendOnlyDetail);
    });

    render(<App />);

    await waitFor(() => expect(screen.getAllByText('needs_review').length).toBeGreaterThan(0));
    expect(screen.getAllByText('expired').length).toBeGreaterThan(0);
    expect(screen.getAllByText('high').length).toBeGreaterThan(0);
    expect(screen.getAllByText('low').length).toBeGreaterThan(0);
  });

  it('requires exact SOS confirmation before calling the backend', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/health')) return jsonResponse({ service: 'zona-cero-api', ok: true, version: 'test' });
      if (url.endsWith('/incidents/incident-zc-demo/work-centers')) return jsonResponse(workCenterListHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/work-centers/center-north-triage')) return jsonResponse(workCenterDetailHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/resource-reports')) return jsonResponse(resourceReportListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/dispatch-tasks')) return jsonResponse(dispatchTaskListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/sos') && init?.method === 'POST') return jsonResponse(sosCreateFixture);
      if (url.endsWith('/incidents/incident-zc-demo/sos')) return jsonResponse(sosStatusFixture);
      return new Response('not found', { status: 404 });
    });

    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Connected SOS' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Type CONFIRM SOS to submit'), { target: { value: 'confirm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit SOS' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Type CONFIRM SOS exactly');
    expect(fetcher).not.toHaveBeenCalledWith(
      'http://127.0.0.1:8787/incidents/incident-zc-demo/sos',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('submits SOS and renders the backend acknowledgement honestly', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/health')) return jsonResponse({ service: 'zona-cero-api', ok: true, version: 'test' });
      if (url.endsWith('/incidents/incident-zc-demo/work-centers')) return jsonResponse(workCenterListHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/work-centers/center-north-triage')) return jsonResponse(workCenterDetailHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/resource-reports')) return jsonResponse(resourceReportListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/dispatch-tasks')) return jsonResponse(dispatchTaskListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/sos') && init?.method === 'POST') return jsonResponse(sosCreateFixture);
      if (url.endsWith('/incidents/incident-zc-demo/sos')) return jsonResponse({ sosAlerts: [], fanout: { total: 0, queued: 0, pending: 0, failed: 0, cancelled: 0 } });
      return new Response('not found', { status: 404 });
    });

    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Connected SOS' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Type CONFIRM SOS to submit'), { target: { value: 'CONFIRM SOS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit SOS' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('SOS ID: sos-web-critical-1');
    expect(status).toHaveTextContent('Backend recording only');
    expect(screen.getByText('SOS ID: sos-web-critical-1')).toBeInTheDocument();

    const postCall = fetcher.mock.calls.find(([url, init]) => String(url).endsWith('/incidents/incident-zc-demo/sos') && init?.method === 'POST');
    expect(postCall).toBeDefined();
    const payload = JSON.parse(String(postCall?.[1]?.body)) as { externalId: string; displayName?: string; payload: { reportedAt?: string } };
    expect(payload.externalId).toBe('web-user-1001');
    expect(payload.displayName).toBe('Field Web');
    expect(payload.payload.reportedAt).toEqual(expect.any(String));
  });



  it('blocks duplicate SOS submits while the request is in-flight', async () => {
    let resolvePost: (response: Response) => void = () => undefined;
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/health')) return jsonResponse({ service: 'zona-cero-api', ok: true, version: 'test' });
      if (url.endsWith('/incidents/incident-zc-demo/work-centers')) return jsonResponse(workCenterListHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/work-centers/center-north-triage')) return jsonResponse(workCenterDetailHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/resource-reports')) return jsonResponse(resourceReportListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/dispatch-tasks')) return jsonResponse(dispatchTaskListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/sos') && init?.method === 'POST') {
        return new Promise<Response>((resolve) => {
          resolvePost = resolve;
        });
      }
      if (url.endsWith('/incidents/incident-zc-demo/sos')) return jsonResponse({ sosAlerts: [], fanout: { total: 0, queued: 0, pending: 0, failed: 0, cancelled: 0 } });
      return new Response('not found', { status: 404 });
    });

    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Connected SOS' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Type CONFIRM SOS to submit'), { target: { value: 'CONFIRM SOS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit SOS' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Submitting SOS…' })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Submitting SOS…' }));

    const postCalls = fetcher.mock.calls.filter(([url, init]) => String(url).endsWith('/incidents/incident-zc-demo/sos') && init?.method === 'POST');
    expect(postCalls).toHaveLength(1);

    resolvePost(jsonResponse(sosCreateFixture));
    expect(await screen.findByRole('status')).toHaveTextContent('SOS ID: sos-web-critical-1');
  });

  it('shows SOS backend errors without inventing delivery state', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/health')) return jsonResponse({ service: 'zona-cero-api', ok: true, version: 'test' });
      if (url.endsWith('/incidents/incident-zc-demo/work-centers')) return jsonResponse(workCenterListHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/work-centers/center-north-triage')) return jsonResponse(workCenterDetailHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/resource-reports')) return jsonResponse(resourceReportListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/dispatch-tasks')) return jsonResponse(dispatchTaskListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/sos') && init?.method === 'POST') return new Response(JSON.stringify({ error: 'permission_denied' }), { status: 403 });
      if (url.endsWith('/incidents/incident-zc-demo/sos')) return jsonResponse(sosStatusFixture);
      return new Response('not found', { status: 404 });
    });

    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Connected SOS' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Type CONFIRM SOS to submit'), { target: { value: 'CONFIRM SOS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit SOS' }));

    expect(await screen.findByRole('status')).toHaveTextContent('SOS creation failed with status 403');
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

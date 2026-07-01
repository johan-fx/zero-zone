import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DispatchTaskListResponse, DispatchTaskResponse, ResourceReportListResponse, SosAlertCreateResponse, SosAlertStatusResponse, SyncPullResponse } from '@zona-cero/contracts';
import {
  familyReunificationSearchResponseFixture,
  privateFamilyReunificationConsumeResponseFixture,
  privateFamilyReunificationIssueResponseFixture,
  privateFamilyReunificationValidateResponseFixture,
  sosAlertCreateResponseHappyFixture,
  sosAlertStatusHappyFixture,
  workCenterDetailHappyFixture,
  workCenterListHappyFixture,
} from '../../../packages/testing/src';
import { App } from './App';



const freshSyncPullFixture: SyncPullResponse = {
  operations: [],
  cursor: null,
  hasMore: false,
  freshness: {
    status: 'fresh',
    lastFreshAt: '2026-07-01T08:00:00.000Z',
    lastSyncedAt: '2026-07-01T08:00:00.000Z',
    cursorLag: 0,
    hasConflicts: false,
    channels: [
      {
        channel: 'mobile',
        status: 'fresh',
        lastFreshAt: '2026-07-01T08:00:00.000Z',
        lastSyncedAt: '2026-07-01T08:00:00.000Z',
        cursorLag: 0,
        hasConflicts: false,
      },
    ],
  },
  conflicts: [],
};

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
  window.history.pushState({}, '', '/');
  window.sessionStorage.clear();
});

describe('web ui work center shell', () => {
  it('renders backend health plus work center list, detail and map-lite from shared contracts', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/health')) {
        return jsonResponse({ service: 'zona-cero-api', ok: true, version: 'test' });
      }
      if (url.includes('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull')) {
        return jsonResponse(freshSyncPullFixture);
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


  it('shows backend freshness channel limitation banners for stale, expired, missing, cursor lag, and conflicts', async () => {
    const stalePull: SyncPullResponse = {
      ...freshSyncPullFixture,
      freshness: {
        ...freshSyncPullFixture.freshness,
        status: 'stale',
        cursorLag: 4,
        hasConflicts: true,
      },
      conflicts: [
        {
          opId: 'op-conflict-1',
          entityId: 'center-north-triage',
          entityType: 'work_center',
          code: 'operation_conflict',
          message: 'entity already exists with another source operation',
        },
      ],
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/health')) return jsonResponse({ service: 'zona-cero-api', ok: true, version: 'test' });
      if (url.includes('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull')) return jsonResponse(stalePull);
      if (url.endsWith('/incidents/incident-zc-demo/work-centers')) return jsonResponse(workCenterListHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/work-centers/center-north-triage')) return jsonResponse(workCenterDetailHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/resource-reports')) return jsonResponse(resourceReportListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/dispatch-tasks')) return jsonResponse(dispatchTaskListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/sos')) return jsonResponse(sosStatusFixture);
      return new Response('not found', { status: 404 });
    });

    render(<App />);

    const staleTitle = await screen.findByText('Channel data may be stale');
    const banner = staleTitle.closest('[role="status"]');
    expect(banner).toHaveTextContent('Channel data may be stale');
    expect(banner).toHaveTextContent('4 backend updates are not reflected');
    expect(banner).toHaveTextContent('Sync conflicts are present');
    expect(banner).not.toHaveTextContent(/offline save|offline sync|saved offline/i);
  });

  it('shows expired and missing backend freshness without promising offline-first behavior', async () => {
    for (const status of ['expired', 'missing'] as const) {
      cleanup();
      vi.restoreAllMocks();
      const pull: SyncPullResponse = {
        ...freshSyncPullFixture,
        freshness: {
          ...freshSyncPullFixture.freshness,
          status,
          lastFreshAt: status === 'missing' ? null : freshSyncPullFixture.freshness.lastFreshAt,
          lastSyncedAt: status === 'missing' ? null : freshSyncPullFixture.freshness.lastSyncedAt,
        },
      };
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith('/health')) return jsonResponse({ service: 'zona-cero-api', ok: true, version: 'test' });
        if (url.includes('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull')) return jsonResponse(pull);
        if (url.endsWith('/incidents/incident-zc-demo/work-centers')) return jsonResponse({ workCenters: [] });
        if (url.endsWith('/incidents/incident-zc-demo/resource-reports')) return jsonResponse({ resourceReports: [] });
        if (url.endsWith('/incidents/incident-zc-demo/dispatch-tasks')) return jsonResponse({ dispatchTasks: [] });
        if (url.endsWith('/incidents/incident-zc-demo/sos')) return jsonResponse({ sosAlerts: [], fanout: { total: 0, queued: 0, pending: 0, failed: 0, cancelled: 0 } });
        return new Response('not found', { status: 404 });
      });

      render(<App />);
      const title = await screen.findByText(status === 'expired' ? 'Channel data expired' : 'Freshness signal missing');
      const banner = title.closest('[role="status"]');
      expect(banner).toHaveTextContent(status === 'expired' ? 'Channel data expired' : 'Freshness signal missing');
      expect(banner).not.toHaveTextContent(/offline save|offline sync|saved offline/i);
    }
  });

  it('does not show noisy channel limitation warnings when backend freshness is fresh', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/health')) return jsonResponse({ service: 'zona-cero-api', ok: true, version: 'test' });
      if (url.includes('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull')) return jsonResponse(freshSyncPullFixture);
      if (url.endsWith('/incidents/incident-zc-demo/work-centers')) return jsonResponse(workCenterListHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/work-centers/center-north-triage')) return jsonResponse(workCenterDetailHappyFixture);
      if (url.endsWith('/incidents/incident-zc-demo/resource-reports')) return jsonResponse(resourceReportListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/dispatch-tasks')) return jsonResponse(dispatchTaskListFixture);
      if (url.endsWith('/incidents/incident-zc-demo/sos')) return jsonResponse(sosStatusFixture);
      return new Response('not found', { status: 404 });
    });

    render(<App />);

    await waitFor(() => expect(screen.getByTestId('api-health')).toHaveTextContent('zona-cero-api is online'));
    expect(screen.queryByText('Channel data may be stale')).not.toBeInTheDocument();
    expect(screen.queryByText('Channel data expired')).not.toBeInTheDocument();
    expect(screen.queryByText('Freshness signal missing')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/offline save|offline sync|saved offline/i);
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
      if (url.includes('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull')) return jsonResponse(freshSyncPullFixture);
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
      if (url.includes('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull')) return jsonResponse(freshSyncPullFixture);
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
      if (url.includes('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull')) return jsonResponse(freshSyncPullFixture);
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
      if (url.includes('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull')) return jsonResponse(freshSyncPullFixture);
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

  it('renders the private family reunification flow with safety limits and minimized payloads', async () => {
    window.history.pushState(
      {},
      '',
      `/family-reunification?token=${privateFamilyReunificationIssueResponseFixture.token}&correlationId=${privateFamilyReunificationIssueResponseFixture.correlationId}`,
    );
    window.sessionStorage.setItem('cf-turnstile-response', 'test-turnstile-token');

    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/private-links/validate')) return jsonResponse(privateFamilyReunificationValidateResponseFixture);
      if (url.endsWith('/private-links/family-reunification/search') && init?.method === 'POST') {
        return jsonResponse(familyReunificationSearchResponseFixture);
      }
      if (url.endsWith('/private-links/consume') && init?.method === 'POST') {
        return jsonResponse(privateFamilyReunificationConsumeResponseFixture);
      }
      return new Response('not found', { status: 404 });
    });

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Identity-safe search and in-person referral' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Minimized private search' })).toBeInTheDocument());

    expect(screen.getByText('No photos are requested or shown.')).toBeInTheDocument();
    expect(screen.getByText('No exact location is requested or shown.')).toBeInTheDocument();
    expect(screen.getByText('No full identity of minors is requested or shown.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/photo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/exact location/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Approximate age band'), { target: { value: 'child' } });
    fireEvent.change(screen.getByLabelText('Relationship hint'), { target: { value: 'parent looking for child' } });
    fireEvent.change(screen.getByLabelText('Broad last-known area label'), { target: { value: 'north gate area' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search safely' }));

    expect(await screen.findByText('Possible in-person match')).toBeInTheDocument();
    expect(screen.getByText('Verification required: yes')).toBeInTheDocument();

    const searchCall = fetcher.mock.calls.find(([url]) => String(url).endsWith('/private-links/family-reunification/search'));
    expect(searchCall).toBeDefined();
    const payload = JSON.parse(String(searchCall?.[1]?.body)) as Record<string, unknown> & { query: Record<string, unknown> };
    expect(payload.token).toBe(privateFamilyReunificationIssueResponseFixture.token);
    expect(payload.correlationId).toBe(privateFamilyReunificationIssueResponseFixture.correlationId);
    expect(payload.fingerprint).toEqual(expect.stringMatching(/^browser-/));
    expect(payload.query).toEqual({
      ageBand: 'child',
      relationHint: 'parent looking for child',
      lastKnownAreaLabel: 'north gate area',
    });
    expect(payload.query).not.toHaveProperty('fullName');
    expect(payload.query).not.toHaveProperty('photo');
    expect(payload.query).not.toHaveProperty('exactLocation');
    expect(payload).not.toHaveProperty('turnstileToken');
    expect(searchCall?.[1]?.headers).toMatchObject({
      'cf-turnstile-response': 'test-turnstile-token',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Continue to in-person verification' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Continue with in-person verification'));

    const consumeCall = fetcher.mock.calls.find(([url]) => String(url).endsWith('/private-links/consume'));
    const consumePayload = JSON.parse(String(consumeCall?.[1]?.body)) as Record<string, unknown>;
    expect(consumePayload).toMatchObject({
      scope: 'family_reunification.search',
      correlationId: privateFamilyReunificationIssueResponseFixture.correlationId,
      referralReason: 'family_reunification_in_person_verification',
    });
  });

  it('shows safe visible errors for invalid or expired private links', async () => {
    window.history.pushState(
      {},
      '',
      `/family-reunification?token=${privateFamilyReunificationIssueResponseFixture.token}&correlationId=${privateFamilyReunificationIssueResponseFixture.correlationId}`,
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/private-links/validate')) {
        return new Response(JSON.stringify({ error: 'link_expired' }), { status: 410 });
      }
      return new Response('not found', { status: 404 });
    });

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('link_expired');
    expect(screen.getByText(/Go to the family reunification desk/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}


describe('web ui telemetry and turnstile forwarding', () => {
  it('keeps web telemetry sanitized and non-blocking', async () => {
    const { createWebTelemetryEvent, emitChannelTelemetry } = await import('./telemetry');
    const emit = vi.fn().mockRejectedValue(new Error('sink down'));

    expect(() => {
      emitChannelTelemetry(
        { emit },
        createWebTelemetryEvent({
          action: 'private_link.rejected',
          result: 'rejected',
          errorCode: 'rate_limited',
        }),
      );
    }).not.toThrow();
    await Promise.resolve();

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'private_link.attempted',
        channel: 'web-ui',
        scope: 'web.private_link',
        action: 'private_link.rejected',
        errorCode: 'rate_limited',
      }),
    );
    expect(JSON.stringify(emit.mock.calls)).not.toContain('token');
    expect(JSON.stringify(emit.mock.calls)).not.toContain('fingerprint');
    expect(JSON.stringify(emit.mock.calls)).not.toContain('relationHint');
  });

  it('forwards Turnstile header only when a token is provided', async () => {
    const { createTurnstileHeaders } = await import('./api');

    expect(createTurnstileHeaders()).toEqual({});
    expect(createTurnstileHeaders({ turnstileToken: '  token-123  ' })).toEqual({
      'cf-turnstile-response': 'token-123',
    });
  });
});

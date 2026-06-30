import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { workCenterDetailHappyFixture, workCenterListHappyFixture } from '../../../packages/testing/src';
import { App } from './App';

beforeEach(() => {
  vi.restoreAllMocks();
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

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Work center list failed with status 403'));
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
      return jsonResponse(backendOnlyDetail);
    });

    render(<App />);

    await waitFor(() => expect(screen.getAllByText('needs_review').length).toBeGreaterThan(0));
    expect(screen.getAllByText('expired').length).toBeGreaterThan(0);
    expect(screen.getAllByText('high').length).toBeGreaterThan(0);
    expect(screen.getAllByText('low').length).toBeGreaterThan(0);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

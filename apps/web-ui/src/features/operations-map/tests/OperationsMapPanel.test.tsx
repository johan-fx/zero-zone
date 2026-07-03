import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CountryListResponse, OperationalMapResponse } from '@zona-cero/contracts';
import { OperationsMapPanel } from '../OperationsMapPanel';

const leafletMapMock = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  invalidateSize: vi.fn(),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="leaflet-map" className={className}>{children}</div>
  ),
  TileLayer: ({ attribution }: { attribution: string }) => (
    <div data-testid="tile-layer" dangerouslySetInnerHTML={{ __html: attribution }} />
  ),
  Marker: ({ children, icon }: { children: ReactNode; icon: { options?: { html?: string; className?: string } } }) => (
    <div data-testid="map-marker" className={icon.options?.className}>
      <span data-testid="map-marker-html" dangerouslySetInnerHTML={{ __html: icon.options?.html ?? '' }} />
      {children}
    </div>
  ),
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useMap: () => leafletMapMock,
}));

const countriesFixture: CountryListResponse = {
  countries: [
    { countryCode: 'ES', countryName: 'Spain', incidentCount: 1, markerCount: 3 },
    { countryCode: 'PT', countryName: 'Portugal', incidentCount: 1, markerCount: 0 },
  ],
};

const spainMapFixture: OperationalMapResponse = {
  countryCode: 'ES',
  countryName: 'Spain',
  bounds: {
    northEast: { latitude: 41.41, longitude: 2.2 },
    southWest: { latitude: 41.35, longitude: 2.1 },
  },
  incidents: [
    {
      incidentId: 'incident-zc-demo',
      name: 'Barcelona flood response',
      status: 'active',
      startsAt: '2026-07-03T10:00:00.000Z',
      locationName: 'Barcelona',
      countryCode: 'ES',
      countryName: 'Spain',
      location: { latitude: 41.38, longitude: 2.17 },
    },
  ],
  workCenters: [
    {
      markerId: 'work-center:center-north-triage',
      type: 'work_center',
      workCenterId: 'center-north-triage',
      incidentId: 'incident-zc-demo',
      name: 'North triage point',
      priority: 'high',
      status: 'reported',
      location: { latitude: 41.39, longitude: 2.16 },
      updatedAt: '2026-07-03T10:10:00.000Z',
    },
  ],
  sosAlerts: [
    {
      markerId: 'sos:sos-mobile-critical-1',
      type: 'sos',
      sosAlertId: 'sos-mobile-critical-1',
      incidentId: 'incident-zc-demo',
      status: 'open',
      severity: 'critical',
      location: { latitude: 41.37, longitude: 2.18 },
      createdAt: '2026-07-03T10:15:00.000Z',
    },
  ],
  counts: { incidents: 1, workCenters: 1, sosAlerts: 1, withoutLocation: 2 },
};

const portugalEmptyMapFixture: OperationalMapResponse = {
  countryCode: 'PT',
  countryName: 'Portugal',
  incidents: [],
  workCenters: [],
  sosAlerts: [],
  counts: { incidents: 0, workCenters: 0, sosAlerts: 0, withoutLocation: 1 },
};

beforeEach(() => {
  vi.restoreAllMocks();
  leafletMapMock.fitBounds.mockClear();
  leafletMapMock.invalidateSize.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('OperationsMapPanel', () => {
  it('loads country options, renders Leaflet map plus accessible list, and exposes OSM attribution', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/map/countries')) return jsonResponse(countriesFixture);
      if (url.endsWith('/map?countryCode=ES')) return jsonResponse(spainMapFixture);
      if (url.endsWith('/map?countryCode=PT')) return jsonResponse(portugalEmptyMapFixture);
      return new Response('not found', { status: 404 });
    });

    render(<OperationsMapPanel />);

    expect(screen.getByText('Loading countries…')).toBeInTheDocument();
    expect(await screen.findByLabelText('Country')).toHaveValue('ES');
    await waitFor(() => expect(screen.getByTestId('leaflet-map')).toBeInTheDocument());

    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:8787/map/countries');
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:8787/map?countryCode=ES');
    expect(screen.getByText('1 incidents')).toBeInTheDocument();
    expect(screen.getByText('1 work centers')).toBeInTheDocument();
    expect(screen.getByText('1 SOS alerts')).toBeInTheDocument();
    expect(screen.getByText('2 without location')).toBeInTheDocument();
    expect(screen.getByText('Map data © OpenStreetMap contributors')).toBeVisible();
    await waitFor(() => expect(leafletMapMock.invalidateSize).toHaveBeenCalled());
    expect(leafletMapMock.fitBounds).toHaveBeenCalled();
    expect(within(screen.getByRole('list')).getByText('North triage point')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getByText('SOS sos-mobile-critical-1')).toBeInTheDocument();

    const markerLabels = screen.getAllByTestId('map-marker');
    expect(markerLabels).toHaveLength(3);
    expect(markerLabels[0]).toHaveTextContent('Active');
    expect(markerLabels[0].innerHTML).toContain('operations-map-marker--active');
    expect(markerLabels[1]).toHaveTextContent('North triage point');
    expect(markerLabels[1].innerHTML).toContain('operations-map-marker--selected-center');
    expect(markerLabels[1].innerHTML).toContain('operations-map-marker--selected');
    expect(markerLabels[2]).toHaveTextContent('SOS');
    expect(markerLabels[2].innerHTML).toContain('operations-map-marker--sos');
    expect(markerLabels[2].innerHTML).toContain('data-marker-variant="sos"');
  });

  it('renders global and country empty states without calling tiles', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/map/countries')) return jsonResponse({ countries: [] });
      return new Response('not found', { status: 404 });
    });

    render(<OperationsMapPanel />);

    expect(await screen.findByRole('status')).toHaveTextContent('No countries with operational map data yet.');
    expect(screen.queryByTestId('leaflet-map')).not.toBeInTheDocument();

    cleanup();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/map/countries')) return jsonResponse(countriesFixture);
      if (url.endsWith('/map?countryCode=ES')) return jsonResponse(spainMapFixture);
      if (url.endsWith('/map?countryCode=PT')) return jsonResponse(portugalEmptyMapFixture);
      return new Response('not found', { status: 404 });
    });

    render(<OperationsMapPanel />);
    await waitFor(() => expect(screen.getByTestId('leaflet-map')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'PT' } });
    expect(await screen.findByRole('status')).toHaveTextContent('No public geolocated map items for Portugal yet.');
  });

  it('renders API errors accessibly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 503 }));

    render(<OperationsMapPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Map countries failed with status 503');
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

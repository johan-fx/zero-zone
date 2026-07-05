import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CountryListResponse, OperationalMapResponse } from '@zona-cero/contracts';
import { OperationsMapPanel, type OperationsMapPanelCopy } from '../OperationsMapPanel';

type CapturedLayer = { id?: string; type?: string; source?: string; 'source-layer'?: string; paint?: Record<string, unknown> };

const maplibreMocks = vi.hoisted(() => {
  type CapturedMapOptions = { container: HTMLElement; style?: { sources?: Record<string, unknown>; layers?: CapturedLayer[] } };
  const maps: Array<{ options: CapturedMapOptions; fitBounds: ReturnType<typeof vi.fn>; resize: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; setCenter: ReturnType<typeof vi.fn>; setStyle: ReturnType<typeof vi.fn>; setZoom: ReturnType<typeof vi.fn> }> = [];
  const markers: Array<{ element: HTMLElement; lngLat?: [number, number]; popup?: { html?: string; remove: ReturnType<typeof vi.fn> }; remove: ReturnType<typeof vi.fn> }> = [];
  const workerUrl = vi.fn();

  return { maps, markers, workerUrl };
});

vi.mock('maplibre-gl', () => {
  class MapMock {
    fitBounds = vi.fn();
    resize = vi.fn();
    remove = vi.fn();
    setCenter = vi.fn();
    setStyle = vi.fn();
    setZoom = vi.fn();

    options: { container: HTMLElement; style?: { sources?: Record<string, unknown>; layers?: CapturedLayer[] } };

    constructor(options: { container: HTMLElement; style?: { sources?: Record<string, unknown>; layers?: CapturedLayer[] } }) {
      this.options = options;
      options.container.dataset.maplibreInitialized = 'true';
      options.container.classList.add('maplibregl-map');
      maplibreMocks.maps.push(this);
    }

    addControl() {
      return this;
    }
  }

  class MarkerMock {
    element: HTMLElement;
    lngLat?: [number, number];
    popup?: { html?: string; remove: ReturnType<typeof vi.fn> };
    remove = vi.fn();

    constructor(options: { element: HTMLElement }) {
      this.element = options.element;
    }

    setLngLat(lngLat: [number, number]) {
      this.lngLat = lngLat;
      return this;
    }

    setPopup(popup: { html?: string; remove: ReturnType<typeof vi.fn> }) {
      this.popup = popup;
      return this;
    }

    addTo() {
      maplibreMocks.markers.push(this);
      return this;
    }
  }

  class PopupMock {
    html?: string;
    remove = vi.fn();

    setHTML(html: string) {
      this.html = html;
      return this;
    }
  }

  class LngLatBoundsMock {
    constructor(public sw: [number, number], public ne: [number, number]) {}
  }

  return {
    AttributionControl: class AttributionControlMock {},
    LngLatBounds: LngLatBoundsMock,
    Map: MapMock,
    Marker: MarkerMock,
    NavigationControl: class NavigationControlMock {},
    Popup: PopupMock,
    setWorkerUrl: maplibreMocks.workerUrl,
  };
});

vi.mock('maplibre-gl/dist/maplibre-gl-csp-worker.js?url', () => ({ default: '/mock-maplibre-worker.js' }));

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

const englishCivilCopy: OperationsMapPanelCopy = {
  eyebrow: 'Public country map',
  title: 'Country help map',
  summary:
    'Shows public country-level information: response areas, help points, and SOS alerts. Some items hide the exact location for safety. This is not a personalized view or a real-time nearby-points view.',
  markerCountLabel: (count) => `${count} published markers`,
  loadingCountries: 'Loading country map…',
  emptyCountries: 'No countries have a public map available yet.',
  loadingMap: 'Loading country help map…',
  countsAriaLabel: 'Public country map summary',
  incidentsLabel: (count) => `${count} response areas`,
  workCentersLabel: (count) => `${count} help points`,
  sosAlertsLabel: (count) => `${count} SOS alerts`,
  withoutLocationLabel: (count) => `${count} with protected location`,
  emptyMapItems: (countryName) => `No public geolocated help items for ${countryName} yet.`,
  listTitle: 'Published points and safe details',
  mapAriaLabel: (countryName) => `Public country help map for ${countryName}`,
  markerLabel: (marker) => {
    if (marker.kind === 'incident') return 'Response area';
    if (marker.kind === 'work_center') return 'Help point';
    return 'SOS alert';
  },
  markerMetadata: (marker) => {
    if (marker.kind === 'incident') return 'Response area · Active';
    if (marker.kind === 'work_center') return 'Help point · Published';
    return 'SOS alert · Open';
  },
  markerDetail: (marker) => {
    if (marker.kind === 'work_center') return `Priority need: ${marker.priority}`;
    if (marker.kind === 'sos') return `Urgency: ${marker.severity}`;
    return marker.detail;
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
  maplibreMocks.maps.length = 0;
  maplibreMocks.markers.length = 0;
});

afterEach(() => {
  cleanup();
});

describe('OperationsMapPanel', () => {
  it('loads country options, renders MapLibre map plus accessible list, and exposes OSM attribution', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/map/countries')) return jsonResponse(countriesFixture);
      if (url.endsWith('/map?countryCode=ES')) return jsonResponse(spainMapFixture);
      if (url.endsWith('/map?countryCode=PT')) return jsonResponse(portugalEmptyMapFixture);
      return new Response('not found', { status: 404 });
    });

    render(<OperationsMapPanel styleName="night" />);

    expect(screen.getByText('Loading countries…')).toBeInTheDocument();
    expect(await screen.findByLabelText('Country')).toHaveValue('ES');
    await waitFor(() => expect(screen.getByTestId('maplibre-map')).toBeInTheDocument());
    await waitFor(() => expect(maplibreMocks.maps[0]?.options.style?.sources?.openmaptiles).toBeDefined());

    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:8787/map/countries');
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:8787/map?countryCode=ES');
    expect(maplibreMocks.workerUrl).toHaveBeenCalledWith('/mock-maplibre-worker.js');
    expect(screen.getByRole('region', { name: 'Map overview' })).toBeInTheDocument();
    expect(screen.getByLabelText('Operational map for Spain')).toBeInTheDocument();
    expect(screen.getByText('1 incidents')).toBeInTheDocument();
    expect(screen.getByText('1 work centers')).toBeInTheDocument();
    expect(screen.getByText('1 SOS alerts')).toBeInTheDocument();
    expect(screen.getByText('2 without location')).toBeInTheDocument();
    expect(screen.getByText('Map data © OpenStreetMap, OpenMapTiles, OpenFreeMap')).toBeVisible();
    expect(maplibreMocks.maps[0]?.options.style?.sources?.openmaptiles).toMatchObject({
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    });
    expect((maplibreMocks.maps[0]?.options.style as { glyphs?: string } | undefined)?.glyphs).toBe('https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf');
    expect(maplibreMocks.maps[0]?.options.style?.layers?.some((layer) => layer.source === 'openmaptiles')).toBe(true);
    expect(maplibreMocks.maps[0]?.options.style?.layers?.some((layer) => layer.type === 'raster')).toBe(false);
    expect(maplibreMocks.maps[0]?.options.style?.layers?.some((layer) => layer.id === 'place-labels' && layer.type === 'symbol')).toBe(true);
    expect(maplibreMocks.maps[0]?.options.style?.layers?.find((layer) => layer.id === 'road-labels')?.['source-layer']).toBe('transportation_name');
    expect(screen.queryByRole('group', { name: 'Map style' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Day')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Night')).not.toBeInTheDocument();
    expect(screen.getByTestId('maplibre-map')).toHaveClass('operations-map__canvas--night');
    await waitFor(() => expect(maplibreMocks.maps[0]?.resize).toHaveBeenCalled());
    expect(maplibreMocks.maps[0]?.fitBounds).toHaveBeenCalledWith(expect.anything(), { padding: 150 });
    expect(within(screen.getByRole('list')).getByText('North triage point')).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getByText('SOS sos-mobile-critical-1')).toBeInTheDocument();

    expect(maplibreMocks.markers).toHaveLength(3);
    expect(maplibreMocks.markers[0]?.lngLat).toEqual([2.17, 41.38]);
    expect(maplibreMocks.markers[0]?.element).toHaveTextContent('Active');
    expect(maplibreMocks.markers[0]?.element.innerHTML).toContain('operations-map-marker--active');
    expect(maplibreMocks.markers[1]?.lngLat).toEqual([2.16, 41.39]);
    expect(maplibreMocks.markers[1]?.element).toHaveTextContent('North triage point');
    expect(maplibreMocks.markers[1]?.element.innerHTML).toContain('operations-map-marker--selected-center');
    expect(maplibreMocks.markers[1]?.element.innerHTML).toContain('operations-map-marker--selected');
    expect(maplibreMocks.markers[2]?.element).toHaveTextContent('SOS');
    expect(maplibreMocks.markers[2]?.element.innerHTML).toContain('operations-map-marker--sos');
    expect(maplibreMocks.markers[2]?.element.innerHTML).toContain('data-marker-variant="sos"');
    expect(maplibreMocks.markers[2]?.popup?.html).toContain('SOS sos-mobile-critical-1');
  });


  it('uses passed English civil copy for the help-points surface without changing map loading', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/map/countries')) return jsonResponse(countriesFixture);
      if (url.endsWith('/map?countryCode=ES')) return jsonResponse(spainMapFixture);
      return new Response('not found', { status: 404 });
    });

    render(<OperationsMapPanel styleName="day" copy={englishCivilCopy} />);

    expect(screen.getByText('Loading country map…')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Country help map' })).toBeInTheDocument();
    expect(screen.getByText('Public country map')).toBeInTheDocument();
    expect(screen.getByText(/not a personalized view/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Public country help map for Spain')).toBeInTheDocument());
    expect(screen.getByText('3 published markers')).toBeInTheDocument();
    expect(screen.getByText('1 response areas')).toBeInTheDocument();
    expect(screen.getByText('1 help points')).toBeInTheDocument();
    expect(screen.getByText('2 with protected location')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Published points and safe details' })).toBeInTheDocument();
    expect(screen.getByText('Help point · Published')).toBeInTheDocument();
    expect(screen.getByText('Priority need: high')).toBeInTheDocument();
    expect(screen.getByText('SOS alert · Open')).toBeInTheDocument();
    expect(screen.getByText('Urgency: critical')).toBeInTheDocument();
    expect(screen.queryByText('work_center · reported')).not.toBeInTheDocument();
    expect(screen.queryByText('sos · open')).not.toBeInTheDocument();
    await waitFor(() => expect(maplibreMocks.markers).toHaveLength(3));
    expect(maplibreMocks.markers[0]?.element.querySelector('.operations-map-marker__label')).toHaveTextContent('Response area');
    expect(maplibreMocks.markers[0]?.element.querySelector('.operations-map-marker__label')).not.toHaveTextContent('Active');
    expect(maplibreMocks.markers[1]?.element.querySelector('.operations-map-marker__label')).toHaveTextContent('Help point');
    expect(maplibreMocks.markers[1]?.element.querySelector('.operations-map-marker__label')).not.toHaveTextContent('North triage point');
    expect(maplibreMocks.markers[2]?.element.querySelector('.operations-map-marker__label')).toHaveTextContent('SOS alert');
    expect(maplibreMocks.markers[1]?.element.innerHTML).toContain('Help point · Published');
    expect(maplibreMocks.markers[1]?.element.innerHTML).not.toContain('work_center · reported');
    expect(maplibreMocks.markers[1]?.popup?.html).toContain('<strong>Help point</strong>');
    expect(maplibreMocks.markers[1]?.popup?.html).not.toContain('<strong>North triage point</strong>');
    expect(maplibreMocks.markers[1]?.popup?.html).toContain('Priority need: high');
    expect(maplibreMocks.markers[1]?.popup?.html).not.toContain('Priority high');
    expect(screen.queryByText('Operational map')).not.toBeInTheDocument();
    expect(screen.queryByText('Mapa de ayuda por país')).not.toBeInTheDocument();
  });

  it('uses the global styleName prop and switches to day without dropping markers', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/map/countries')) return jsonResponse(countriesFixture);
      if (url.endsWith('/map?countryCode=ES')) return jsonResponse(spainMapFixture);
      return new Response('not found', { status: 404 });
    });

    const { rerender } = render(<OperationsMapPanel styleName="night" />);

    const mapCanvas = await screen.findByTestId('maplibre-map');
    expect(screen.queryByRole('group', { name: 'Map style' })).not.toBeInTheDocument();
    expect(mapCanvas).toHaveClass('operations-map__canvas--night');
    expect(mapCanvas).toHaveClass('maplibregl-map');
    await waitFor(() => expect(maplibreMocks.markers).toHaveLength(3));
    const existingMarkers = [...maplibreMocks.markers];

    const setStyle = maplibreMocks.maps[0]?.setStyle;
    const callsBeforeStyleChange = setStyle?.mock.calls.length ?? 0;

    rerender(<OperationsMapPanel styleName="day" />);

    expect(mapCanvas).toHaveClass('operations-map__canvas--day');
    expect(mapCanvas).toHaveClass('maplibregl-map');
    expect(mapCanvas).not.toHaveClass('operations-map__canvas--night');
    expect(maplibreMocks.maps).toHaveLength(1);
    expect(setStyle).toHaveBeenCalledTimes(callsBeforeStyleChange + 1);
    const latestStyle = setStyle?.mock.calls.at(-1)?.[0] as { sources?: Record<string, unknown>; layers?: Array<{ id?: string; type?: string; source?: string; 'source-layer'?: string; paint?: Record<string, unknown> }> } | undefined;
    expect(latestStyle?.sources?.openmaptiles).toMatchObject({
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    });
    expect(latestStyle?.layers?.some((layer) => layer.type === 'raster')).toBe(false);
    expect(latestStyle?.layers?.some((layer) => layer.id === 'water' && layer.source === 'openmaptiles')).toBe(true);
    expect(latestStyle?.layers?.some((layer) => layer.id === 'road-labels' && layer.type === 'symbol')).toBe(true);
    expect(latestStyle?.layers?.find((layer) => layer.id === 'road-labels')?.['source-layer']).toBe('transportation_name');
    expect(latestStyle?.layers?.find((layer) => layer.id === 'background')?.paint?.['background-color']).toBe('#f8fafc');
    expect(maplibreMocks.markers).toHaveLength(3);
    existingMarkers.forEach((marker) => expect(marker.remove).not.toHaveBeenCalled());
  });

  it('renders global and country empty states without calling tiles', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/map/countries')) return jsonResponse({ countries: [] });
      return new Response('not found', { status: 404 });
    });

    render(<OperationsMapPanel styleName="night" />);

    expect(await screen.findByRole('status')).toHaveTextContent('No countries with operational map data yet.');
    expect(screen.queryByTestId('maplibre-map')).not.toBeInTheDocument();

    cleanup();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/map/countries')) return jsonResponse(countriesFixture);
      if (url.endsWith('/map?countryCode=ES')) return jsonResponse(spainMapFixture);
      if (url.endsWith('/map?countryCode=PT')) return jsonResponse(portugalEmptyMapFixture);
      return new Response('not found', { status: 404 });
    });

    render(<OperationsMapPanel styleName="night" />);
    await waitFor(() => expect(screen.getByTestId('maplibre-map')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'PT' } });
    expect(await screen.findByRole('status')).toHaveTextContent('No public geolocated map items for Portugal yet.');
  });

  it('renders API errors accessibly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 503 }));

    render(<OperationsMapPanel styleName="night" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Map countries failed with status 503');
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

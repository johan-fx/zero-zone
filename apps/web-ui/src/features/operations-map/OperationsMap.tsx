import { useEffect, useMemo, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type ExpressionSpecification,
  type LngLatBoundsLike,
  type LngLatLike,
  type StyleSpecification,
} from 'maplibre-gl';
import {
  Activity,
  ClipboardList,
  Cross,
  Eye,
  Package,
  ShoppingBag,
  TriangleAlert,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';

import type { OperationalMapResponse } from '@zona-cero/contracts';
import { flattenOperationalMapMarkers, resolveOperationalMarkerVariant, type OperationalMapMarker } from './mapData';

setWorkerUrl(workerUrl);

const openMapAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://openmaptiles.org/">OpenMapTiles</a>, <a href="https://openfreemap.org/">OpenFreeMap</a>';
const openMapGlyphsUrl = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const defaultCenter: LngLatLike = [-3.7038, 40.4168];
const localizedNameExpression: ExpressionSpecification = ['coalesce', ['get', 'name_en'], ['get', 'name']];

export type OperationsMapStyleName = 'day' | 'night';

export type OperationsMapMarkerDescription = {
  label?: string;
  metadata: string;
  detail: string;
};

type OperationsMapStyleConfig = {
  className: string;
  style: StyleSpecification;
};

const mapStyles: Record<OperationsMapStyleName, OperationsMapStyleConfig> = {
  day: {
    className: 'operations-map__canvas--day',
    style: createVectorStyle('day'),
  },
  night: {
    className: 'operations-map__canvas--night',
    style: createVectorStyle('night'),
  },
};

const defaultMapStyle: OperationsMapStyleName = 'night';

const markerIconByVariant: Record<ReturnType<typeof resolveOperationalMarkerVariant>, string> = {
  selected_center: renderMarkerIcon(Warehouse),
  sos: '<span class="operations-map-marker__sos">SOS</span>',
  critical_shortage: renderMarkerIcon(Package),
  pending: renderMarkerIcon(ClipboardList),
  active: renderMarkerIcon(Activity),
  needs_medics: renderMarkerIcon(Cross),
  surplus_resource: renderMarkerIcon(ShoppingBag),
  saturated_zone: renderMarkerIcon(Users),
  observing: renderMarkerIcon(Eye),
  dangerous_zone: renderMarkerIcon(TriangleAlert),
};

const markerLabelByVariant: Record<ReturnType<typeof resolveOperationalMarkerVariant>, string> = {
  selected_center: '',
  sos: 'SOS',
  critical_shortage: 'Critical shortage',
  pending: 'Pending',
  active: 'Active',
  needs_medics: 'Needs medics',
  surplus_resource: 'Surplus resource',
  saturated_zone: 'Saturated zone',
  observing: 'Observing',
  dangerous_zone: 'Dangerous zone',
};

export function OperationsMap({
  map,
  styleName = defaultMapStyle,
  ariaLabel,
  describeMarker = defaultMarkerDescription,
}: {
  map: OperationalMapResponse;
  styleName?: OperationsMapStyleName;
  ariaLabel?: string;
  describeMarker?: (marker: OperationalMapMarker) => OperationsMapMarkerDescription;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Array<{ marker: Marker; popup: Popup }>>([]);
  const currentStyleNameRef = useRef<OperationsMapStyleName>(styleName);
  const markers = useMemo(() => flattenOperationalMapMarkers(map), [map]);
  const selectedCenterId = markers.find((marker) => marker.kind === 'work_center')?.id;
  const bounds = useMemo(() => toMapLibreBounds(map), [map]);
  const longitudeCenter = toLongitudeCenter(map);
  const center = useMemo(() => toMapCenter(map) ?? defaultCenter, [map]);
  const styleConfig = mapStyles[styleName];

  useEffect(() => {
    if (!containerRef.current) return;

    const operationalMap = new MapLibreMap({
      attributionControl: false,
      center,
      container: containerRef.current,
      cooperativeGestures: true,
      scrollZoom: false,
      style: styleConfig.style,
      zoom: 6,
    });

    operationalMap.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    operationalMap.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = operationalMap;
    currentStyleNameRef.current = styleName;

    return () => {
      markerRefs.current.forEach(({ marker, popup }) => {
        popup.remove();
        marker.remove();
      });
      markerRefs.current = [];
      operationalMap.remove();
      if (mapRef.current === operationalMap) mapRef.current = null;
    };
  }, [center]);

  useEffect(() => {
    const operationalMap = mapRef.current;
    if (!operationalMap) return;
    if (currentStyleNameRef.current === styleName) return;

    operationalMap.setStyle(styleConfig.style);
    currentStyleNameRef.current = styleName;
  }, [styleConfig.style, styleName]);

  useEffect(() => {
    const operationalMap = mapRef.current;
    if (!operationalMap) return;

    markerRefs.current.forEach(({ marker, popup }) => {
      popup.remove();
      marker.remove();
    });

    markerRefs.current = markers.map((markerData) => {
      const selected = markerData.id === selectedCenterId;
      const variant = resolveOperationalMarkerVariant(markerData, selected);
      const placement = resolveMarkerPlacement(markerData, longitudeCenter);
      const markerDescription = describeMarker(markerData);
      const popup = new Popup({ closeButton: true, closeOnClick: true, maxWidth: '18rem' }).setHTML(createPopupHtml(markerData, markerDescription));
      const marker = new Marker({ element: createMarkerElement(markerData, variant, selected, placement, markerDescription), anchor: 'bottom' })
        .setLngLat([markerData.longitude, markerData.latitude])
        .setPopup(popup)
        .addTo(operationalMap);

      return { marker, popup };
    });

    const frame = window.requestAnimationFrame(() => {
      operationalMap.resize();
      if (bounds) {
        operationalMap.fitBounds(bounds, { padding: 150 });
      } else {
        operationalMap.setCenter(center);
        operationalMap.setZoom(6);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
      markerRefs.current.forEach(({ marker, popup }) => {
        popup.remove();
        marker.remove();
      });
      markerRefs.current = [];
    };
  }, [bounds, center, describeMarker, longitudeCenter, markers, selectedCenterId]);

  return (
    <div className="operations-map" aria-label={ariaLabel ?? `Operational map for ${map.countryName}`}>
      <div ref={containerRef} data-testid="maplibre-map" className={`operations-map__canvas maplibregl-map ${styleConfig.className}`} />
      <p className="operations-map__attribution">Map data © OpenStreetMap, OpenMapTiles, OpenFreeMap</p>
    </div>
  );
}

function createVectorStyle(styleName: OperationsMapStyleName): StyleSpecification {
  const colors = styleName === 'night'
    ? {
        background: '#020817',
        land: '#08111f',
        landcover: '#0e1a2b',
        park: '#10251f',
        water: '#063a5f',
        waterway: '#0b6fa4',
        road: '#3f5168',
        majorRoad: '#5f7894',
        building: '#111827',
        boundary: '#38bdf8',
        label: '#8fb6d8',
        labelHalo: '#020817',
        roadLabel: '#7898b8',
      }
    : {
        background: '#f8fafc',
        land: '#eef2f7',
        landcover: '#e7f5df',
        park: '#d9f99d',
        water: '#93c5fd',
        waterway: '#2563eb',
        road: '#ffffff',
        majorRoad: '#fef3c7',
        building: '#e2e8f0',
        boundary: '#64748b',
        label: '#334155',
        labelHalo: '#f8fafc',
        roadLabel: '#475569',
      };

  return {
    version: 8,
    glyphs: openMapGlyphsUrl,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution: openMapAttribution,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': colors.background },
      },
      {
        id: 'land',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        paint: { 'fill-color': colors.land, 'fill-opacity': styleName === 'night' ? 0.42 : 0.58 },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland', 'scrub']]],
        paint: { 'fill-color': colors.landcover, 'fill-opacity': styleName === 'night' ? 0.44 : 0.72 },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: { 'fill-color': colors.park, 'fill-opacity': styleName === 'night' ? 0.36 : 0.62 },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': colors.water, 'fill-opacity': styleName === 'night' ? 0.88 : 0.82 },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: { 'line-color': colors.waterway, 'line-opacity': styleName === 'night' ? 0.72 : 0.68, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.35, 12, 1.4] },
      },
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 12,
        paint: { 'fill-color': colors.building, 'fill-opacity': styleName === 'night' ? 0.34 : 0.48 },
      },
      {
        id: 'roads-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track']]],
        paint: { 'line-color': colors.road, 'line-opacity': styleName === 'night' ? 0.2 : 0.52, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.2, 14, 1.2] },
      },
      {
        id: 'roads-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'tertiary', 'trunk', 'motorway']]],
        paint: { 'line-color': colors.majorRoad, 'line-opacity': styleName === 'night' ? 0.34 : 0.76, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.45, 12, 2.2] },
      },
      {
        id: 'boundaries',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        paint: { 'line-color': colors.boundary, 'line-dasharray': [2, 2], 'line-opacity': styleName === 'night' ? 0.34 : 0.42, 'line-width': 0.8 },
      },
      {
        id: 'road-labels',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 11,
        filter: [
          'match',
          ['get', 'class'],
          ['primary', 'secondary', 'tertiary', 'trunk'],
          true,
          false,
        ],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 420,
          'text-field': localizedNameExpression,
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 12],
          'text-letter-spacing': 0.02,
        },
        paint: {
          'text-color': colors.roadLabel,
          'text-halo-color': colors.labelHalo,
          'text-halo-width': styleName === 'night' ? 1.2 : 1,
          'text-opacity': styleName === 'night' ? 0.58 : 0.72,
        },
      },
      {
        id: 'place-labels',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 7,
        filter: [
          'all',
          ['has', 'name'],
          ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'suburb', 'neighbourhood']]],
        ],
        layout: {
          'text-field': localizedNameExpression,
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 7, 10, 12, 14],
          'text-letter-spacing': 0.01,
          'text-max-width': 9,
        },
        paint: {
          'text-color': colors.label,
          'text-halo-color': colors.labelHalo,
          'text-halo-width': styleName === 'night' ? 1.4 : 1.1,
          'text-opacity': styleName === 'night' ? 0.66 : 0.82,
        },
      },
    ],
  };
}

function resolveMarkerPlacement(marker: OperationalMapMarker, longitudeCenter: number | null): 'west' | 'center' | 'east' {
  if (longitudeCenter === null) return 'center';
  if (marker.longitude > longitudeCenter) return 'east';
  if (marker.longitude < longitudeCenter) return 'west';
  return 'center';
}

function createMarkerElement(
  marker: OperationalMapMarker,
  variant: ReturnType<typeof resolveOperationalMarkerVariant>,
  selected: boolean,
  placement: 'west' | 'center' | 'east',
  description: OperationsMapMarkerDescription,
): HTMLElement {
  const variantClass = variant.replaceAll('_', '-');
  const label = description.label ?? defaultMarkerLabel(marker, variant);
  const safeLabel = escapeHtml(label);
  const safeDetail = escapeHtml(`${description.metadata} · ${description.detail}`);
  const [width, height] = selected ? [164, 96] : [140, 78];
  const element = document.createElement('div');

  element.className = 'operations-map-marker-shell';
  element.style.width = `${width}px`;
  element.style.height = `${height}px`;
  element.innerHTML = `<span class="operations-map-marker operations-map-marker--${variantClass} operations-map-marker--${placement}${selected ? ' operations-map-marker--selected' : ''}" data-marker-variant="${variantClass}" title="${safeDetail}"><span class="operations-map-marker__icon" aria-hidden="true">${markerIconByVariant[variant]}</span><span class="operations-map-marker__anchor" aria-hidden="true"></span><span class="operations-map-marker__label">${safeLabel}</span></span>`;

  return element;
}

function defaultMarkerLabel(marker: OperationalMapMarker, variant: ReturnType<typeof resolveOperationalMarkerVariant>): string {
  return variant === 'selected_center' ? marker.label : markerLabelByVariant[variant];
}

function createPopupHtml(marker: OperationalMapMarker, description: OperationsMapMarkerDescription): string {
  return `<strong>${escapeHtml(marker.label)}</strong><br />${escapeHtml(description.metadata)}<br />${escapeHtml(description.detail)}`;
}

function defaultMarkerDescription(marker: OperationalMapMarker): OperationsMapMarkerDescription {
  return {
    metadata: `${marker.kind.replace('_', ' ')} · ${marker.status}`,
    detail: marker.detail,
  };
}

function renderMarkerIcon(Icon: LucideIcon): string {
  return renderToStaticMarkup(<Icon aria-hidden="true" focusable="false" strokeWidth={2.4} />);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}

function toMapLibreBounds(map: OperationalMapResponse): LngLatBoundsLike | undefined {
  if (!map.bounds) return undefined;

  const latitudeSpan = map.bounds.northEast.latitude - map.bounds.southWest.latitude;
  const longitudeSpan = map.bounds.northEast.longitude - map.bounds.southWest.longitude;
  const latitudePadding = Math.max(latitudeSpan * 0.18, 0.12);
  const longitudePadding = Math.max(longitudeSpan * 0.18, 0.12);

  return new LngLatBounds(
    [clampLongitude(map.bounds.southWest.longitude - longitudePadding), clampLatitude(map.bounds.southWest.latitude - latitudePadding)],
    [clampLongitude(map.bounds.northEast.longitude + longitudePadding), clampLatitude(map.bounds.northEast.latitude + latitudePadding)],
  );
}

function clampLatitude(value: number): number {
  return Math.max(-90, Math.min(90, value));
}

function clampLongitude(value: number): number {
  return Math.max(-180, Math.min(180, value));
}

function toLongitudeCenter(map: OperationalMapResponse): number | null {
  if (!map.bounds) return null;
  return (map.bounds.northEast.longitude + map.bounds.southWest.longitude) / 2;
}

function toMapCenter(map: OperationalMapResponse): LngLatLike | null {
  const longitudeCenter = toLongitudeCenter(map);
  if (!map.bounds || longitudeCenter === null) return null;
  return [
    longitudeCenter,
    (map.bounds.northEast.latitude + map.bounds.southWest.latitude) / 2,
  ];
}

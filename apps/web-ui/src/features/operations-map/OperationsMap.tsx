import { useEffect } from 'react';
import L, { type DivIcon, type LatLngBoundsExpression, type LatLngExpression } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import type { OperationalMapResponse } from '@zona-cero/contracts';
import { flattenOperationalMapMarkers, resolveOperationalMarkerVariant, type OperationalMapMarker } from './mapData';

const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const osmTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const markerIconByVariant: Record<ReturnType<typeof resolveOperationalMarkerVariant>, string> = {
  selected_center: svgIcon('0 0 24 24', '<path d="M4 20V9l8-5 8 5v11"/><path d="M8 20v-7h8v7"/><path d="M12 4v16"/><path d="M15 6.5h4v4h-4"/><path d="M8 16h.01M16 16h.01"/>'),
  sos: '<span class="operations-map-marker__sos">SOS</span>',
  critical_shortage: svgIcon('0 0 24 24', '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/>'),
  pending: svgIcon('0 0 24 24', '<path d="M8 4h8l2 2v14H6V6l2-2Z"/><path d="M9 10h6M9 14h6"/><path d="M10 4h4"/>'),
  active: svgIcon('0 0 24 24', '<path d="M3 13h4l2-5 4 10 2-5h6"/>'),
  needs_medics: svgIcon('0 0 24 24', '<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z"/>'),
  surplus_resource: svgIcon('0 0 24 24', '<path d="M7 8h10l1 12H6L7 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/><path d="M12 12v5M9.5 14.5h5"/>'),
  saturated_zone: svgIcon('0 0 24 24', '<path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M4 20a4 4 0 0 1 8 0"/><path d="M12 20a4 4 0 0 1 8 0"/>'),
  observing: svgIcon('0 0 24 24', '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>'),
  dangerous_zone: svgIcon('0 0 24 24', '<path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>'),
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

export function OperationsMap({ map }: { map: OperationalMapResponse }) {
  const markers = flattenOperationalMapMarkers(map);
  const selectedCenterId = markers.find((marker) => marker.kind === 'work_center')?.id;
  const bounds = toLeafletBounds(map);
  const longitudeCenter = toLongitudeCenter(map);
  const center = toMapCenter(map) ?? ([40.4168, -3.7038] satisfies LatLngExpression);

  return (
    <div className="operations-map" aria-label={`Operational map for ${map.countryName}`}>
      <MapContainer
        key={map.countryCode}
        className="operations-map__canvas"
        center={center}
        zoom={bounds ? 6 : 6}
        scrollWheelZoom={false}
      >
        {bounds ? <FitOperationalBounds bounds={bounds} /> : null}
        <TileLayer attribution={osmAttribution} url={osmTileUrl} />
        {markers.map((marker) => {
          const selected = marker.id === selectedCenterId;
          const variant = resolveOperationalMarkerVariant(marker, selected);
          const placement = resolveMarkerPlacement(marker, longitudeCenter);

          return (
            <Marker key={marker.id} position={[marker.latitude, marker.longitude]} icon={createMarkerIcon(marker, variant, selected, placement)}>
              <Popup>
                <strong>{marker.label}</strong>
                <br />
                {marker.kind.replace('_', ' ')} · {marker.status}
                <br />
                {marker.detail}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      <p className="operations-map__attribution">Map data © OpenStreetMap contributors</p>
    </div>
  );
}

function FitOperationalBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [150, 150] });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [bounds, map]);

  return null;
}

function resolveMarkerPlacement(marker: OperationalMapMarker, longitudeCenter: number | null): 'west' | 'center' | 'east' {
  if (longitudeCenter === null) return 'center';
  if (marker.longitude > longitudeCenter) return 'east';
  if (marker.longitude < longitudeCenter) return 'west';
  return 'center';
}

function createMarkerIcon(
  marker: OperationalMapMarker,
  variant: ReturnType<typeof resolveOperationalMarkerVariant>,
  selected: boolean,
  placement: 'west' | 'center' | 'east',
): DivIcon {
  const variantClass = variant.replaceAll('_', '-');
  const label = variant === 'selected_center' ? marker.label : markerLabelByVariant[variant];
  const safeLabel = escapeHtml(label);
  const safeDetail = escapeHtml(`${marker.kind.replace('_', ' ')} · ${marker.status} · ${marker.detail}`);
  const size: [number, number] = selected ? [164, 96] : [140, 78];

  return L.divIcon({
    className: 'operations-map-marker-shell',
    iconSize: size,
    iconAnchor: [size[0] / 2, selected ? 72 : 58],
    popupAnchor: [0, selected ? -74 : -62],
    html: `<span class="operations-map-marker operations-map-marker--${variantClass} operations-map-marker--${placement}${selected ? ' operations-map-marker--selected' : ''}" data-marker-variant="${variantClass}" title="${safeDetail}"><span class="operations-map-marker__icon" aria-hidden="true">${markerIconByVariant[variant]}</span><span class="operations-map-marker__anchor" aria-hidden="true"></span><span class="operations-map-marker__label">${safeLabel}</span></span>`,
  });
}

function svgIcon(viewBox: string, paths: string): string {
  return `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false">${paths}</svg>`;
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

function toLeafletBounds(map: OperationalMapResponse): LatLngBoundsExpression | undefined {
  if (!map.bounds) return undefined;

  const latitudeSpan = map.bounds.northEast.latitude - map.bounds.southWest.latitude;
  const longitudeSpan = map.bounds.northEast.longitude - map.bounds.southWest.longitude;
  const latitudePadding = Math.max(latitudeSpan * 0.18, 0.12);
  const longitudePadding = Math.max(longitudeSpan * 0.18, 0.12);

  return [
    [clampLatitude(map.bounds.southWest.latitude - latitudePadding), clampLongitude(map.bounds.southWest.longitude - longitudePadding)],
    [clampLatitude(map.bounds.northEast.latitude + latitudePadding), clampLongitude(map.bounds.northEast.longitude + longitudePadding)],
  ];
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

function toMapCenter(map: OperationalMapResponse): LatLngExpression | null {
  if (!map.bounds) return null;
  return [
    (map.bounds.northEast.latitude + map.bounds.southWest.latitude) / 2,
    (map.bounds.northEast.longitude + map.bounds.southWest.longitude) / 2,
  ];
}

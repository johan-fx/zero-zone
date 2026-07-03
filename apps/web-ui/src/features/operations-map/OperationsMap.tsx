import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { OperationalMapResponse } from '@zona-cero/contracts';
import { flattenOperationalMapMarkers, type OperationalMapMarker } from './mapData';

const osmAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const osmTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const markerColors: Record<OperationalMapMarker['kind'], string> = {
  incident: '#2563eb',
  work_center: '#16a34a',
  sos: '#dc2626',
};

export function OperationsMap({ map }: { map: OperationalMapResponse }) {
  const markers = flattenOperationalMapMarkers(map);
  const bounds = toLeafletBounds(map);
  const center = toMapCenter(map) ?? ([40.4168, -3.7038] satisfies LatLngExpression);

  return (
    <div className="operations-map" aria-label={`Operational map for ${map.countryName}`}>
      <MapContainer
        key={map.countryCode}
        className="operations-map__canvas"
        center={center}
        zoom={bounds ? undefined : 6}
        bounds={bounds}
        scrollWheelZoom={false}
      >
        <TileLayer attribution={osmAttribution} url={osmTileUrl} />
        {markers.map((marker) => (
          <CircleMarker
            key={marker.id}
            center={[marker.latitude, marker.longitude]}
            pathOptions={{ color: markerColors[marker.kind], fillColor: markerColors[marker.kind], fillOpacity: 0.75 }}
            radius={marker.kind === 'sos' ? 10 : 8}
          >
            <Popup>
              <strong>{marker.label}</strong>
              <br />
              {marker.kind.replace('_', ' ')} · {marker.status}
              <br />
              {marker.detail}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <p className="operations-map__attribution">Map data © OpenStreetMap contributors</p>
    </div>
  );
}

function toLeafletBounds(map: OperationalMapResponse): LatLngBoundsExpression | undefined {
  if (!map.bounds) return undefined;
  return [
    [map.bounds.southWest.latitude, map.bounds.southWest.longitude],
    [map.bounds.northEast.latitude, map.bounds.northEast.longitude],
  ];
}

function toMapCenter(map: OperationalMapResponse): LatLngExpression | null {
  if (!map.bounds) return null;
  return [
    (map.bounds.northEast.latitude + map.bounds.southWest.latitude) / 2,
    (map.bounds.northEast.longitude + map.bounds.southWest.longitude) / 2,
  ];
}

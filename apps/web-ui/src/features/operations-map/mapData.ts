import type { OperationalMapResponse } from '@zona-cero/contracts';

export type MapMarkerKind = 'incident' | 'work_center' | 'sos';

export type OperationalMapMarker = {
  id: string;
  kind: MapMarkerKind;
  label: string;
  status: string;
  detail: string;
  latitude: number;
  longitude: number;
};

export function flattenOperationalMapMarkers(map: OperationalMapResponse): OperationalMapMarker[] {
  return [
    ...map.incidents.map((incident) => ({
      id: `incident:${incident.incidentId}`,
      kind: 'incident' as const,
      label: incident.name,
      status: incident.status,
      detail: incident.locationName,
      latitude: incident.location.latitude,
      longitude: incident.location.longitude,
    })),
    ...map.workCenters.map((workCenter) => ({
      id: workCenter.markerId,
      kind: 'work_center' as const,
      label: workCenter.name,
      status: workCenter.status,
      detail: `Priority ${workCenter.priority}`,
      latitude: workCenter.location.latitude,
      longitude: workCenter.location.longitude,
    })),
    ...map.sosAlerts.map((sosAlert) => ({
      id: sosAlert.markerId,
      kind: 'sos' as const,
      label: `SOS ${sosAlert.sosAlertId}`,
      status: sosAlert.status,
      detail: `Severity ${sosAlert.severity}`,
      latitude: sosAlert.location.latitude,
      longitude: sosAlert.location.longitude,
    })),
  ];
}

export function countMapMarkers(map: OperationalMapResponse): number {
  return flattenOperationalMapMarkers(map).length;
}

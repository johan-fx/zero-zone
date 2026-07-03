import type { OperationalMapResponse } from '@zona-cero/contracts';

export type MapMarkerKind = 'incident' | 'work_center' | 'sos';

export type OperationalMarkerVariant =
  | 'selected_center'
  | 'sos'
  | 'critical_shortage'
  | 'pending'
  | 'active'
  | 'needs_medics'
  | 'surplus_resource'
  | 'saturated_zone'
  | 'observing'
  | 'dangerous_zone';

export type OperationalMapMarker = {
  id: string;
  kind: MapMarkerKind;
  label: string;
  status: string;
  detail: string;
  latitude: number;
  longitude: number;
  priority?: string;
  severity?: string;
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
      priority: workCenter.priority,
    })),
    ...map.sosAlerts.map((sosAlert) => ({
      id: sosAlert.markerId,
      kind: 'sos' as const,
      label: `SOS ${sosAlert.sosAlertId}`,
      status: sosAlert.status,
      detail: `Severity ${sosAlert.severity}`,
      latitude: sosAlert.location.latitude,
      longitude: sosAlert.location.longitude,
      severity: sosAlert.severity,
    })),
  ];
}

export function resolveOperationalMarkerVariant(marker: OperationalMapMarker, selected: boolean): OperationalMarkerVariant {
  if (selected) return 'selected_center';
  if (marker.kind === 'sos') return 'sos';

  const status = marker.status.toLowerCase();
  const priority = marker.priority?.toLowerCase();

  if (status.includes('danger') || status.includes('critical')) return 'dangerous_zone';
  if (status.includes('medic') || status.includes('medical')) return 'needs_medics';
  if (status.includes('surplus')) return 'surplus_resource';
  if (status.includes('saturat') || status.includes('full')) return 'saturated_zone';

  if (marker.kind === 'work_center') {
    if (priority === 'high' && (status === 'reported' || status.includes('shortage'))) return 'critical_shortage';
    if (status === 'reported' || status === 'pending') return 'pending';
    if (status === 'active' || status === 'open') return 'active';
  }

  if (marker.kind === 'incident' && (status === 'active' || status === 'open')) return 'active';

  return 'observing';
}

export function countMapMarkers(map: OperationalMapResponse): number {
  return flattenOperationalMapMarkers(map).length;
}

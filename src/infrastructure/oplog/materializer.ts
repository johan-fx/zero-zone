import type { SignedOperation } from '@/infrastructure/security/operation-signer';

export type IncidentView = {
  incidentId: string;
  cellId: string;
  title: string;
  status: string;
  syncState: string;
  updatedAt: string;
};

export type WorkCenterMaterializedView = {
  centerId: string;
  incidentId: string;
  cellId: string;
  name: string;
  centerType?: string;
  description?: string;
  priority?: string;
  initialNeed?: string;
  confidence?: string;
  risk?: string;
  surplus?: string;
  roleCount?: number;
  location?: { latitude: number; longitude: number };
  status: 'pending';
  activationState: 'requires_evidence';
  syncState: string;
  updatedAt: string;
};

export type PresenceView = {
  presenceId: string;
  incidentId: string;
  cellId: string;
  actorId: string;
  role: string;
  centerId: string;
  status: 'active' | 'paused' | 'checked_out';
  updatedAt: string;
};

export type ResourceReportView = {
  reportId: string;
  incidentId: string;
  cellId: string;
  resource: string;
  quantity: number;
  state: string;
  syncState: string;
  updatedAt: string;
};

export type DispatchEventView = {
  dispatchEventId: string;
  incidentId: string;
  cellId: string;
  eventType: string;
  status: string;
  updatedAt: string;
};

export type SosSignalView = {
  sosId: string;
  incidentId: string;
  cellId: string;
  severity: string;
  message: string;
  status: 'open' | 'cancelled';
  updatedAt: string;
};

export type LocalSummaryView = {
  summaryId: string;
  incidentId: string;
  cellId: string;
  operationFreshness: 'local_pending';
  pendingOperations: number;
  roleCounts: Record<string, number>;
};

export type MaterializedOperationViews = {
  incidents: IncidentView[];
  workCenters: WorkCenterMaterializedView[];
  presence: PresenceView[];
  resourceReports: ResourceReportView[];
  dispatchEvents: DispatchEventView[];
  sosSignals: SosSignalView[];
  localSummaries: LocalSummaryView[];
};

export function materializeOperations(operations: readonly SignedOperation[]): MaterializedOperationViews {
  const acceptedOperations = dedupeByOpId(operations);
  const incidents = new Map<string, IncidentView>();
  const workCenters = new Map<string, WorkCenterMaterializedView>();
  const presence = new Map<string, PresenceView>();
  const resourceReports = new Map<string, ResourceReportView>();
  const dispatchEvents = new Map<string, DispatchEventView>();
  const sosSignals = new Map<string, SosSignalView>();

  for (const operation of acceptedOperations) {
    const payload = asRecord(operation.payload);

    switch (operation.opType) {
      case 'incident.create':
        incidents.set(operation.entityId, {
          incidentId: operation.entityId,
          cellId: operation.cellId,
          title: stringValue(payload.title, 'Local incident'),
          status: stringValue(payload.status, 'unverified'),
          syncState: operation.syncState,
          updatedAt: operation.createdAtDevice,
        });
        break;
      case 'work_center.create':
        workCenters.set(operation.entityId, {
          centerId: operation.entityId,
          incidentId: operation.incidentId,
          cellId: operation.cellId,
          name: stringValue(payload.name, 'Pending work center'),
          centerType: stringValue(payload.centerType, 'Work center'),
          description: stringValue(payload.description, ''),
          priority: stringValue(payload.priority, 'normal'),
          initialNeed: stringValue(payload.initialNeed, 'Water'),
          confidence: stringValue(payload.confidence, 'local estimate'),
          risk: stringValue(payload.risk, 'precaution'),
          surplus: stringValue(payload.surplus, 'none reported'),
          roleCount: numberValue(payload.roleCount, 0),
          location: locationValue(payload.location),
          status: 'pending',
          activationState: 'requires_evidence',
          syncState: operation.syncState,
          updatedAt: operation.createdAtDevice,
        });
        break;
      case 'presence.check_in':
      case 'presence.pause':
      case 'presence.check_out':
        presence.set(operation.entityId, {
          presenceId: operation.entityId,
          incidentId: operation.incidentId,
          cellId: operation.cellId,
          actorId: stringValue(payload.actorId, operation.actorKeyId),
          role: stringValue(payload.role, 'volunteer'),
          centerId: stringValue(payload.centerId, ''),
          status: resolvePresenceStatus(operation.opType),
          updatedAt: operation.createdAtDevice,
        });
        break;
      case 'resource_report.create':
        resourceReports.set(operation.entityId, {
          reportId: operation.entityId,
          incidentId: operation.incidentId,
          cellId: operation.cellId,
          resource: stringValue(payload.resource, 'unknown'),
          quantity: numberValue(payload.quantity, 0),
          state: stringValue(payload.state, 'needed'),
          syncState: operation.syncState,
          updatedAt: operation.createdAtDevice,
        });
        break;
      case 'dispatch_event.create':
      case 'dispatch_event.update':
        dispatchEvents.set(operation.entityId, {
          dispatchEventId: operation.entityId,
          incidentId: operation.incidentId,
          cellId: operation.cellId,
          eventType: stringValue(payload.eventType, dispatchEvents.get(operation.entityId)?.eventType ?? 'placeholder'),
          status: stringValue(payload.status, dispatchEvents.get(operation.entityId)?.status ?? 'open'),
          updatedAt: operation.createdAtDevice,
        });
        break;
      case 'sos.create':
        sosSignals.set(operation.entityId, {
          sosId: operation.entityId,
          incidentId: operation.incidentId,
          cellId: operation.cellId,
          severity: stringValue(payload.severity, 'critical'),
          message: stringValue(payload.message, ''),
          status: 'open',
          updatedAt: operation.createdAtDevice,
        });
        break;
      case 'sos.cancel': {
        const existing = sosSignals.get(operation.entityId);
        sosSignals.set(operation.entityId, {
          sosId: operation.entityId,
          incidentId: operation.incidentId,
          cellId: operation.cellId,
          severity: existing?.severity ?? 'critical',
          message: existing?.message ?? stringValue(payload.message, ''),
          status: 'cancelled',
          updatedAt: operation.createdAtDevice,
        });
        break;
      }
    }
  }

  const firstOperation = acceptedOperations[0];

  return {
    incidents: Array.from(incidents.values()),
    workCenters: Array.from(workCenters.values()),
    presence: Array.from(presence.values()),
    resourceReports: Array.from(resourceReports.values()),
    dispatchEvents: Array.from(dispatchEvents.values()),
    sosSignals: Array.from(sosSignals.values()),
    localSummaries: firstOperation
      ? [
          {
            summaryId: `${firstOperation.incidentId}:${firstOperation.cellId}`,
            incidentId: firstOperation.incidentId,
            cellId: firstOperation.cellId,
            operationFreshness: 'local_pending',
            pendingOperations: acceptedOperations.filter((operation) => operation.syncState === 'pending').length,
            roleCounts: countRoles(Array.from(presence.values())),
          },
        ]
      : [],
  };
}

function dedupeByOpId(operations: readonly SignedOperation[]): SignedOperation[] {
  const byId = new Map<string, SignedOperation>();

  for (const operation of operations) {
    byId.set(operation.opId, operation);
  }

  return Array.from(byId.values()).sort((left, right) => left.hlc.localeCompare(right.hlc));
}

function resolvePresenceStatus(opType: SignedOperation['opType']): PresenceView['status'] {
  if (opType === 'presence.pause') {
    return 'paused';
  }

  if (opType === 'presence.check_out') {
    return 'checked_out';
  }

  return 'active';
}

function countRoles(presence: PresenceView[]): Record<string, number> {
  return presence.reduce<Record<string, number>>((counts, session) => {
    if (session.status !== 'checked_out') {
      counts[session.role] = (counts[session.role] ?? 0) + 1;
    }

    return counts;
  }, {});
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

function locationValue(value: unknown): { latitude: number; longitude: number } | undefined {
  const record = asRecord(value);
  const latitude = record.latitude ?? record.lat;
  const longitude = record.longitude ?? record.lng;

  return typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : undefined;
}

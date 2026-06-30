import { DispatchEventCreatePayloadSchema, DispatchEventUpdatePayloadSchema, ResourceReportPayloadSchema, type DispatchTaskStatus, type ResourceReportKind, type ResourceReportUrgency } from '@zona-cero/contracts';
import { WorkCenterCreatePayloadSchema } from '@zona-cero/contracts';
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
  surplus?: string;
  location?: { latitude: number; longitude: number };
  status: 'pending';
  provisional: true;
  provisionalReason: 'offline_pending_sync';
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
  workCenterId?: string;
  category: string;
  quantityApprox: string;
  urgency: ResourceReportUrgency;
  constraints: string[];
  reportKind: ResourceReportKind;
  provisional: true;
  provisionalReason: 'offline_pending_sync';
  syncState: string;
  updatedAt: string;
};

export type DispatchEventView = {
  dispatchEventId: string;
  dispatchTaskId: string;
  incidentId: string;
  cellId: string;
  category: string;
  quantityApprox: string;
  fromResourceReportId?: string;
  toResourceReportId?: string;
  targetWorkCenterId?: string;
  notes?: string;
  status: DispatchTaskStatus;
  provisional: boolean;
  provisionalReason: 'offline_pending_sync' | 'local_update_pending_sync';
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
          ...materializeWorkCenterCreatePayload(payload),
          status: 'pending',
          provisional: true,
          provisionalReason: 'offline_pending_sync',
          syncState: operation.syncState,
          updatedAt: operation.createdAtDevice,
        });
        break;
      case 'presence.check_in':
      case 'presence.pause':
      case 'presence.check_out': {
        const existing = presence.get(operation.entityId);
        presence.set(operation.entityId, {
          presenceId: operation.entityId,
          incidentId: operation.incidentId,
          cellId: operation.cellId,
          actorId: stringValue(payload.actorId, existing?.actorId ?? operation.actorKeyId),
          role: stringValue(payload.role, existing?.role ?? 'volunteer'),
          centerId: stringValue(payload.centerId, existing?.centerId ?? ''),
          status: resolvePresenceStatus(operation.opType),
          updatedAt: operation.createdAtDevice,
        });
        break;
      }
      case 'resource_report.create':
        resourceReports.set(operation.entityId, {
          reportId: operation.entityId,
          incidentId: operation.incidentId,
          cellId: operation.cellId,
          ...materializeResourceReportCreatePayload(payload),
          provisional: true,
          provisionalReason: 'offline_pending_sync',
          syncState: operation.syncState,
          updatedAt: operation.createdAtDevice,
        });
        break;
      case 'dispatch_event.create':
      case 'dispatch_event.update':
        dispatchEvents.set(operation.entityId, {
          dispatchEventId: operation.entityId,
          dispatchTaskId: operation.entityId,
          incidentId: operation.incidentId,
          cellId: operation.cellId,
          ...materializeDispatchEventPayload(operation.opType, payload, dispatchEvents.get(operation.entityId)),
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

  const summaries = createLocalSummaries(acceptedOperations, Array.from(presence.values()));

  return {
    incidents: Array.from(incidents.values()),
    workCenters: Array.from(workCenters.values()),
    presence: Array.from(presence.values()),
    resourceReports: Array.from(resourceReports.values()),
    dispatchEvents: Array.from(dispatchEvents.values()),
    sosSignals: Array.from(sosSignals.values()),
    localSummaries: summaries,
  };
}

function createLocalSummaries(operations: readonly SignedOperation[], presence: PresenceView[]): LocalSummaryView[] {
  const summaries = new Map<string, LocalSummaryView>();

  for (const operation of operations) {
    const summaryId = `${operation.incidentId}:${operation.cellId}`;
    const existing = summaries.get(summaryId);

    summaries.set(summaryId, {
      summaryId,
      incidentId: operation.incidentId,
      cellId: operation.cellId,
      operationFreshness: 'local_pending',
      pendingOperations: (existing?.pendingOperations ?? 0) + (operation.syncState === 'pending' ? 1 : 0),
      roleCounts: existing?.roleCounts ?? {},
    });
  }

  for (const summary of summaries.values()) {
    summary.roleCounts = countRoles(presence.filter((session) => session.incidentId === summary.incidentId && session.cellId === summary.cellId));
  }

  return Array.from(summaries.values());
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

function materializeWorkCenterCreatePayload(payload: Record<string, unknown>): Pick<WorkCenterMaterializedView, 'name' | 'centerType' | 'description' | 'priority' | 'initialNeed' | 'surplus' | 'location'> {
  const parsedPayload = WorkCenterCreatePayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return {
      name: stringValue(payload.name, 'Pending work center'),
      centerType: stringValue(payload.centerType, 'Work center'),
      description: optionalStringValue(payload.description),
      priority: stringValue(payload.priority, 'medium'),
      initialNeed: optionalStringValue(payload.initialNeed),
      surplus: optionalStringValue(payload.surplus),
    };
  }

  return parsedPayload.data;
}

function materializeResourceReportCreatePayload(payload: Record<string, unknown>): Pick<ResourceReportView, 'workCenterId' | 'category' | 'quantityApprox' | 'urgency' | 'constraints' | 'reportKind'> {
  const parsedPayload = ResourceReportPayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return {
      category: stringValue(payload.category, stringValue(payload.resource, 'unknown')),
      quantityApprox: stringValue(payload.quantityApprox, typeof payload.quantity === 'number' ? String(payload.quantity) : 'unknown'),
      urgency: parseResourceUrgency(payload.urgency),
      constraints: parseStringArray(payload.constraints),
      reportKind: parseResourceReportKind(payload.reportKind ?? payload.state),
      workCenterId: optionalStringValue(payload.workCenterId),
    };
  }

  return parsedPayload.data;
}

function materializeDispatchEventPayload(
  opType: SignedOperation['opType'],
  payload: Record<string, unknown>,
  existing: DispatchEventView | undefined,
): Pick<DispatchEventView, 'category' | 'quantityApprox' | 'fromResourceReportId' | 'toResourceReportId' | 'targetWorkCenterId' | 'notes' | 'status' | 'provisional' | 'provisionalReason'> {
  if (opType === 'dispatch_event.update') {
    const parsedPayload = DispatchEventUpdatePayloadSchema.safeParse(payload);

    return {
      category: existing?.category ?? 'unknown',
      quantityApprox: existing?.quantityApprox ?? 'unknown',
      fromResourceReportId: existing?.fromResourceReportId,
      toResourceReportId: existing?.toResourceReportId,
      targetWorkCenterId: existing?.targetWorkCenterId,
      notes: parsedPayload.success ? parsedPayload.data.notes ?? existing?.notes : optionalStringValue(payload.notes) ?? existing?.notes,
      status: parsedPayload.success ? parsedPayload.data.status : parseDispatchStatus(payload.status, existing?.status ?? 'pending'),
      provisional: true,
      provisionalReason: 'local_update_pending_sync',
    };
  }

  const parsedPayload = DispatchEventCreatePayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return {
      category: stringValue(payload.category, stringValue(payload.eventType, 'unknown')),
      quantityApprox: stringValue(payload.quantityApprox, 'unknown'),
      fromResourceReportId: optionalStringValue(payload.fromResourceReportId),
      toResourceReportId: optionalStringValue(payload.toResourceReportId),
      targetWorkCenterId: optionalStringValue(payload.targetWorkCenterId),
      notes: optionalStringValue(payload.notes),
      status: parseDispatchStatus(payload.status, 'pending'),
      provisional: true,
      provisionalReason: 'offline_pending_sync',
    };
  }

  return {
    ...parsedPayload.data,
    status: parsedPayload.data.status ?? 'pending',
    provisional: true,
    provisionalReason: 'offline_pending_sync',
  };
}

function optionalStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function parseResourceReportKind(value: unknown): ResourceReportKind {
  return value === 'surplus' ? 'surplus' : 'needed';
}

function parseResourceUrgency(value: unknown): ResourceReportUrgency {
  return value === 'low' || value === 'high' || value === 'critical' ? value : 'medium';
}

function parseDispatchStatus(value: unknown, fallback: DispatchTaskStatus): DispatchTaskStatus {
  return value === 'accepted' || value === 'en_route' || value === 'delivered' || value === 'cancelled' || value === 'pending' ? value : fallback;
}

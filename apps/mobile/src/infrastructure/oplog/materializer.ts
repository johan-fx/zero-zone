import {
  DispatchEventCreatePayloadSchema,
  DispatchEventUpdatePayloadSchema,
  ResourceReportPayloadSchema,
  SosCreatePayloadSchema,
  TrustStateSchema,
  WorkCenterCreatePayloadSchema,
  type DispatchTaskStatus,
  type ResourceReportKind,
  type ResourceReportUrgency,
  type SosLocation,
  type TrustStatus,
  type TrustSubject,
  type TrustVisibility,
} from '@zona-cero/contracts';
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
  trustStatus?: LocalTrustStatus;
  trustVisibility?: TrustVisibility;
  trustSignalCount?: number;
  trustDisputeCount?: number;
  trustExplanation?: string[];
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
  trustStatus?: LocalTrustStatus;
  trustVisibility?: TrustVisibility;
  trustSignalCount?: number;
  trustDisputeCount?: number;
  trustExplanation?: string[];
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
  location?: SosLocation;
  status: 'open' | 'cancelled';
  syncState: string;
  trustStatus?: LocalTrustStatus;
  trustVisibility?: TrustVisibility;
  trustSignalCount?: number;
  trustDisputeCount?: number;
  trustExplanation?: string[];
  provisional: true;
  provisionalReason: 'offline_pending_sync';
  updatedAt: string;
};

type LocalTrustStatus = TrustStatus | 'pending' | 'unverified';

export type TrustStateView = {
  trustStateId: string;
  incidentId: string;
  subject: TrustSubject;
  subjectEntityType: TrustSubject['entityType'];
  subjectEntityId: string;
  status: LocalTrustStatus;
  visibility: TrustVisibility;
  priorityWeight: number;
  score: number;
  explanation: string[];
  signalCount: number;
  disputeCount: number;
  syncState: string;
  provisional: true;
  provisionalReason: 'offline_pending_canonical_scoring' | 'local_dispute_pending_canonical_scoring' | 'server_canonical';
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
  trustStates: TrustStateView[];
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
  const trustStates = new Map<string, TrustStateView>();

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
          ...materializeSosCreatePayload(payload),
          status: 'open',
          syncState: operation.syncState,
          provisional: true,
          provisionalReason: 'offline_pending_sync',
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
          message: existing?.message ?? stringValue(payload.reason, ''),
          ...(existing?.location ? { location: existing.location } : {}),
          status: 'cancelled',
          syncState: operation.syncState,
          provisional: true,
          provisionalReason: 'offline_pending_sync',
          updatedAt: operation.createdAtDevice,
        });
        break;
      }
      case 'trust_signal.create':
      case 'dispute.create': {
        const trustState = materializeTrustOperation(operation, payload, trustStates);

        if (trustState) {
          trustStates.set(trustState.trustStateId, trustState);
        }

        break;
      }
    }
  }

  applyTrustStatesToSubjectViews(Array.from(trustStates.values()), { workCenters, resourceReports, sosSignals });
  const summaries = createLocalSummaries(acceptedOperations, Array.from(presence.values()));

  return {
    incidents: Array.from(incidents.values()),
    workCenters: Array.from(workCenters.values()),
    presence: Array.from(presence.values()),
    resourceReports: Array.from(resourceReports.values()),
    dispatchEvents: Array.from(dispatchEvents.values()),
    sosSignals: Array.from(sosSignals.values()),
    trustStates: Array.from(trustStates.values()),
    localSummaries: summaries,
  };
}

function materializeTrustOperation(operation: SignedOperation, payload: Record<string, unknown>, existingTrustStates: ReadonlyMap<string, TrustStateView>): TrustStateView | null {
  const subject = parseTrustSubject(payload.subject);

  if (!subject) {
    return null;
  }

  const canonical = TrustStateSchema.safeParse(payload.trustState);
  const trustStateId = trustStateIdForSubject(operation.incidentId, subject);
  const existing = existingTrustStates.get(trustStateId);

  if (canonical.success) {
    return {
      trustStateId,
      incidentId: canonical.data.incidentId,
      subject: canonical.data.subject,
      subjectEntityType: canonical.data.subject.entityType,
      subjectEntityId: canonical.data.subject.entityId,
      status: canonical.data.status,
      visibility: canonical.data.visibility,
      priorityWeight: canonical.data.priorityWeight,
      score: canonical.data.score,
      explanation: canonical.data.explanation,
      signalCount: canonical.data.signalCount,
      disputeCount: canonical.data.disputeCount,
      syncState: operation.syncState,
      provisional: true,
      provisionalReason: 'server_canonical',
      updatedAt: canonical.data.updatedAt,
    };
  }

  if (operation.opType === 'dispute.create') {
    return {
      trustStateId,
      incidentId: operation.incidentId,
      subject,
      subjectEntityType: subject.entityType,
      subjectEntityId: subject.entityId,
      status: 'disputed',
      visibility: 'limited',
      priorityWeight: 0,
      score: 0,
      explanation: ['local_dispute_pending_canonical_scoring'],
      signalCount: existing?.signalCount ?? 0,
      disputeCount: (existing?.disputeCount ?? 0) + 1,
      syncState: operation.syncState,
      provisional: true,
      provisionalReason: 'local_dispute_pending_canonical_scoring',
      updatedAt: operation.createdAtDevice,
    };
  }

  const signalType = stringValue(payload.signalType, '');
  const status: LocalTrustStatus = signalType === 'negative_report' ? 'degraded' : 'pending_corroboration';
  const nextSignalCount = (existing?.signalCount ?? 0) + 1;

  if (existing?.status === 'disputed' || existing?.status === 'degraded') {
    return {
      ...existing,
      signalCount: nextSignalCount,
      syncState: operation.syncState,
      updatedAt: operation.createdAtDevice,
    };
  }

  return {
    trustStateId,
    incidentId: operation.incidentId,
    subject,
    subjectEntityType: subject.entityType,
    subjectEntityId: subject.entityId,
    status,
    visibility: status === 'degraded' ? 'limited' : 'normal',
    priorityWeight: 0,
    score: 0,
    explanation: ['local_signal_pending_canonical_scoring'],
    signalCount: nextSignalCount,
    disputeCount: existing?.disputeCount ?? 0,
    syncState: operation.syncState,
    provisional: true,
    provisionalReason: 'offline_pending_canonical_scoring',
    updatedAt: operation.createdAtDevice,
  };
}

function parseTrustSubject(value: unknown): TrustSubject | null {
  const subject = asRecord(value);
  const entityType = subject.entityType;
  const entityId = subject.entityId;
  const incidentId = subject.incidentId;
  const displayRef = subject.displayRef;

  if (!isTrustSubjectEntityType(entityType) || typeof entityId !== 'string' || entityId.length === 0 || typeof incidentId !== 'string' || incidentId.length === 0) {
    return null;
  }

  return {
    entityType,
    entityId,
    incidentId,
    ...(typeof displayRef === 'string' && displayRef.length > 0 ? { displayRef } : {}),
  };
}

function isTrustSubjectEntityType(value: unknown): value is TrustSubject['entityType'] {
  return value === 'channel_identity' || value === 'incident_membership' || value === 'work_center' || value === 'resource_report' || value === 'dispatch_task' || value === 'sos_alert' || value === 'custom';
}

function applyTrustStatesToSubjectViews(
  trustStates: TrustStateView[],
  views: {
    workCenters: Map<string, WorkCenterMaterializedView>;
    resourceReports: Map<string, ResourceReportView>;
    sosSignals: Map<string, SosSignalView>;
  },
): void {
  for (const trustState of trustStates) {
    const trustProjection = {
      trustStatus: trustState.status,
      trustVisibility: trustState.visibility,
      trustSignalCount: trustState.signalCount,
      trustDisputeCount: trustState.disputeCount,
      trustExplanation: trustState.explanation,
    };

    if (trustState.subjectEntityType === 'work_center') {
      const center = views.workCenters.get(trustState.subjectEntityId);
      if (center) {
        views.workCenters.set(center.centerId, { ...center, ...trustProjection });
      }
    }

    if (trustState.subjectEntityType === 'resource_report') {
      const report = views.resourceReports.get(trustState.subjectEntityId);
      if (report) {
        views.resourceReports.set(report.reportId, { ...report, ...trustProjection });
      }
    }

    if (trustState.subjectEntityType === 'sos_alert') {
      const signal = views.sosSignals.get(trustState.subjectEntityId);
      if (signal) {
        views.sosSignals.set(signal.sosId, { ...signal, ...trustProjection });
      }
    }
  }
}

function trustStateIdForSubject(incidentId: string, subject: TrustSubject): string {
  return `${incidentId}:${subject.entityType}:${subject.entityId}`;
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

function materializeSosCreatePayload(payload: Record<string, unknown>): Pick<SosSignalView, 'severity' | 'message' | 'location'> {
  const parsedPayload = SosCreatePayloadSchema.safeParse(payload);

  if (!parsedPayload.success) {
    return {
      severity: stringValue(payload.severity, 'critical'),
      message: stringValue(payload.message, ''),
    };
  }

  return {
    severity: parsedPayload.data.severity,
    message: parsedPayload.data.message ?? '',
    ...(parsedPayload.data.location ? { location: parsedPayload.data.location } : {}),
  };
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

import { Bot, type Context } from 'grammy';

import {
  IncidentConfigResponseSchema,
  IncidentJoinRequestSchema,
  IncidentJoinResponseSchema,
  IncidentRoleSchema,
  IncidentSummarySchema,
  PrivateWebLinkIssueRequestSchema,
  PrivateWebLinkIssueResponseSchema,
  DispatchTaskConnectedUpdateRequestSchema,
  DispatchTaskListResponseSchema,
  DispatchTaskResponseSchema,
  ResourceReportConnectedCreateRequestSchema,
  ResourceReportCreateResponseSchema,
  SosAlertCreateResponseSchema,
  SosConnectedCreateRequestSchema,
  WorkCenterConnectedCreateRequestSchema,
  WorkCenterCreateResponseSchema,
  type DispatchTask,
  type DispatchTaskConnectedUpdateRequest,
  type DispatchTaskListResponse,
  type DispatchTaskResponse,
  type DispatchTaskStatus,
  type ResourceReportConnectedCreateRequest,
  type ResourceReportCreateResponse,
  type ResourceReportKind,
  type ResourceReportUrgency,
  type SosAlertCreateResponse,
  type SosConnectedCreateRequest,
  type WorkCenterConnectedCreateRequest,
  type WorkCenterCreateResponse,
  type IncidentConfigResponse,
  type IncidentJoinRequest,
  type IncidentJoinResponse,
  type IncidentListResponse,
  type IncidentRole,
  type IncidentSummary,
  type PrivateWebLinkIssueRequest,
  type PrivateWebLinkIssueResponse,
  type TelegramWebhookResult,
} from '@zona-cero/contracts';

export type TelegramUpdateLike = {
  message?: {
    text?: string;
    chat?: { id?: number | string; type?: string };
    from?: { id?: number | string; first_name?: string };
  };
};

export type TelegramIncidentJoinPorts = {
  listIncidents(): Promise<IncidentListResponse>;
  getIncidentConfig(incidentId: string): Promise<IncidentConfigResponse>;
  joinIncident(incidentId: string, request: IncidentJoinRequest): Promise<IncidentJoinResponse>;
};

export type TelegramWorkCenterReportPorts = {
  listIncidents(): Promise<IncidentListResponse>;
  createWorkCenter(incidentId: string, request: WorkCenterConnectedCreateRequest): Promise<WorkCenterCreateResponse>;
};

export type TelegramResourceReportPorts = {
  listIncidents(): Promise<IncidentListResponse>;
  createResourceReport(incidentId: string, request: ResourceReportConnectedCreateRequest): Promise<ResourceReportCreateResponse>;
};

export type TelegramDispatchTaskPorts = {
  listIncidents(): Promise<IncidentListResponse>;
  listDispatchTasks(incidentId: string): Promise<DispatchTaskListResponse>;
  updateDispatchTask(incidentId: string, dispatchTaskId: string, request: DispatchTaskConnectedUpdateRequest): Promise<DispatchTaskResponse>;
};

export type TelegramSosPorts = {
  listIncidents(): Promise<IncidentListResponse>;
  createSosAlert(incidentId: string, request: SosConnectedCreateRequest): Promise<SosAlertCreateResponse>;
};

export type TelegramFamilyReunificationPorts = {
  listIncidents(): Promise<IncidentListResponse>;
  createPrivateLink(incidentId: string, request: PrivateWebLinkIssueRequest): Promise<PrivateWebLinkIssueResponse>;
  formatPrivateLinkUrl?(response: PrivateWebLinkIssueResponse): string;
};

export type TelegramIncidentJoinState =
  | { step: 'idle' }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string }
  | { step: 'awaitingPseudonym'; incident: IncidentSummary; externalUserId: string }
  | { step: 'awaitingRole'; config: IncidentConfigResponse; externalUserId: string; pseudonym: string }
  | { step: 'joined'; response: IncidentJoinResponse }
  | { step: 'cancelled' };

export type TelegramResourceReportState =
  | { step: 'idle' }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; displayName?: string }
  | { step: 'awaitingKind'; incident: IncidentSummary; externalUserId: string; displayName?: string }
  | { step: 'awaitingCategory'; incident: IncidentSummary; externalUserId: string; displayName?: string; reportKind: ResourceReportKind }
  | { step: 'awaitingQuantity'; incident: IncidentSummary; externalUserId: string; displayName?: string; reportKind: ResourceReportKind; category: string }
  | { step: 'awaitingUrgency'; incident: IncidentSummary; externalUserId: string; displayName?: string; reportKind: ResourceReportKind; category: string; quantityApprox: string }
  | { step: 'awaitingConstraints'; incident: IncidentSummary; externalUserId: string; displayName?: string; reportKind: ResourceReportKind; category: string; quantityApprox: string; urgency: ResourceReportUrgency }
  | { step: 'awaitingWorkCenter'; incident: IncidentSummary; externalUserId: string; displayName?: string; request: ResourceReportConnectedCreateRequest }
  | { step: 'awaitingConfirmation'; incident: IncidentSummary; externalUserId: string; displayName?: string; request: ResourceReportConnectedCreateRequest }
  | { step: 'reported'; response: ResourceReportCreateResponse }
  | { step: 'cancelled' };

export type TelegramDispatchTaskState =
  | { step: 'idle' }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string }
  | { step: 'awaitingTask'; incident: IncidentSummary; tasks: DispatchTask[]; externalUserId: string }
  | { step: 'awaitingStatus'; incident: IncidentSummary; task: DispatchTask; externalUserId: string }
  | { step: 'awaitingConfirmation'; incident: IncidentSummary; task: DispatchTask; externalUserId: string; request: DispatchTaskConnectedUpdateRequest }
  | { step: 'updated'; response: DispatchTaskResponse }
  | { step: 'cancelled' };

export type TelegramSosState =
  | { step: 'idle' }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; displayName?: string }
  | { step: 'awaitingConfirmation'; incident: IncidentSummary; externalUserId: string; displayName?: string; request: SosConnectedCreateRequest }
  | { step: 'submitted'; response: SosAlertCreateResponse }
  | { step: 'cancelled' };

export type TelegramFamilyReunificationState =
  | { step: 'idle' }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; displayName?: string }
  | { step: 'linked'; response: PrivateWebLinkIssueResponse }
  | { step: 'cancelled' };

export type TelegramWorkCenterReportState =
  | { step: 'idle' }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; displayName?: string }
  | { step: 'awaitingName'; incident: IncidentSummary; externalUserId: string; displayName?: string }
  | {
      step: 'awaitingConfirmation';
      incident: IncidentSummary;
      externalUserId: string;
      displayName?: string;
      request: WorkCenterConnectedCreateRequest;
    }
  | { step: 'reported'; response: WorkCenterCreateResponse }
  | { step: 'cancelled' };

type TelegramIncidentJoinStateParseResult =
  | { success: true; data: TelegramIncidentJoinState }
  | { success: false; error: Error };

type TelegramWorkCenterReportStateParseResult =
  | { success: true; data: TelegramWorkCenterReportState }
  | { success: false; error: Error };

type TelegramResourceReportStateParseResult =
  | { success: true; data: TelegramResourceReportState }
  | { success: false; error: Error };

type TelegramDispatchTaskStateParseResult =
  | { success: true; data: TelegramDispatchTaskState }
  | { success: false; error: Error };

type TelegramSosStateParseResult =
  | { success: true; data: TelegramSosState }
  | { success: false; error: Error };

type TelegramFamilyReunificationStateParseResult =
  | { success: true; data: TelegramFamilyReunificationState }
  | { success: false; error: Error };

export const TelegramIncidentJoinStateSchema = {
  parse: parseTelegramIncidentJoinState,
  safeParse: safeParseTelegramIncidentJoinState,
} as const;

export const TelegramWorkCenterReportStateSchema = {
  parse: parseTelegramWorkCenterReportState,
  safeParse: safeParseTelegramWorkCenterReportState,
} as const;

export const TelegramResourceReportStateSchema = {
  parse: parseTelegramResourceReportState,
  safeParse: safeParseTelegramResourceReportState,
} as const;

export const TelegramDispatchTaskStateSchema = {
  parse: parseTelegramDispatchTaskState,
  safeParse: safeParseTelegramDispatchTaskState,
} as const;

export const TelegramSosStateSchema = {
  parse: parseTelegramSosState,
  safeParse: safeParseTelegramSosState,
} as const;

export const TelegramFamilyReunificationStateSchema = {
  parse: parseTelegramFamilyReunificationState,
  safeParse: safeParseTelegramFamilyReunificationState,
} as const;

export function parseTelegramIncidentJoinState(value: unknown): TelegramIncidentJoinState {
  const parsed = parseTelegramIncidentJoinStateValue(value);
  if (!parsed) {
    throw new Error('Invalid TelegramIncidentJoinState');
  }

  return parsed;
}

export function safeParseTelegramIncidentJoinState(value: unknown): TelegramIncidentJoinStateParseResult {
  try {
    return { success: true, data: parseTelegramIncidentJoinState(value) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error('Invalid TelegramIncidentJoinState') };
  }
}

export function parseTelegramWorkCenterReportState(value: unknown): TelegramWorkCenterReportState {
  const parsed = parseTelegramWorkCenterReportStateValue(value);
  if (!parsed) {
    throw new Error('Invalid TelegramWorkCenterReportState');
  }

  return parsed;
}

export function safeParseTelegramWorkCenterReportState(value: unknown): TelegramWorkCenterReportStateParseResult {
  try {
    return { success: true, data: parseTelegramWorkCenterReportState(value) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error('Invalid TelegramWorkCenterReportState') };
  }
}

export function parseTelegramResourceReportState(value: unknown): TelegramResourceReportState {
  const parsed = parseTelegramResourceReportStateValue(value);
  if (!parsed) {
    throw new Error('Invalid TelegramResourceReportState');
  }

  return parsed;
}

export function safeParseTelegramResourceReportState(value: unknown): TelegramResourceReportStateParseResult {
  try {
    return { success: true, data: parseTelegramResourceReportState(value) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error('Invalid TelegramResourceReportState') };
  }
}

export function parseTelegramDispatchTaskState(value: unknown): TelegramDispatchTaskState {
  const parsed = parseTelegramDispatchTaskStateValue(value);
  if (!parsed) {
    throw new Error('Invalid TelegramDispatchTaskState');
  }

  return parsed;
}

export function safeParseTelegramDispatchTaskState(value: unknown): TelegramDispatchTaskStateParseResult {
  try {
    return { success: true, data: parseTelegramDispatchTaskState(value) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error('Invalid TelegramDispatchTaskState') };
  }
}

export function parseTelegramSosState(value: unknown): TelegramSosState {
  const parsed = parseTelegramSosStateValue(value);
  if (!parsed) {
    throw new Error('Invalid TelegramSosState');
  }

  return parsed;
}

export function safeParseTelegramSosState(value: unknown): TelegramSosStateParseResult {
  try {
    return { success: true, data: parseTelegramSosState(value) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error('Invalid TelegramSosState') };
  }
}

export function parseTelegramFamilyReunificationState(value: unknown): TelegramFamilyReunificationState {
  const parsed = parseTelegramFamilyReunificationStateValue(value);
  if (!parsed) {
    throw new Error('Invalid TelegramFamilyReunificationState');
  }

  return parsed;
}

export function safeParseTelegramFamilyReunificationState(value: unknown): TelegramFamilyReunificationStateParseResult {
  try {
    return { success: true, data: parseTelegramFamilyReunificationState(value) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error('Invalid TelegramFamilyReunificationState') };
  }
}

export function isTerminalTelegramIncidentJoinState(
  state: TelegramIncidentJoinState,
): state is Extract<TelegramIncidentJoinState, { step: 'joined' | 'cancelled' }> {
  return state.step === 'joined' || state.step === 'cancelled';
}

export function isTerminalTelegramWorkCenterReportState(
  state: TelegramWorkCenterReportState,
): state is Extract<TelegramWorkCenterReportState, { step: 'reported' | 'cancelled' }> {
  return state.step === 'reported' || state.step === 'cancelled';
}

export function isTerminalTelegramResourceReportState(
  state: TelegramResourceReportState,
): state is Extract<TelegramResourceReportState, { step: 'reported' | 'cancelled' }> {
  return state.step === 'reported' || state.step === 'cancelled';
}

export function isTerminalTelegramDispatchTaskState(
  state: TelegramDispatchTaskState,
): state is Extract<TelegramDispatchTaskState, { step: 'updated' | 'cancelled' }> {
  return state.step === 'updated' || state.step === 'cancelled';
}

export function isTerminalTelegramSosState(
  state: TelegramSosState,
): state is Extract<TelegramSosState, { step: 'submitted' | 'cancelled' }> {
  return state.step === 'submitted' || state.step === 'cancelled';
}

export function isTerminalTelegramFamilyReunificationState(
  state: TelegramFamilyReunificationState,
): state is Extract<TelegramFamilyReunificationState, { step: 'linked' | 'cancelled' }> {
  return state.step === 'linked' || state.step === 'cancelled';
}

function parseTelegramIncidentJoinStateValue(value: unknown): TelegramIncidentJoinState | null {
  if (!isRecord(value) || typeof value.step !== 'string') {
    return null;
  }

  if (value.step === 'idle') {
    return hasOnlyKeys(value, ['step']) ? { step: 'idle' } : null;
  }

  if (value.step === 'cancelled') {
    return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;
  }

  if (value.step === 'awaitingIncident') {
    if (
      !hasOnlyKeys(value, ['step', 'incidents', 'externalUserId']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      !Array.isArray(value.incidents)
    ) {
      return null;
    }

    const incidents: IncidentSummary[] = [];
    for (const incidentValue of value.incidents) {
      const incident = IncidentSummarySchema.safeParse(incidentValue);
      if (!incident.success) {
        return null;
      }
      incidents.push(incident.data);
    }

    return {
      step: 'awaitingIncident',
      incidents,
      externalUserId: value.externalUserId,
    };
  }

  if (value.step === 'awaitingPseudonym') {
    const incident = IncidentSummarySchema.safeParse(value.incident);
    if (
      !hasOnlyKeys(value, ['step', 'incident', 'externalUserId']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      !incident.success
    ) {
      return null;
    }

    return { step: 'awaitingPseudonym', incident: incident.data, externalUserId: value.externalUserId };
  }

  if (value.step === 'awaitingRole') {
    const config = IncidentConfigResponseSchema.safeParse(value.config);
    if (
      !hasOnlyKeys(value, ['step', 'config', 'externalUserId', 'pseudonym']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      typeof value.pseudonym !== 'string' ||
      value.pseudonym.length === 0 ||
      !config.success
    ) {
      return null;
    }

    return {
      step: 'awaitingRole',
      config: config.data,
      externalUserId: value.externalUserId,
      pseudonym: value.pseudonym,
    };
  }

  if (value.step === 'joined') {
    const response = IncidentJoinResponseSchema.safeParse(value.response);
    if (!hasOnlyKeys(value, ['step', 'response']) || !response.success) {
      return null;
    }

    return { step: 'joined', response: response.data };
  }

  return null;
}


function parseTelegramWorkCenterReportStateValue(value: unknown): TelegramWorkCenterReportState | null {
  if (!isRecord(value) || typeof value.step !== 'string') {
    return null;
  }

  if (value.step === 'idle') {
    return hasOnlyKeys(value, ['step']) ? { step: 'idle' } : null;
  }

  if (value.step === 'cancelled') {
    return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;
  }

  if (value.step === 'awaitingIncident') {
    if (
      !hasOnlyKeys(value, ['step', 'incidents', 'externalUserId', 'displayName']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      !isOptionalString(value.displayName) ||
      !Array.isArray(value.incidents)
    ) {
      return null;
    }

    const incidents: IncidentSummary[] = [];
    for (const incidentValue of value.incidents) {
      const incident = IncidentSummarySchema.safeParse(incidentValue);
      if (!incident.success) {
        return null;
      }
      incidents.push(incident.data);
    }

    return {
      step: 'awaitingIncident',
      incidents,
      externalUserId: value.externalUserId,
      ...(value.displayName ? { displayName: value.displayName } : {}),
    };
  }

  if (value.step === 'awaitingName') {
    const incident = IncidentSummarySchema.safeParse(value.incident);
    if (
      !hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      !isOptionalString(value.displayName) ||
      !incident.success
    ) {
      return null;
    }

    return {
      step: 'awaitingName',
      incident: incident.data,
      externalUserId: value.externalUserId,
      ...(value.displayName ? { displayName: value.displayName } : {}),
    };
  }

  if (value.step === 'awaitingConfirmation') {
    const incident = IncidentSummarySchema.safeParse(value.incident);
    const request = WorkCenterConnectedCreateRequestSchema.safeParse(value.request);
    if (
      !hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'request']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      !isOptionalString(value.displayName) ||
      !incident.success ||
      !request.success
    ) {
      return null;
    }

    return {
      step: 'awaitingConfirmation',
      incident: incident.data,
      externalUserId: value.externalUserId,
      ...(value.displayName ? { displayName: value.displayName } : {}),
      request: request.data,
    };
  }

  if (value.step === 'reported') {
    const response = WorkCenterCreateResponseSchema.safeParse(value.response);
    if (!hasOnlyKeys(value, ['step', 'response']) || !response.success) {
      return null;
    }

    return { step: 'reported', response: response.data };
  }

  return null;
}


function parseTelegramResourceReportStateValue(value: unknown): TelegramResourceReportState | null {
  if (!isRecord(value) || typeof value.step !== 'string') return null;
  if (value.step === 'idle') return hasOnlyKeys(value, ['step']) ? { step: 'idle' } : null;
  if (value.step === 'cancelled') return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;

  const incident = 'incident' in value ? IncidentSummarySchema.safeParse(value.incident) : null;
  const base = parseConversationBase(value);

  if (value.step === 'awaitingIncident') {
    if (!hasOnlyKeys(value, ['step', 'incidents', 'externalUserId', 'displayName']) || !base || !Array.isArray(value.incidents)) return null;
    const incidents = parseIncidentArray(value.incidents);
    return incidents ? { step: 'awaitingIncident', incidents, ...base } : null;
  }

  if (value.step === 'awaitingKind') {
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName']) || !base || !incident?.success) return null;
    return { step: 'awaitingKind', incident: incident.data, ...base };
  }

  if (value.step === 'awaitingCategory') {
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'reportKind']) || !base || !incident?.success) return null;
    const reportKind = parseReportKind(value.reportKind);
    return reportKind ? { step: 'awaitingCategory', incident: incident.data, ...base, reportKind } : null;
  }

  if (value.step === 'awaitingQuantity') {
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'reportKind', 'category']) || !base || !incident?.success || !isNonEmptyString(value.category)) return null;
    const reportKind = parseReportKind(value.reportKind);
    return reportKind ? { step: 'awaitingQuantity', incident: incident.data, ...base, reportKind, category: value.category } : null;
  }

  if (value.step === 'awaitingUrgency') {
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'reportKind', 'category', 'quantityApprox']) || !base || !incident?.success || !isNonEmptyString(value.category) || !isNonEmptyString(value.quantityApprox)) return null;
    const reportKind = parseReportKind(value.reportKind);
    return reportKind ? { step: 'awaitingUrgency', incident: incident.data, ...base, reportKind, category: value.category, quantityApprox: value.quantityApprox } : null;
  }

  if (value.step === 'awaitingConstraints') {
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'reportKind', 'category', 'quantityApprox', 'urgency']) || !base || !incident?.success || !isNonEmptyString(value.category) || !isNonEmptyString(value.quantityApprox)) return null;
    const reportKind = parseReportKind(value.reportKind);
    const urgency = parseUrgency(value.urgency);
    return reportKind && urgency ? { step: 'awaitingConstraints', incident: incident.data, ...base, reportKind, category: value.category, quantityApprox: value.quantityApprox, urgency } : null;
  }

  if (value.step === 'awaitingWorkCenter' || value.step === 'awaitingConfirmation') {
    const request = ResourceReportConnectedCreateRequestSchema.safeParse(value.request);
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'request']) || !base || !incident?.success || !request.success) return null;
    return { step: value.step, incident: incident.data, ...base, request: request.data };
  }

  if (value.step === 'reported') {
    const response = ResourceReportCreateResponseSchema.safeParse(value.response);
    return hasOnlyKeys(value, ['step', 'response']) && response.success ? { step: 'reported', response: response.data } : null;
  }

  return null;
}

function parseTelegramDispatchTaskStateValue(value: unknown): TelegramDispatchTaskState | null {
  if (!isRecord(value) || typeof value.step !== 'string') return null;
  if (value.step === 'idle') return hasOnlyKeys(value, ['step']) ? { step: 'idle' } : null;
  if (value.step === 'cancelled') return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;

  if (value.step === 'awaitingIncident') {
    if (!hasOnlyKeys(value, ['step', 'incidents', 'externalUserId']) || !isNonEmptyString(value.externalUserId) || !Array.isArray(value.incidents)) return null;
    const incidents = parseIncidentArray(value.incidents);
    return incidents ? { step: 'awaitingIncident', incidents, externalUserId: value.externalUserId } : null;
  }

  const incident = 'incident' in value ? IncidentSummarySchema.safeParse(value.incident) : null;
  if (value.step === 'awaitingTask') {
    const tasks = DispatchTaskListResponseSchema.safeParse({ dispatchTasks: value.tasks });
    if (!hasOnlyKeys(value, ['step', 'incident', 'tasks', 'externalUserId']) || !isNonEmptyString(value.externalUserId) || !incident?.success || !tasks.success) return null;
    return { step: 'awaitingTask', incident: incident.data, tasks: tasks.data.dispatchTasks, externalUserId: value.externalUserId };
  }

  if (value.step === 'awaitingStatus') {
    const task = DispatchTaskResponseSchema.safeParse({ dispatchTask: value.task });
    if (!hasOnlyKeys(value, ['step', 'incident', 'task', 'externalUserId']) || !isNonEmptyString(value.externalUserId) || !incident?.success || !task.success) return null;
    return { step: 'awaitingStatus', incident: incident.data, task: task.data.dispatchTask, externalUserId: value.externalUserId };
  }

  if (value.step === 'awaitingConfirmation') {
    const task = DispatchTaskResponseSchema.safeParse({ dispatchTask: value.task });
    const request = DispatchTaskConnectedUpdateRequestSchema.safeParse(value.request);
    if (!hasOnlyKeys(value, ['step', 'incident', 'task', 'externalUserId', 'request']) || !isNonEmptyString(value.externalUserId) || !incident?.success || !task.success || !request.success) return null;
    return { step: 'awaitingConfirmation', incident: incident.data, task: task.data.dispatchTask, externalUserId: value.externalUserId, request: request.data };
  }

  if (value.step === 'updated') {
    const response = DispatchTaskResponseSchema.safeParse(value.response);
    return hasOnlyKeys(value, ['step', 'response']) && response.success ? { step: 'updated', response: response.data } : null;
  }

  return null;
}

function parseTelegramSosStateValue(value: unknown): TelegramSosState | null {
  if (!isRecord(value) || typeof value.step !== 'string') return null;
  if (value.step === 'idle') return hasOnlyKeys(value, ['step']) ? { step: 'idle' } : null;
  if (value.step === 'cancelled') return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;

  const base = parseConversationBase(value);

  if (value.step === 'awaitingIncident') {
    if (!hasOnlyKeys(value, ['step', 'incidents', 'externalUserId', 'displayName']) || !base || !Array.isArray(value.incidents)) return null;
    const incidents = parseIncidentArray(value.incidents);
    return incidents ? { step: 'awaitingIncident', incidents, ...base } : null;
  }

  if (value.step === 'awaitingConfirmation') {
    const incident = IncidentSummarySchema.safeParse(value.incident);
    const request = SosConnectedCreateRequestSchema.safeParse(value.request);
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'request']) || !base || !incident.success || !request.success) return null;
    return { step: 'awaitingConfirmation', incident: incident.data, ...base, request: request.data };
  }

  if (value.step === 'submitted') {
    const response = SosAlertCreateResponseSchema.safeParse(value.response);
    return hasOnlyKeys(value, ['step', 'response']) && response.success ? { step: 'submitted', response: response.data } : null;
  }

  return null;
}

function parseTelegramFamilyReunificationStateValue(value: unknown): TelegramFamilyReunificationState | null {
  if (!isRecord(value) || typeof value.step !== 'string') return null;
  if (value.step === 'idle') return hasOnlyKeys(value, ['step']) ? { step: 'idle' } : null;
  if (value.step === 'cancelled') return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;

  const base = parseConversationBase(value);

  if (value.step === 'awaitingIncident') {
    if (!hasOnlyKeys(value, ['step', 'incidents', 'externalUserId', 'displayName']) || !base || !Array.isArray(value.incidents)) return null;
    const incidents = parseIncidentArray(value.incidents);
    return incidents ? { step: 'awaitingIncident', incidents, ...base } : null;
  }

  if (value.step === 'linked') {
    const response = PrivateWebLinkIssueResponseSchema.safeParse(value.response);
    return hasOnlyKeys(value, ['step', 'response']) && response.success ? { step: 'linked', response: response.data } : null;
  }

  return null;
}

function parseIncidentArray(values: unknown[]): IncidentSummary[] | null {
  const incidents: IncidentSummary[] = [];
  for (const incidentValue of values) {
    const incident = IncidentSummarySchema.safeParse(incidentValue);
    if (!incident.success) return null;
    incidents.push(incident.data);
  }
  return incidents;
}

function parseConversationBase(value: Record<string, unknown>): { externalUserId: string; displayName?: string } | null {
  if (!isNonEmptyString(value.externalUserId) || !isOptionalString(value.displayName)) return null;
  return { externalUserId: value.externalUserId, ...(value.displayName ? { displayName: value.displayName } : {}) };
}

function parseReportKind(value: unknown): ResourceReportKind | null {
  return value === 'needed' || value === 'surplus' ? value : null;
}

function parseUrgency(value: unknown): ResourceReportUrgency | null {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : null;
}

function parseDispatchStatus(value: unknown): DispatchTaskStatus | null {
  if (value === 'pending' || value === 'accepted' || value === 'en_route' || value === 'delivered' || value === 'cancelled') return value;
  return null;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length > 0);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const allowedKeys = new Set(keys);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

export type TelegramIncidentJoinFlowResult = {
  state: TelegramIncidentJoinState;
  responseText: string;
};

export type TelegramWorkCenterReportFlowResult = {
  state: TelegramWorkCenterReportState;
  responseText: string;
};

export type TelegramResourceReportFlowResult = {
  state: TelegramResourceReportState;
  responseText: string;
};

export type TelegramDispatchTaskFlowResult = {
  state: TelegramDispatchTaskState;
  responseText: string;
};

export type TelegramSosFlowResult = {
  state: TelegramSosState;
  responseText: string;
};

export type TelegramFamilyReunificationFlowResult = {
  state: TelegramFamilyReunificationState;
  responseText: string;
};

export function resolveTelegramCommand(update: TelegramUpdateLike): string | null {
  const text = update.message?.text?.trim();
  if (!text?.startsWith('/')) {
    return null;
  }

  return text.split(/\s+/)[0].toLowerCase();
}

export function handleTelegramWebhookUpdate(update: TelegramUpdateLike): TelegramWebhookResult {
  const command = resolveTelegramCommand(update);

  if (command === '/start') {
    return {
      accepted: true,
      command,
      responseText: 'Zona Cero is ready. Choose an incident to continue.',
    };
  }

  if (command === '/sos') {
    return {
      accepted: true,
      command,
      responseText: 'SOS requires incident selection and an exact CONFIRM SOS reply. Backend recording does not confirm delivery or rescue.',
    };
  }

  if (isFamilyReunificationCommand(command)) {
    return {
      accepted: true,
      command,
      responseText: 'Family reunification uses a private web link and in-person verification. Do not send photos, exact locations, or full minor identities in Telegram.',
    };
  }

  return {
    accepted: true,
    command,
    responseText: 'Zona Cero received the update. A guided flow will handle it in the matching slice.',
  };
}

export async function handleTelegramIncidentJoinFlow(
  state: TelegramIncidentJoinState,
  update: TelegramUpdateLike,
  ports: TelegramIncidentJoinPorts,
): Promise<TelegramIncidentJoinFlowResult> {
  const text = update.message?.text?.trim() ?? '';
  const command = resolveTelegramCommand(update);

  if (command === '/cancel') {
    return { state: { step: 'cancelled' }, responseText: 'Join cancelled. Send /start to begin again.' };
  }

  if (command === '/start' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'joined') {
    return startIncidentSelection(update, ports);
  }

  if (state.step === 'awaitingIncident') {
    const incident = selectIncident(state.incidents, text);
    if (!incident) {
      return {
        state,
        responseText: `Incident not found. Reply with a number or incident id from the list.\n${formatIncidentList(state.incidents)}`,
      };
    }

    return {
      state: { step: 'awaitingPseudonym', incident, externalUserId: state.externalUserId },
      responseText: `Selected: ${incident.name}. What pseudonym should we show to coordinators?`,
    };
  }

  if (state.step === 'awaitingPseudonym') {
    if (!text || text.startsWith('/')) {
      return { state, responseText: 'Please send a visible pseudonym, or /cancel to stop.' };
    }

    try {
      const config = await ports.getIncidentConfig(state.incident.incidentId);
      if (config.incident.incidentId !== state.incident.incidentId) {
        return { state, responseText: 'Incident configuration does not match the selected incident. Please try /start again.' };
      }

      return {
        state: { step: 'awaitingRole', config, externalUserId: state.externalUserId, pseudonym: text },
        responseText: `Choose your role:\n${formatRoles(config.roles)}`,
      };
    } catch {
      return { state, responseText: 'Could not load incident roles from the backend. Please try again later.' };
    }
  }

  if (state.step === 'awaitingRole') {
    const role = selectRole(state.config.roles, text);
    if (!role) {
      return { state, responseText: `Invalid role. Choose one of:\n${formatRoles(state.config.roles)}` };
    }

    const request = IncidentJoinRequestSchema.parse({
      channel: 'telegram',
      externalId: state.externalUserId,
      displayName: state.pseudonym,
      role,
    });

    try {
      const response = await ports.joinIncident(state.config.incident.incidentId, request);
      return { state: { step: 'joined', response }, responseText: formatJoinSuccess(response) };
    } catch {
      return { state, responseText: 'Could not join the incident. The backend rejected or failed the join request.' };
    }
  }

  return { state, responseText: 'Send /start to begin the incident join flow.' };
}

export async function handleTelegramWorkCenterReportFlow(
  state: TelegramWorkCenterReportState,
  update: TelegramUpdateLike,
  ports: TelegramWorkCenterReportPorts,
): Promise<TelegramWorkCenterReportFlowResult> {
  const text = update.message?.text?.trim() ?? '';
  const command = resolveTelegramCommand(update);

  if (command === '/cancel') {
    return { state: { step: 'cancelled' }, responseText: 'Work center report cancelled. Send /workcenter to begin again.' };
  }

  if (command === '/workcenter' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'reported') {
    return startWorkCenterIncidentSelection(update, ports);
  }

  if (state.step === 'awaitingIncident') {
    const incident = selectIncident(state.incidents, text);
    if (!incident) {
      return {
        state,
        responseText: `Incident not found. Reply with a number or incident id from the list.\n${formatIncidentList(state.incidents)}`,
      };
    }

    return {
      state: {
        step: 'awaitingName',
        incident,
        externalUserId: state.externalUserId,
        displayName: state.displayName,
      },
      responseText: 'Send the work center name. Use /cancel to stop.',
    };
  }

  if (state.step === 'awaitingName') {
    if (!text || text.startsWith('/')) {
      return { state, responseText: 'Work center name is required. Send a visible name, or /cancel to stop.' };
    }

    const parsed = WorkCenterConnectedCreateRequestSchema.safeParse({
      channel: 'telegram',
      externalId: state.externalUserId,
      displayName: state.displayName,
      payload: { name: text },
    });

    if (!parsed.success) {
      return { state, responseText: 'Invalid work center report. Send a non-empty work center name, or /cancel to stop.' };
    }

    return {
      state: {
        step: 'awaitingConfirmation',
        incident: state.incident,
        externalUserId: state.externalUserId,
        displayName: state.displayName,
        request: parsed.data,
      },
      responseText: `Confirm work center report:\nIncident: ${state.incident.name}\nName: ${parsed.data.payload.name}\nReply yes to submit, or /cancel to stop.`,
    };
  }

  if (state.step === 'awaitingConfirmation') {
    if (isCancellation(text)) {
      return { state: { step: 'cancelled' }, responseText: 'Work center report cancelled. Send /workcenter to begin again.' };
    }

    if (!isConfirmation(text)) {
      return { state, responseText: 'Reply yes to submit the work center report, no to cancel, or /cancel to stop.' };
    }

    try {
      const response = await ports.createWorkCenter(state.incident.incidentId, state.request);
      return { state: { step: 'reported', response }, responseText: formatWorkCenterReportSuccess(response) };
    } catch (error) {
      return { state, responseText: formatWorkCenterReportError(error) };
    }
  }

  return { state, responseText: 'Send /workcenter to begin the work center report flow.' };
}


export async function handleTelegramResourceReportFlow(
  state: TelegramResourceReportState,
  update: TelegramUpdateLike,
  ports: TelegramResourceReportPorts,
): Promise<TelegramResourceReportFlowResult> {
  const text = update.message?.text?.trim() ?? '';
  const command = resolveTelegramCommand(update);

  if (command === '/cancel') return { state: { step: 'cancelled' }, responseText: 'Resource report cancelled. Send /resource to begin again.' };
  if (command === '/resource' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'reported') {
    return startResourceIncidentSelection(update, ports);
  }

  if (state.step === 'awaitingIncident') {
    const incident = selectIncident(state.incidents, text);
    if (!incident) return { state, responseText: `Incident not found. Reply with a number or incident id from the list.
${formatIncidentList(state.incidents)}` };
    return { state: { step: 'awaitingKind', incident, externalUserId: state.externalUserId, displayName: state.displayName }, responseText: 'Is this resource needed or surplus? Reply needed or surplus.' };
  }

  if (state.step === 'awaitingKind') {
    const reportKind = parseReportKind(text.toLowerCase());
    if (!reportKind) return { state, responseText: 'Reply needed or surplus. Use /cancel to stop.' };
    return { state: { step: 'awaitingCategory', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, reportKind }, responseText: 'Send the resource category exactly as operations uses it.' };
  }

  if (state.step === 'awaitingCategory') {
    if (!text || text.startsWith('/')) return { state, responseText: 'Resource category is required. Send a category, or /cancel to stop.' };
    return { state: { step: 'awaitingQuantity', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, reportKind: state.reportKind, category: text }, responseText: 'Send the approximate quantity.' };
  }

  if (state.step === 'awaitingQuantity') {
    if (!text || text.startsWith('/')) return { state, responseText: 'Approximate quantity is required. Send a value like "20 blankets", or /cancel to stop.' };
    return { state: { ...state, step: 'awaitingUrgency', quantityApprox: text }, responseText: 'Send urgency: low, medium, high, or critical.' };
  }

  if (state.step === 'awaitingUrgency') {
    const urgency = parseUrgency(text.toLowerCase());
    if (!urgency) return { state, responseText: 'Invalid urgency. Reply low, medium, high, or critical.' };
    return { state: { ...state, step: 'awaitingConstraints', urgency }, responseText: 'Send optional restrictions separated by commas, or reply skip.' };
  }

  if (state.step === 'awaitingConstraints') {
    const constraints = parseOptionalList(text);
    const request = ResourceReportConnectedCreateRequestSchema.parse({
      channel: 'telegram',
      externalId: state.externalUserId,
      displayName: state.displayName,
      payload: {
        category: state.category,
        quantityApprox: state.quantityApprox,
        urgency: state.urgency,
        constraints,
        reportKind: state.reportKind,
      },
    });
    return { state: { step: 'awaitingWorkCenter', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, request }, responseText: 'Send a work center id for this report, or reply skip.' };
  }

  if (state.step === 'awaitingWorkCenter') {
    const request = text && !isSkip(text) && !text.startsWith('/')
      ? ResourceReportConnectedCreateRequestSchema.parse({ ...state.request, payload: { ...state.request.payload, workCenterId: text } })
      : state.request;
    return { state: { step: 'awaitingConfirmation', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, request }, responseText: formatResourceReportConfirmation(state.incident, request) };
  }

  if (state.step === 'awaitingConfirmation') {
    if (isCancellation(text)) return { state: { step: 'cancelled' }, responseText: 'Resource report cancelled. Send /resource to begin again.' };
    if (!isConfirmation(text)) return { state, responseText: 'Reply yes to submit the resource report, no to cancel, or /cancel to stop.' };
    try {
      const response = await ports.createResourceReport(state.incident.incidentId, state.request);
      return { state: { step: 'reported', response }, responseText: formatResourceReportSuccess(response) };
    } catch (error) {
      return { state, responseText: formatResourceReportError(error) };
    }
  }

  return { state, responseText: 'Send /resource to begin the resource report flow.' };
}

export async function handleTelegramDispatchTaskFlow(
  state: TelegramDispatchTaskState,
  update: TelegramUpdateLike,
  ports: TelegramDispatchTaskPorts,
): Promise<TelegramDispatchTaskFlowResult> {
  const text = update.message?.text?.trim() ?? '';
  const command = resolveTelegramCommand(update);

  if (command === '/cancel') return { state: { step: 'cancelled' }, responseText: 'Dispatch task update cancelled. Send /dispatch to begin again.' };
  if (command === '/dispatch' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'updated') return startDispatchIncidentSelection(update, ports);

  if (state.step === 'awaitingIncident') {
    const incident = selectIncident(state.incidents, text);
    if (!incident) return { state, responseText: `Incident not found. Reply with a number or incident id from the list.
${formatIncidentList(state.incidents)}` };
    try {
      const { dispatchTasks } = await ports.listDispatchTasks(incident.incidentId);
      if (dispatchTasks.length === 0) return { state: { step: 'idle' }, responseText: 'No dispatch tasks are available for this incident.' };
      return { state: { step: 'awaitingTask', incident, tasks: dispatchTasks, externalUserId: state.externalUserId }, responseText: `Choose a dispatch task:
${formatDispatchTaskList(dispatchTasks)}` };
    } catch {
      return { state, responseText: 'Could not load dispatch tasks from the backend. Please try again later.' };
    }
  }

  if (state.step === 'awaitingTask') {
    const task = selectDispatchTask(state.tasks, text);
    if (!task) return { state, responseText: `Dispatch task not found. Reply with a number or task id.
${formatDispatchTaskList(state.tasks)}` };
    return { state: { step: 'awaitingStatus', incident: state.incident, task, externalUserId: state.externalUserId }, responseText: 'Reply with the new status: accepted, en_route, delivered, or cancelled.' };
  }

  if (state.step === 'awaitingStatus') {
    const status = parseDispatchStatus(normalizeDispatchStatusText(text));
    if (!status || status === 'pending') return { state, responseText: 'Invalid status. Reply accepted, en_route, delivered, or cancelled.' };
    const request = DispatchTaskConnectedUpdateRequestSchema.parse({ channel: 'telegram', externalId: state.externalUserId, status });
    return { state: { step: 'awaitingConfirmation', incident: state.incident, task: state.task, externalUserId: state.externalUserId, request }, responseText: `Confirm dispatch task update:
Task: ${state.task.dispatchTaskId}
Status: ${status}
Reply yes to submit, or /cancel to stop.` };
  }

  if (state.step === 'awaitingConfirmation') {
    if (isCancellation(text)) return { state: { step: 'cancelled' }, responseText: 'Dispatch task update cancelled. Send /dispatch to begin again.' };
    if (!isConfirmation(text)) return { state, responseText: 'Reply yes to update the dispatch task, no to cancel, or /cancel to stop.' };
    try {
      const response = await ports.updateDispatchTask(state.incident.incidentId, state.task.dispatchTaskId, state.request);
      return { state: { step: 'updated', response }, responseText: formatDispatchTaskSuccess(response) };
    } catch (error) {
      return { state, responseText: formatDispatchTaskError(error) };
    }
  }

  return { state, responseText: 'Send /dispatch to begin the dispatch task flow.' };
}

export async function handleTelegramSosFlow(
  state: TelegramSosState,
  update: TelegramUpdateLike,
  ports: TelegramSosPorts,
): Promise<TelegramSosFlowResult> {
  const text = update.message?.text?.trim() ?? '';
  const command = resolveTelegramCommand(update);

  if (command === '/cancel') {
    return { state: { step: 'cancelled' }, responseText: 'SOS cancelled before backend submission. Send /sos to begin again.' };
  }

  if (command === '/sos' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'submitted') {
    return startSosIncidentSelection(update, ports);
  }

  if (state.step === 'awaitingIncident') {
    const incident = selectIncident(state.incidents, text);
    if (!incident) {
      return {
        state,
        responseText: `Incident not found. Reply with a number or incident id from the list.\n${formatIncidentList(state.incidents)}`,
      };
    }

    const request = SosConnectedCreateRequestSchema.parse({
      channel: 'telegram',
      externalId: state.externalUserId,
      displayName: state.displayName,
      payload: { severity: 'critical', reportedAt: new Date().toISOString() },
    });

    return {
      state: {
        step: 'awaitingConfirmation',
        incident,
        externalUserId: state.externalUserId,
        displayName: state.displayName,
        request,
      },
      responseText: formatSosConfirmation(incident),
    };
  }

  if (state.step === 'awaitingConfirmation') {
    if (isCancellation(text)) {
      return { state: { step: 'cancelled' }, responseText: 'SOS cancelled before backend submission. Send /sos to begin again.' };
    }

    if (!isStrongSosConfirmation(text)) {
      return {
        state,
        responseText: 'For safety, reply exactly CONFIRM SOS to submit, no to cancel, or /cancel to stop. This does not confirm delivery or rescue.',
      };
    }

    try {
      const response = await ports.createSosAlert(state.incident.incidentId, state.request);
      return { state: { step: 'submitted', response }, responseText: formatSosSuccess(response) };
    } catch (error) {
      return { state, responseText: formatSosError(error) };
    }
  }

  return { state, responseText: 'Send /sos to begin the SOS flow.' };
}

export async function handleTelegramFamilyReunificationFlow(
  state: TelegramFamilyReunificationState,
  update: TelegramUpdateLike,
  ports: TelegramFamilyReunificationPorts,
): Promise<TelegramFamilyReunificationFlowResult> {
  const text = update.message?.text?.trim() ?? '';
  const command = resolveTelegramCommand(update);

  if (command === '/cancel') {
    return { state: { step: 'cancelled' }, responseText: 'Family reunification link cancelled. Go to the in-person desk if you need help now.' };
  }

  if (isFamilyReunificationCommand(command) || state.step === 'idle' || state.step === 'cancelled' || state.step === 'linked') {
    return startFamilyReunificationIncidentSelection(update, ports);
  }

  if (state.step === 'awaitingIncident') {
    const incident = selectIncident(state.incidents, text);
    if (!incident) {
      return {
        state,
        responseText: `Incident not found. Reply with a number or incident id from the list.\n${formatIncidentList(state.incidents)}`,
      };
    }

    const request = createFamilyReunificationPrivateLinkRequest();

    try {
      const response = await ports.createPrivateLink(incident.incidentId, request);
      const url = ports.formatPrivateLinkUrl?.(response) ?? formatFamilyReunificationPrivateUrl(response);
      return {
        state: { step: 'linked', response },
        responseText: formatFamilyReunificationLinkSuccess(url),
      };
    } catch {
      return { state, responseText: formatFamilyReunificationLinkError() };
    }
  }

  return { state, responseText: 'Send /familia or /reunificacion to get a private family reunification link.' };
}

async function startIncidentSelection(update: TelegramUpdateLike, ports: TelegramIncidentJoinPorts): Promise<TelegramIncidentJoinFlowResult> {
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) {
    return { state: { step: 'idle' }, responseText: 'Telegram user id is required to join an incident.' };
  }

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) {
      return { state: { step: 'idle' }, responseText: 'No active incidents are available right now.' };
    }

    return {
      state: { step: 'awaitingIncident', incidents, externalUserId },
      responseText: `Choose an incident:\n${formatIncidentList(incidents)}`,
    };
  } catch {
    return { state: { step: 'idle' }, responseText: 'Could not load incidents from the backend. Please try again later.' };
  }
}

async function startFamilyReunificationIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramFamilyReunificationPorts,
): Promise<TelegramFamilyReunificationFlowResult> {
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) return { state: { step: 'idle' }, responseText: 'Telegram user id is required to request a private family reunification link.' };

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) return { state: { step: 'idle' }, responseText: 'No active incidents are available right now. Go to the family reunification desk for help.' };
    return {
      state: { step: 'awaitingIncident', incidents, externalUserId, displayName: getTelegramDisplayName(update) },
      responseText: [
        'Family reunification is handled in private web and completed with in-person verification.',
        'Do not send photos, exact locations, or full minor identities in Telegram.',
        `Choose an incident:\n${formatIncidentList(incidents)}`,
      ].join('\n'),
    };
  } catch {
    return { state: { step: 'idle' }, responseText: formatFamilyReunificationLinkError() };
  }
}

async function startWorkCenterIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramWorkCenterReportPorts,
): Promise<TelegramWorkCenterReportFlowResult> {
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) {
    return { state: { step: 'idle' }, responseText: 'Telegram user id is required to report a work center.' };
  }

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) {
      return { state: { step: 'idle' }, responseText: 'No active incidents are available right now.' };
    }

    return {
      state: {
        step: 'awaitingIncident',
        incidents,
        externalUserId,
        displayName: getTelegramDisplayName(update),
      },
      responseText: `Choose an incident before reporting a work center:\n${formatIncidentList(incidents)}`,
    };
  } catch {
    return { state: { step: 'idle' }, responseText: 'Could not load incidents from the backend. Please try again later.' };
  }
}


async function startResourceIncidentSelection(update: TelegramUpdateLike, ports: TelegramResourceReportPorts): Promise<TelegramResourceReportFlowResult> {
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) return { state: { step: 'idle' }, responseText: 'Telegram user id is required to report resources.' };

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) return { state: { step: 'idle' }, responseText: 'No active incidents are available right now.' };
    return { state: { step: 'awaitingIncident', incidents, externalUserId, displayName: getTelegramDisplayName(update) }, responseText: `Choose an incident before reporting resources:
${formatIncidentList(incidents)}` };
  } catch {
    return { state: { step: 'idle' }, responseText: 'Could not load incidents from the backend. Please try again later.' };
  }
}

async function startDispatchIncidentSelection(update: TelegramUpdateLike, ports: TelegramDispatchTaskPorts): Promise<TelegramDispatchTaskFlowResult> {
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) return { state: { step: 'idle' }, responseText: 'Telegram user id is required to update dispatch tasks.' };

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) return { state: { step: 'idle' }, responseText: 'No active incidents are available right now.' };
    return { state: { step: 'awaitingIncident', incidents, externalUserId }, responseText: `Choose an incident before updating dispatch tasks:
${formatIncidentList(incidents)}` };
  } catch {
    return { state: { step: 'idle' }, responseText: 'Could not load incidents from the backend. Please try again later.' };
  }
}

async function startSosIncidentSelection(update: TelegramUpdateLike, ports: TelegramSosPorts): Promise<TelegramSosFlowResult> {
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) return { state: { step: 'idle' }, responseText: 'Telegram user id is required to submit SOS.' };

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) return { state: { step: 'idle' }, responseText: 'No active incidents are available right now.' };
    return {
      state: { step: 'awaitingIncident', incidents, externalUserId, displayName: getTelegramDisplayName(update) },
      responseText: `Choose an incident before starting SOS:\n${formatIncidentList(incidents)}`,
    };
  } catch {
    return { state: { step: 'idle' }, responseText: 'Could not load incidents from the backend. Please try again later.' };
  }
}

function getTelegramExternalUserId(update: TelegramUpdateLike): string | null {
  const id = update.message?.from?.id;
  return id == null ? null : String(id);
}

function getTelegramDisplayName(update: TelegramUpdateLike): string | undefined {
  const firstName = update.message?.from?.first_name?.trim();
  return firstName || undefined;
}

function selectIncident(incidents: IncidentSummary[], text: string): IncidentSummary | null {
  const index = Number.parseInt(text, 10);
  if (Number.isInteger(index) && String(index) === text && index >= 1 && index <= incidents.length) {
    return incidents[index - 1] ?? null;
  }

  return incidents.find((incident) => incident.incidentId === text) ?? null;
}

function selectRole(roles: IncidentRole[], text: string): IncidentRole | null {
  const index = Number.parseInt(text, 10);
  const candidate = Number.isInteger(index) && String(index) === text ? roles[index - 1] : text;
  const parsed = IncidentRoleSchema.safeParse(candidate);

  if (!parsed.success || !roles.includes(parsed.data)) {
    return null;
  }

  return parsed.data;
}

function formatIncidentList(incidents: IncidentSummary[]): string {
  return incidents.map((incident, index) => `${index + 1}. ${incident.name} — ${incident.locationName} (${incident.incidentId})`).join('\n');
}

function formatRoles(roles: IncidentRole[]): string {
  return roles.map((role, index) => `${index + 1}. ${role}`).join('\n');
}

function formatJoinSuccess(response: IncidentJoinResponse): string {
  return [
    `Joined ${response.incident.name} as ${response.membership.role}.`,
    `Permissions: ${formatPermissions(response.membership.permissions)}`,
    `Audit: ${response.audit.auditEventId}`,
  ].join('\n');
}

function isConfirmation(text: string): boolean {
  return ['yes', 'y', 'confirm', 'ok'].includes(text.trim().toLowerCase());
}

function isCancellation(text: string): boolean {
  return ['no', 'n', 'cancel'].includes(text.trim().toLowerCase());
}

function isStrongSosConfirmation(text: string): boolean {
  return text.trim() === 'CONFIRM SOS';
}

function isFamilyReunificationCommand(command: string | null): boolean {
  return command === '/familia' || command === '/reunificacion';
}

function createFamilyReunificationPrivateLinkRequest(): PrivateWebLinkIssueRequest {
  return PrivateWebLinkIssueRequestSchema.parse({
    scope: 'family_reunification.search',
    channel: 'web-ui',
    externalId: 'web-user-1001',
    displayName: 'Field Web',
    correlationId: 'corr-family-reunification-search-1',
    returnState: 'web:family-reunification:search',
    ttlSeconds: 600,
    maxUses: 1,
    metadata: {},
  });
}

function formatFamilyReunificationPrivateUrl(response: PrivateWebLinkIssueResponse): string {
  const params = new URLSearchParams({
    token: response.token,
    correlationId: response.correlationId,
  });
  return `/family-reunification?${params.toString()}`;
}

function formatFamilyReunificationLinkSuccess(url: string): string {
  return [
    'Open this private web link for minimized family reunification search:',
    url,
    'Limits: no photos, no exact location, and no full identity of minors in chat or the form.',
    'All results require in-person verification at the family reunification desk.',
  ].join('\n');
}

function formatFamilyReunificationLinkError(): string {
  return 'Could not create a private family reunification link. Go to the family reunification desk for in-person help. Do not send photos, exact locations, or full minor identities in Telegram.';
}


function parseOptionalList(text: string): string[] {
  if (isSkip(text)) return [];
  return text.split(',').map((item) => item.trim()).filter(Boolean);
}

function isSkip(text: string): boolean {
  return ['skip', 'none', 'no', 'n/a'].includes(text.trim().toLowerCase());
}

function normalizeDispatchStatusText(text: string): string {
  const normalized = text.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
  if (['accept', 'accepted', 'aceptar', 'aceptada', 'aceptado'].includes(normalized)) return 'accepted';
  if (['en_camino', 'en_route', 'route'].includes(normalized)) return 'en_route';
  if (['delivered', 'entregada', 'entregado'].includes(normalized)) return 'delivered';
  if (['cancel', 'cancelled', 'canceled', 'cancelada', 'cancelado'].includes(normalized)) return 'cancelled';
  return normalized;
}

function selectDispatchTask(tasks: DispatchTask[], text: string): DispatchTask | null {
  const index = Number.parseInt(text, 10);
  if (Number.isInteger(index) && String(index) === text && index >= 1 && index <= tasks.length) return tasks[index - 1] ?? null;
  return tasks.find((task) => task.dispatchTaskId === text) ?? null;
}

function formatDispatchTaskList(tasks: DispatchTask[]): string {
  return tasks.map((task, index) => `${index + 1}. ${task.category} · ${task.quantityApprox} · ${task.status} (${task.dispatchTaskId})`).join('\n');
}

function formatResourceReportConfirmation(incident: IncidentSummary, request: ResourceReportConnectedCreateRequest): string {
  const payload = request.payload;
  return [
    'Confirm resource report:',
    `Incident: ${incident.name}`,
    `Kind: ${payload.reportKind}`,
    `Category: ${payload.category}`,
    `Quantity: ${payload.quantityApprox}`,
    `Urgency: ${payload.urgency}`,
    `Restrictions: ${payload.constraints.length ? payload.constraints.join(', ') : 'none'}`,
    `Work center: ${payload.workCenterId ?? 'not linked'}`,
    'Reply yes to submit, or /cancel to stop.',
  ].join('\n');
}

function formatResourceReportSuccess(response: ResourceReportCreateResponse): string {
  return [
    `Resource ${response.resourceReport.reportKind} reported: ${response.resourceReport.category} (${response.resourceReport.quantityApprox}).`,
    `Urgency: ${response.resourceReport.urgency}`,
    `Audit: ${response.audit.auditEventId}`,
  ].join('\n');
}

function formatResourceReportError(error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'permission_denied') return 'Permission denied. Join this incident first with /start, then report the resource again.';
  if (code === 'invalid_payload') return 'Invalid resource report. Send /resource and try again with category, quantity, urgency and kind.';
  return 'Could not report the resource. The backend rejected or failed the request.';
}

function formatDispatchTaskSuccess(response: DispatchTaskResponse): string {
  return [`Dispatch task updated: ${response.dispatchTask.dispatchTaskId}.`, `Status: ${response.dispatchTask.status}`].join('\n');
}

function formatSosConfirmation(incident: IncidentSummary): string {
  return [
    'Critical SOS request.',
    `Incident: ${incident.name}`,
    'Reply exactly CONFIRM SOS to record this SOS in the backend and queue fan-out.',
    'This does not confirm delivery, rescue, or exact location. Use /cancel to stop.',
  ].join('\n');
}

function formatSosSuccess(response: SosAlertCreateResponse): string {
  return [
    `SOS ID: ${response.sosAlert.sosAlertId}`,
    `Status: ${response.sosAlert.status}`,
    `Fan-out: total ${response.fanout.total}, queued ${response.fanout.queued}, pending ${response.fanout.pending}, failed ${response.fanout.failed}, cancelled ${response.fanout.cancelled}`,
    'Backend recording confirmed only. This does not confirm delivery, rescue, or exact location.',
  ].join('\n');
}

function formatSosError(error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'permission_denied') return 'Permission denied. Join this incident first with /start, then start SOS again.';
  if (code === 'not_found') return 'Incident not found. Send /sos and choose an available incident.';
  if (code === 'invalid_payload') return 'Invalid SOS payload. Send /sos and try again.';
  return 'Could not record SOS. The backend rejected or failed the request.';
}

function formatDispatchTaskError(error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'permission_denied') return 'Permission denied. The backend rejected this dispatch task update.';
  if (code === 'not_found') return 'Dispatch task not found. Send /dispatch and choose an available task.';
  if (code === 'invalid_payload') return 'Invalid dispatch task update. Use a canonical status: accepted, en_route, delivered, or cancelled.';
  return 'Could not update the dispatch task. The backend rejected or failed the request.';
}

function formatWorkCenterReportSuccess(response: WorkCenterCreateResponse): string {
  return [`Work center reported: ${response.workCenter.name}.`, `Audit: ${response.audit.auditEventId}`].join('\n');
}

function formatWorkCenterReportError(error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'permission_denied') {
    return 'Permission denied. Join this incident first with /start, then report the work center again.';
  }

  if (code === 'invalid_payload') {
    return 'Invalid work center report. Send /workcenter and try again with a non-empty name.';
  }

  return 'Could not report the work center. The backend rejected or failed the request.';
}

function readErrorCode(error: unknown): string | null {
  if (!isRecord(error)) {
    return null;
  }

  if (typeof error.code === 'string') {
    return error.code;
  }

  if (typeof error.error === 'string') {
    return error.error;
  }

  return null;
}

function formatPermissions(permissions: IncidentJoinResponse['membership']['permissions']): string {
  return Object.entries(permissions)
    .filter(([, enabled]) => enabled)
    .map(([permission]) => permission)
    .join(', ');
}

export function registerZonaCeroTelegramFlows(bot: Bot<Context>): Bot<Context> {
  bot.command('start', async (ctx) => {
    await ctx.reply(handleTelegramWebhookUpdate({ message: { text: '/start' } }).responseText);
  });

  return bot;
}

export function createZonaCeroTelegramBot(token: string): Bot<Context> {
  return registerZonaCeroTelegramFlows(new Bot(token));
}

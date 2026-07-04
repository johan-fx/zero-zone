import type { SupportedLocale } from '@zona-cero/i18n';

import {
  DispatchTaskConnectedUpdateRequestSchema,
  DispatchTaskListResponseSchema,
  DispatchTaskResponseSchema,
  DispatchTaskStatusSchema,
  IncidentConfigResponseSchema,
  IncidentJoinResponseSchema,
  IncidentRoleSchema,
  IncidentSummarySchema,
  PrivateWebLinkIssueResponseSchema,
  ResourceReportConnectedCreateRequestSchema,
  ResourceReportCreateResponseSchema,
  SosAlertCreateResponseSchema,
  SosConnectedCreateRequestSchema,
  WorkCenterConnectedCreateRequestSchema,
  WorkCenterLocationSchema,
  WorkCenterPrioritySchema,
  WorkCenterCreateResponseSchema,
  type IncidentRole,
  type IncidentSummary,
} from '@zona-cero/contracts';

import {
  hasOnlyKeys,
  isNonEmptyString,
  isOptionalString,
  isRecord,
  parseDispatchStatus,
  parseReportKind,
  parseUrgency,
} from './parsing';
import type {
  TelegramDispatchTaskState,
  TelegramDispatchTaskPrefill,
  TelegramFamilyReunificationState,
  TelegramIncidentJoinState,
  TelegramResourceNeedRecommendation,
  TelegramResourceReportState,
  TelegramSosState,
  TelegramWorkCenterPrefill,
  TelegramWorkCenterReportState,
} from './types';

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
    const preferredLocale = parsePreferredLocale(value);
    return hasOnlyKeys(value, ['step', 'preferredLocale']) && preferredLocale ? { step: 'idle', ...preferredLocale } : null;
  }

  if (value.step === 'cancelled') {
    return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;
  }

  if (value.step === 'awaitingIncident') {
    const preferredLocale = parsePreferredLocale(value);
    const desiredRole = parseOptionalIncidentRole(value.desiredRole);
    if (
      !hasOnlyKeys(value, ['step', 'incidents', 'externalUserId', 'preferredLocale', 'displayNameHint', 'desiredRole']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      !isOptionalString(value.displayNameHint) ||
      desiredRole === false ||
      !Array.isArray(value.incidents) ||
      !preferredLocale
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
      ...preferredLocale,
      ...(value.displayNameHint ? { displayNameHint: value.displayNameHint } : {}),
      ...(desiredRole ? { desiredRole } : {}),
    };
  }

  if (value.step === 'awaitingPseudonym') {
    const incident = IncidentSummarySchema.safeParse(value.incident);
    const preferredLocale = parsePreferredLocale(value);
    const desiredRole = parseOptionalIncidentRole(value.desiredRole);
    if (
      !hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'preferredLocale', 'displayNameHint', 'desiredRole']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      !isOptionalString(value.displayNameHint) ||
      desiredRole === false ||
      !incident.success ||
      !preferredLocale
    ) {
      return null;
    }

    return {
      step: 'awaitingPseudonym',
      incident: incident.data,
      externalUserId: value.externalUserId,
      ...preferredLocale,
      ...(value.displayNameHint ? { displayNameHint: value.displayNameHint } : {}),
      ...(desiredRole ? { desiredRole } : {}),
    };
  }

  if (value.step === 'awaitingRole') {
    const config = IncidentConfigResponseSchema.safeParse(value.config);
    const preferredLocale = parsePreferredLocale(value);
    const desiredRole = parseOptionalIncidentRole(value.desiredRole);
    if (
      !hasOnlyKeys(value, ['step', 'config', 'externalUserId', 'pseudonym', 'preferredLocale', 'desiredRole']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      typeof value.pseudonym !== 'string' ||
      value.pseudonym.length === 0 ||
      desiredRole === false ||
      !config.success ||
      !preferredLocale
    ) {
      return null;
    }

    return {
      step: 'awaitingRole',
      config: config.data,
      externalUserId: value.externalUserId,
      pseudonym: value.pseudonym,
      ...preferredLocale,
      ...(desiredRole ? { desiredRole } : {}),
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


function parseOptionalIncidentRole(value: unknown): IncidentRole | null | false {
  if (value === undefined) return null;
  const parsed = IncidentRoleSchema.safeParse(value);
  return parsed.success ? parsed.data : false;
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
      !hasOnlyKeys(value, ['step', 'incidents', 'externalUserId', 'displayName', 'prefill']) ||
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

    const prefill = parseWorkCenterPrefill(value.prefill);
    return {
      step: 'awaitingIncident',
      incidents,
      externalUserId: value.externalUserId,
      ...(value.displayName ? { displayName: value.displayName } : {}),
      ...(prefill ? { prefill } : {}),
    };
  }

  if (value.step === 'awaitingName') {
    const incident = IncidentSummarySchema.safeParse(value.incident);
    if (
      !hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'prefill']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      !isOptionalString(value.displayName) ||
      !incident.success
    ) {
      return null;
    }

    const prefill = parseWorkCenterPrefill(value.prefill);
    return {
      step: 'awaitingName',
      incident: incident.data,
      externalUserId: value.externalUserId,
      ...(value.displayName ? { displayName: value.displayName } : {}),
      ...(prefill ? { prefill } : {}),
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



function parseWorkCenterPrefill(value: unknown): TelegramWorkCenterPrefill | null {
  if (value === undefined) return null;
  if (!isRecord(value) || !hasOnlyKeys(value, ['name', 'description', 'priority', 'initialNeed', 'surplus', 'location'])) return null;

  const priority = value.priority === undefined ? undefined : WorkCenterPrioritySchema.safeParse(value.priority);
  if (priority && !priority.success) return null;
  const location = value.location === undefined ? undefined : WorkCenterLocationSchema.safeParse(value.location);
  if (location && !location.success) return null;

  const prefill: TelegramWorkCenterPrefill = {};
  if (isNonEmptyString(value.name)) prefill.name = value.name;
  if (isNonEmptyString(value.description)) prefill.description = value.description;
  if (priority?.success) prefill.priority = priority.data;
  if (location?.success) prefill.location = location.data;
  if (isNonEmptyString(value.initialNeed)) prefill.initialNeed = value.initialNeed;
  if (isNonEmptyString(value.surplus)) prefill.surplus = value.surplus;

  return Object.keys(prefill).length > 0 ? prefill : null;
}

function parseTelegramResourceReportStateValue(value: unknown): TelegramResourceReportState | null {
  if (!isRecord(value) || typeof value.step !== 'string') return null;
  if (value.step === 'idle') {
    const preferredLocale = parsePreferredLocale(value);
    return hasOnlyKeys(value, ['step', 'preferredLocale']) && preferredLocale ? { step: 'idle', ...preferredLocale } : null;
  }
  if (value.step === 'cancelled') return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;

  const incident = 'incident' in value ? IncidentSummarySchema.safeParse(value.incident) : null;
  const base = parseConversationBase(value);

  if (value.step === 'awaitingIncident') {
    if (!hasOnlyKeys(value, ['step', 'incidents', 'externalUserId', 'displayName', 'preferredLocale']) || !base || !Array.isArray(value.incidents)) return null;
    const incidents = parseIncidentArray(value.incidents);
    return incidents ? { step: 'awaitingIncident', incidents, ...base } : null;
  }

  if (value.step === 'awaitingRecommendedNeedSelection') {
    const preferredLocale = parsePreferredLocale(value);
    if (
      !hasOnlyKeys(value, ['step', 'recommendations', 'externalUserId', 'displayName', 'preferredLocale', 'category']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      !isOptionalString(value.displayName) ||
      !isOptionalString(value.category) ||
      !preferredLocale?.preferredLocale ||
      !Array.isArray(value.recommendations)
    ) return null;
    const recommendations = parseResourceNeedRecommendations(value.recommendations);
    return recommendations ? {
      step: 'awaitingRecommendedNeedSelection',
      recommendations,
      externalUserId: value.externalUserId,
      ...(value.displayName ? { displayName: value.displayName } : {}),
      preferredLocale: preferredLocale.preferredLocale,
      ...(value.category ? { category: value.category } : {}),
    } : null;
  }

  if (value.step === 'awaitingKind') {
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'preferredLocale']) || !base || !incident?.success) return null;
    return { step: 'awaitingKind', incident: incident.data, ...base };
  }

  if (value.step === 'awaitingCategory') {
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'preferredLocale', 'reportKind', 'recommendedWorkCenterId']) || !base || !incident?.success) return null;
    const reportKind = parseReportKind(value.reportKind);
    return reportKind && isOptionalString(value.recommendedWorkCenterId) ? { step: 'awaitingCategory', incident: incident.data, ...base, reportKind, ...(value.recommendedWorkCenterId ? { recommendedWorkCenterId: value.recommendedWorkCenterId } : {}) } : null;
  }

  if (value.step === 'awaitingQuantity') {
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'preferredLocale', 'reportKind', 'category', 'recommendedWorkCenterId']) || !base || !incident?.success || !isNonEmptyString(value.category)) return null;
    const reportKind = parseReportKind(value.reportKind);
    return reportKind && isOptionalString(value.recommendedWorkCenterId) ? { step: 'awaitingQuantity', incident: incident.data, ...base, reportKind, category: value.category, ...(value.recommendedWorkCenterId ? { recommendedWorkCenterId: value.recommendedWorkCenterId } : {}) } : null;
  }

  if (value.step === 'awaitingUrgency') {
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'preferredLocale', 'reportKind', 'category', 'quantityApprox', 'recommendedWorkCenterId']) || !base || !incident?.success || !isNonEmptyString(value.category) || !isNonEmptyString(value.quantityApprox)) return null;
    const reportKind = parseReportKind(value.reportKind);
    return reportKind && isOptionalString(value.recommendedWorkCenterId) ? { step: 'awaitingUrgency', incident: incident.data, ...base, reportKind, category: value.category, quantityApprox: value.quantityApprox, ...(value.recommendedWorkCenterId ? { recommendedWorkCenterId: value.recommendedWorkCenterId } : {}) } : null;
  }

  if (value.step === 'awaitingConstraints') {
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'preferredLocale', 'reportKind', 'category', 'quantityApprox', 'urgency', 'recommendedWorkCenterId']) || !base || !incident?.success || !isNonEmptyString(value.category) || !isNonEmptyString(value.quantityApprox)) return null;
    const reportKind = parseReportKind(value.reportKind);
    const urgency = parseUrgency(value.urgency);
    return reportKind && urgency && isOptionalString(value.recommendedWorkCenterId) ? { step: 'awaitingConstraints', incident: incident.data, ...base, reportKind, category: value.category, quantityApprox: value.quantityApprox, urgency, ...(value.recommendedWorkCenterId ? { recommendedWorkCenterId: value.recommendedWorkCenterId } : {}) } : null;
  }

  if (value.step === 'awaitingWorkCenter' || value.step === 'awaitingConfirmation') {
    const request = ResourceReportConnectedCreateRequestSchema.safeParse(value.request);
    if (!hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'preferredLocale', 'request']) || !base || !incident?.success || !request.success) return null;
    return { step: value.step, incident: incident.data, ...base, request: request.data };
  }

  if (value.step === 'reported') {
    const response = ResourceReportCreateResponseSchema.safeParse(value.response);
    return hasOnlyKeys(value, ['step', 'response']) && response.success ? { step: 'reported', response: response.data } : null;
  }

  return null;
}

function parseDispatchTaskPrefill(value: unknown): TelegramDispatchTaskPrefill | null | false {
  if (value === undefined) return null;
  if (!isRecord(value) || !hasOnlyKeys(value, ['taskHint', 'category', 'quantityApprox', 'destinationHint', 'status', 'statusCandidate'])) return false;

  const status = value.status === undefined ? undefined : DispatchTaskStatusSchema.safeParse(value.status);
  if (status && !status.success) return false;
  const statusCandidate = value.statusCandidate === undefined ? undefined : DispatchTaskStatusSchema.safeParse(value.statusCandidate);
  if (statusCandidate && !statusCandidate.success) return false;

  const prefill: TelegramDispatchTaskPrefill = {};
  if (isNonEmptyString(value.taskHint)) prefill.taskHint = value.taskHint;
  if (isNonEmptyString(value.category)) prefill.category = value.category;
  if (isNonEmptyString(value.quantityApprox)) prefill.quantityApprox = value.quantityApprox;
  if (isNonEmptyString(value.destinationHint)) prefill.destinationHint = value.destinationHint;
  if (status?.success) prefill.status = status.data;
  if (statusCandidate?.success) prefill.statusCandidate = statusCandidate.data;

  return Object.keys(prefill).length > 0 ? prefill : null;
}

function parseTelegramDispatchTaskStateValue(value: unknown): TelegramDispatchTaskState | null {
  if (!isRecord(value) || typeof value.step !== 'string') return null;
  if (value.step === 'idle') return hasOnlyKeys(value, ['step']) ? { step: 'idle' } : null;
  if (value.step === 'cancelled') return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;

  if (value.step === 'awaitingIncident') {
    const prefill = parseDispatchTaskPrefill(value.prefill);
    if (!hasOnlyKeys(value, ['step', 'incidents', 'externalUserId', 'prefill']) || !isNonEmptyString(value.externalUserId) || !Array.isArray(value.incidents) || prefill === false) return null;
    const incidents = parseIncidentArray(value.incidents);
    return incidents ? { step: 'awaitingIncident', incidents, externalUserId: value.externalUserId, ...(prefill ? { prefill } : {}) } : null;
  }

  const incident = 'incident' in value ? IncidentSummarySchema.safeParse(value.incident) : null;
  if (value.step === 'awaitingTask') {
    const tasks = DispatchTaskListResponseSchema.safeParse({ dispatchTasks: value.tasks });
    const prefill = parseDispatchTaskPrefill(value.prefill);
    if (!hasOnlyKeys(value, ['step', 'incident', 'tasks', 'externalUserId', 'prefill']) || !isNonEmptyString(value.externalUserId) || !incident?.success || !tasks.success || prefill === false) return null;
    return { step: 'awaitingTask', incident: incident.data, tasks: tasks.data.dispatchTasks, externalUserId: value.externalUserId, ...(prefill ? { prefill } : {}) };
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
  if (value.step === 'idle') {
    const preferredLocale = parsePreferredLocale(value);
    return hasOnlyKeys(value, ['step', 'preferredLocale']) && preferredLocale ? { step: 'idle', ...preferredLocale } : null;
  }
  if (value.step === 'cancelled') return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;

  const base = parseConversationBase(value);

  if (value.step === 'awaitingIncident') {
    if (
      !hasOnlyKeys(value, ['step', 'incidents', 'externalUserId', 'displayName', 'preferredLocale']) ||
      !base ||
      !Array.isArray(value.incidents)
    ) {
      return null;
    }
    const incidents = parseIncidentArray(value.incidents);
    return incidents ? { step: 'awaitingIncident', incidents, ...base } : null;
  }

  if (value.step === 'awaitingConfirmation') {
    const incident = IncidentSummarySchema.safeParse(value.incident);
    const request = SosConnectedCreateRequestSchema.safeParse(value.request);
    if (
      !hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'displayName', 'request', 'preferredLocale']) ||
      !base ||
      !incident.success ||
      !request.success
    ) {
      return null;
    }
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
  if (value.step === 'idle') {
    const preferredLocale = parsePreferredLocale(value);
    return hasOnlyKeys(value, ['step', 'preferredLocale']) && preferredLocale ? { step: 'idle', ...preferredLocale } : null;
  }
  if (value.step === 'cancelled') return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;

  const base = parseConversationBase(value);

  if (value.step === 'awaitingIncident') {
    if (
      !hasOnlyKeys(value, ['step', 'incidents', 'externalUserId', 'displayName', 'preferredLocale']) ||
      !base ||
      !Array.isArray(value.incidents)
    ) {
      return null;
    }
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

function parseConversationBase(value: Record<string, unknown>): { externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale } | null {
  if (!isNonEmptyString(value.externalUserId) || !isOptionalString(value.displayName)) return null;
  const preferredLocale = parsePreferredLocale(value);
  if (!preferredLocale) return null;
  return {
    externalUserId: value.externalUserId,
    ...(value.displayName ? { displayName: value.displayName } : {}),
    ...preferredLocale,
  };
}

function parsePreferredLocale(value: Record<string, unknown>): { preferredLocale?: SupportedLocale } | null {
  if (value.preferredLocale === undefined) return {};
  if (value.preferredLocale === 'es' || value.preferredLocale === 'en') return { preferredLocale: value.preferredLocale };
  return null;
}


function parseResourceNeedRecommendations(values: unknown[]): TelegramResourceNeedRecommendation[] | null {
  const recommendations: TelegramResourceNeedRecommendation[] = [];
  for (const value of values) {
    if (!isRecord(value)) return null;
    const incident = IncidentSummarySchema.safeParse(value.incident);
    const urgency = value.urgency === undefined ? undefined : parseUrgency(value.urgency);
    const reasons = value.reasons === undefined ? undefined : Array.isArray(value.reasons) && value.reasons.every((reason) => typeof reason === 'string' && reason.length > 0) ? value.reasons : null;
    if (!incident.success || !isOptionalString(value.workCenterId) || !isOptionalString(value.workCenterName) || !isOptionalString(value.category) || !isOptionalString(value.quantityApprox) || reasons === null || (value.score !== undefined && typeof value.score !== 'number') || (value.urgency !== undefined && !urgency)) return null;
    recommendations.push({
      incident: incident.data,
      ...(value.workCenterId ? { workCenterId: value.workCenterId } : {}),
      ...(value.workCenterName ? { workCenterName: value.workCenterName } : {}),
      ...(value.category ? { category: value.category } : {}),
      ...(value.quantityApprox ? { quantityApprox: value.quantityApprox } : {}),
      ...(urgency ? { urgency } : {}),
      ...(typeof value.score === 'number' ? { score: value.score } : {}),
      ...(reasons ? { reasons } : {}),
    });
  }
  return recommendations;
}

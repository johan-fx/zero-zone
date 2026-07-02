import { Bot, type Context } from 'grammy';

import { formatMessage, resolveLocaleFromCandidates, type SupportedLocale } from '@zona-cero/i18n';

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
  type SyncFreshness,
  type PrivateWebLinkIssueRequest,
  type PrivateWebLinkIssueResponse,
  OperationalEventSchema,
  type OperationalEvent,
  type TelegramWebhookResult,
} from '@zona-cero/contracts';


export type ChannelTelemetryPort = {
  emit(event: OperationalEvent): void | Promise<void>;
};

export type TelegramTelemetryOptions = {
  telemetry?: ChannelTelemetryPort;
};

type TelegramTelemetryScope =
  | 'telegram.command'
  | 'telegram.incident_join'
  | 'telegram.work_center'
  | 'telegram.resource_report'
  | 'telegram.dispatch_task'
  | 'telegram.sos'
  | 'telegram.private_link';

const telemetryTerminalSteps = new Set(['joined', 'reported', 'updated', 'submitted', 'linked']);

export function emitChannelTelemetry(telemetry: ChannelTelemetryPort | undefined, event: OperationalEvent): void {
  if (!telemetry) return;

  const parsed = OperationalEventSchema.parse(event);
  void Promise.resolve()
    .then(() => telemetry.emit(parsed))
    .catch(() => undefined);
}

export function createTelegramTelemetryEvent(input: {
  scope: TelegramTelemetryScope;
  action: string;
  result: OperationalEvent['result'];
  errorCode?: OperationalEvent['errorCode'];
  latencyMs?: number;
}): OperationalEvent {
  return OperationalEventSchema.parse({
    event: input.scope === 'telegram.private_link' ? 'private_link.attempted' : 'operation.processed',
    category: input.scope === 'telegram.private_link' ? 'security' : 'sync',
    result: input.result,
    channel: 'telegram',
    scope: input.scope,
    action: input.action,
    errorCode: input.errorCode ?? null,
    ...(input.latencyMs === undefined ? {} : { latencyMs: input.latencyMs }),
    sampled: true,
  });
}

function resolveFlowTelemetryResult(previousStep: string, nextStep: string, responseText: string): Pick<OperationalEvent, 'result' | 'errorCode'> {
  if (nextStep === 'cancelled') return { result: 'bypassed', errorCode: null };
  if (telemetryTerminalSteps.has(nextStep)) return { result: 'accepted', errorCode: null };
  if (/rate[_ -]?limited/i.test(responseText)) return { result: 'rejected', errorCode: 'rate_limited' };
  if (/security challenge/i.test(responseText)) return { result: 'rejected', errorCode: 'security_challenge_required' };
  if (/turnstile/i.test(responseText)) return { result: 'rejected', errorCode: 'turnstile_failed' };
  if (/expired/i.test(responseText)) return { result: 'rejected', errorCode: 'link_expired' };
  if (/permission denied|not found|invalid|could not|rejected|failed/i.test(responseText)) return { result: 'rejected', errorCode: null };
  return previousStep === nextStep ? { result: 'bypassed', errorCode: null } : { result: 'accepted', errorCode: null };
}

function emitTelegramFlowTelemetry(
  options: TelegramTelemetryOptions | undefined,
  scope: TelegramTelemetryScope,
  previousStep: string,
  nextStep: string,
  responseText: string,
  startedAt: number,
): void {
  const result = resolveFlowTelemetryResult(previousStep, nextStep, responseText);
  emitChannelTelemetry(
    options?.telemetry,
    createTelegramTelemetryEvent({
      scope,
      action: `${previousStep}->${nextStep}`,
      result: result.result,
      errorCode: result.errorCode,
      latencyMs: Date.now() - startedAt,
    }),
  );
}

async function withTelegramFlowTelemetry<TResult extends { state: { step: string }; responseText: string }>(
  options: TelegramTelemetryOptions | undefined,
  scope: TelegramTelemetryScope,
  previousStep: string,
  startedAt: number,
  run: () => Promise<{ state: { step: string }; responseText: string }>,
): Promise<TResult> {
  try {
    const result = await run();
    emitTelegramFlowTelemetry(options, scope, previousStep, result.state.step, result.responseText, startedAt);
    return result as TResult;
  } catch (error) {
    emitChannelTelemetry(
      options?.telemetry,
      createTelegramTelemetryEvent({
        scope,
        action: `${previousStep}->throw`,
        result: 'rejected',
        latencyMs: Date.now() - startedAt,
      }),
    );
    throw error;
  }
}

export type TelegramUpdateLike = {
  message?: {
    text?: string;
    chat?: { id?: number | string; type?: string };
    from?: { id?: number | string; first_name?: string; language_code?: string };
  };
};

export type TelegramIncidentJoinPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  getIncidentConfig(incidentId: string): Promise<IncidentConfigResponse>;
  joinIncident(incidentId: string, request: IncidentJoinRequest): Promise<IncidentJoinResponse>;
};

export type TelegramWorkCenterReportPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  createWorkCenter(incidentId: string, request: WorkCenterConnectedCreateRequest): Promise<WorkCenterCreateResponse>;
  getChannelFreshness?(incidentId: string): Promise<SyncFreshness>;
};

export type TelegramResourceNeedRecommendationInput = {
  externalUserId: string;
  displayName?: string;
  preferredLocale: SupportedLocale;
  messageText: string;
  category?: string;
  intent: 'where_needed';
  reportKind: Extract<ResourceReportKind, 'surplus'>;
};

export type TelegramResourceNeedRecommendation = {
  incident: IncidentSummary;
  workCenterId?: string;
  workCenterName?: string;
  category?: string;
  quantityApprox?: string;
  urgency?: ResourceReportUrgency;
  score?: number;
  reasons?: string[];
};

export type TelegramResourceNeedRecommendationResponse = {
  recommendations: TelegramResourceNeedRecommendation[];
};

export type TelegramResourceReportPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  createResourceReport(incidentId: string, request: ResourceReportConnectedCreateRequest): Promise<ResourceReportCreateResponse>;
  listResourceNeedRecommendations?(input: TelegramResourceNeedRecommendationInput): Promise<TelegramResourceNeedRecommendationResponse>;
};

export type TelegramDispatchTaskPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  listDispatchTasks(incidentId: string): Promise<DispatchTaskListResponse>;
  updateDispatchTask(incidentId: string, dispatchTaskId: string, request: DispatchTaskConnectedUpdateRequest): Promise<DispatchTaskResponse>;
};

export type TelegramSosPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  createSosAlert(incidentId: string, request: SosConnectedCreateRequest): Promise<SosAlertCreateResponse>;
};

export type TelegramFamilyReunificationPorts = TelegramTelemetryOptions & {
  listIncidents(): Promise<IncidentListResponse>;
  createPrivateLink(incidentId: string, request: PrivateWebLinkIssueRequest): Promise<PrivateWebLinkIssueResponse>;
  formatPrivateLinkUrl?(response: PrivateWebLinkIssueResponse): string;
};

export type TelegramIncidentJoinState =
  | { step: 'idle'; preferredLocale?: SupportedLocale }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; preferredLocale?: SupportedLocale }
  | { step: 'awaitingPseudonym'; incident: IncidentSummary; externalUserId: string; preferredLocale?: SupportedLocale }
  | { step: 'awaitingRole'; config: IncidentConfigResponse; externalUserId: string; pseudonym: string; preferredLocale?: SupportedLocale }
  | { step: 'joined'; response: IncidentJoinResponse }
  | { step: 'cancelled' };

export type TelegramResourceReportState =
  | { step: 'idle'; preferredLocale?: SupportedLocale }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale }
  | { step: 'awaitingRecommendedNeedSelection'; recommendations: TelegramResourceNeedRecommendation[]; externalUserId: string; displayName?: string; preferredLocale: SupportedLocale; category?: string }
  | { step: 'awaitingKind'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale }
  | { step: 'awaitingCategory'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; reportKind: ResourceReportKind; recommendedWorkCenterId?: string }
  | { step: 'awaitingQuantity'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; reportKind: ResourceReportKind; category: string; recommendedWorkCenterId?: string }
  | { step: 'awaitingUrgency'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; reportKind: ResourceReportKind; category: string; quantityApprox: string; recommendedWorkCenterId?: string }
  | { step: 'awaitingConstraints'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; reportKind: ResourceReportKind; category: string; quantityApprox: string; urgency: ResourceReportUrgency; recommendedWorkCenterId?: string }
  | { step: 'awaitingWorkCenter'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; request: ResourceReportConnectedCreateRequest }
  | { step: 'awaitingConfirmation'; incident: IncidentSummary; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale; request: ResourceReportConnectedCreateRequest }
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
  | { step: 'idle'; preferredLocale?: SupportedLocale }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale }
  | { step: 'awaitingConfirmation'; incident: IncidentSummary; externalUserId: string; displayName?: string; request: SosConnectedCreateRequest; preferredLocale?: SupportedLocale }
  | { step: 'submitted'; response: SosAlertCreateResponse }
  | { step: 'cancelled' };

export type TelegramFamilyReunificationState =
  | { step: 'idle'; preferredLocale?: SupportedLocale }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string; displayName?: string; preferredLocale?: SupportedLocale }
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
    const preferredLocale = parsePreferredLocale(value);
    return hasOnlyKeys(value, ['step', 'preferredLocale']) && preferredLocale ? { step: 'idle', ...preferredLocale } : null;
  }

  if (value.step === 'cancelled') {
    return hasOnlyKeys(value, ['step']) ? { step: 'cancelled' } : null;
  }

  if (value.step === 'awaitingIncident') {
    const preferredLocale = parsePreferredLocale(value);
    if (
      !hasOnlyKeys(value, ['step', 'incidents', 'externalUserId', 'preferredLocale']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
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
    };
  }

  if (value.step === 'awaitingPseudonym') {
    const incident = IncidentSummarySchema.safeParse(value.incident);
    const preferredLocale = parsePreferredLocale(value);
    if (
      !hasOnlyKeys(value, ['step', 'incident', 'externalUserId', 'preferredLocale']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
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
    };
  }

  if (value.step === 'awaitingRole') {
    const config = IncidentConfigResponseSchema.safeParse(value.config);
    const preferredLocale = parsePreferredLocale(value);
    if (
      !hasOnlyKeys(value, ['step', 'config', 'externalUserId', 'pseudonym', 'preferredLocale']) ||
      typeof value.externalUserId !== 'string' ||
      value.externalUserId.length === 0 ||
      typeof value.pseudonym !== 'string' ||
      value.pseudonym.length === 0 ||
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

function parseReportKind(value: unknown): ResourceReportKind | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['needed', 'need', 'necesario', 'necesaria', 'necesarios', 'necesarias', 'necesitado', 'necesitada'].includes(normalized)) return 'needed';
  if (['surplus', 'available', 'offer', 'sobrante', 'sobrantes', 'disponible', 'disponibles', 'oferta'].includes(normalized)) return 'surplus';
  return null;
}

function parseUrgency(value: unknown): ResourceReportUrgency | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['low', 'baja', 'bajo'].includes(normalized)) return 'low';
  if (['medium', 'media', 'medio'].includes(normalized)) return 'medium';
  if (['high', 'alta', 'alto'].includes(normalized)) return 'high';
  if (['critical', 'critica', 'crítica', 'critico', 'crítico'].includes(normalized)) return 'critical';
  return null;
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

function readCommandArgument(update: TelegramUpdateLike): string | null {
  const text = update.message?.text?.trim();
  if (!text?.startsWith('/')) return null;
  const [, argument] = text.split(/\s+/, 2);
  return argument?.trim() || null;
}

export function resolveTelegramLocale(update: TelegramUpdateLike, preferredLocale?: string | null): SupportedLocale {
  return resolveLocaleFromCandidates([preferredLocale, inferTelegramLocaleFromText(update.message?.text), update.message?.from?.language_code]);
}

function inferTelegramLocaleFromText(text: string | null | undefined): SupportedLocale | null {
  const normalized = text?.trim().toLowerCase() ?? '';
  if (!normalized) return null;

  if (/\b(tengo|d[oó]nde|necesitan|necesito|necesitamos|busco|quiero|reportar|ayuda|medicamentos|agua potable|comida|mantas)\b/.test(normalized)) {
    return 'es';
  }

  if (/\b(i have|where|needed|need|looking for|searching for|available|surplus|medicine|water|food|blankets)\b/.test(normalized)) {
    return 'en';
  }

  return null;
}

function localeName(locale: SupportedLocale, displayLocale: SupportedLocale): string {
  return formatMessage(displayLocale, `locale.${locale}`);
}

function getPreferredLocaleFromState(state: unknown): SupportedLocale | undefined {
  return isRecord(state) && (state.preferredLocale === 'es' || state.preferredLocale === 'en') ? state.preferredLocale : undefined;
}

function withPreferredLocale<TState extends object>(state: TState, locale: SupportedLocale): TState & { preferredLocale: SupportedLocale } {
  return { ...state, preferredLocale: locale };
}

type TelegramLanguageCommandResult = TelegramWebhookResult & { locale: SupportedLocale };

function handleTelegramLanguageCommand(update: TelegramUpdateLike, currentLocale?: SupportedLocale): TelegramLanguageCommandResult | null {
  const command = resolveTelegramCommand(update);
  if (command !== '/idioma' && command !== '/language') return null;

  const requestedLocale = readCommandArgument(update);
  if (!requestedLocale) {
    const locale = resolveTelegramLocale(update, currentLocale);
    return { accepted: true, command, locale, responseText: formatMessage(locale, 'telegram.language.choose') };
  }

  const locale = resolveLocaleFromCandidates([requestedLocale, currentLocale, update.message?.from?.language_code]);
  return {
    accepted: true,
    command,
    locale,
    responseText: formatMessage(locale, 'telegram.language.changed', { localeName: localeName(locale, locale) }),
  };
}

export function handleTelegramWebhookUpdate(
  update: TelegramUpdateLike,
  options: TelegramTelemetryOptions = {},
): TelegramWebhookResult {
  const command = resolveTelegramCommand(update);
  if (command) {
    emitChannelTelemetry(
      options.telemetry,
      createTelegramTelemetryEvent({
        scope: 'telegram.command',
        action: command,
        result: 'accepted',
      }),
    );
  }

  const locale = resolveTelegramLocale(update);
  const languageResult = handleTelegramLanguageCommand(update);
  if (languageResult) return languageResult;

  if (command === '/start') {
    return {
      accepted: true,
      command,
      responseText: formatMessage(locale, 'telegram.start.ready'),
    };
  }

  if (command === '/sos') {
    return {
      accepted: true,
      command,
      responseText: formatMessage(locale, 'telegram.sos.command'),
    };
  }

  if (isFamilyReunificationCommand(command)) {
    return {
      accepted: true,
      command,
      responseText: formatMessage(locale, 'telegram.family.command'),
    };
  }

  return {
    accepted: true,
    command,
    responseText: formatMessage(locale, 'telegram.default.received'),
  };
}

export async function handleTelegramIncidentJoinFlow(
  state: TelegramIncidentJoinState,
  update: TelegramUpdateLike,
  ports: TelegramIncidentJoinPorts,
): Promise<TelegramIncidentJoinFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;

  return withTelegramFlowTelemetry(
    ports,
    'telegram.incident_join',
    previousStep,
    startedAt,
    async () => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);
      const locale = resolveTelegramLocale(update, getPreferredLocaleFromState(state));
      const languageResult = handleTelegramLanguageCommand(update, locale);
      if (languageResult) return { state: withPreferredLocale(state, languageResult.locale), responseText: languageResult.responseText };

      if (command === '/cancel') {
        return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.join.cancelled') };
      }

      if (command === '/start' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'joined') {
        return startIncidentSelection(update, ports, locale);
      }

      if (state.step === 'awaitingIncident') {
        const incident = selectIncident(state.incidents, text);
        if (!incident) {
          return {
            state,
            responseText: formatMessage(locale, 'telegram.error.incident_not_found', { incidentList: formatIncidentList(state.incidents) }),
          };
        }

        return {
          state: { step: 'awaitingPseudonym', incident, externalUserId: state.externalUserId, preferredLocale: locale },
          responseText: formatMessage(locale, 'telegram.join.selected', { incidentName: incident.name }),
        };
      }

      if (state.step === 'awaitingPseudonym') {
        if (!text || text.startsWith('/')) {
          return { state, responseText: formatMessage(locale, 'telegram.join.pseudonym.required') };
        }

        try {
          const config = await ports.getIncidentConfig(state.incident.incidentId);
          if (config.incident.incidentId !== state.incident.incidentId) {
            return { state, responseText: formatMessage(locale, 'telegram.join.config_mismatch') };
          }

          return {
            state: { step: 'awaitingRole', config, externalUserId: state.externalUserId, pseudonym: text, preferredLocale: locale },
            responseText: formatMessage(locale, 'telegram.join.role.choose', { roleList: formatRoles(config.roles) }),
          };
        } catch {
          return { state, responseText: formatMessage(locale, 'telegram.join.roles_load_failed') };
        }
      }

      if (state.step === 'awaitingRole') {
        const role = selectRole(state.config.roles, text);
        if (!role) {
          return { state, responseText: formatMessage(locale, 'telegram.join.role.invalid', { roleList: formatRoles(state.config.roles) }) };
        }

        const request = IncidentJoinRequestSchema.parse({
          channel: 'telegram',
          externalId: state.externalUserId,
          displayName: state.pseudonym,
          role,
          preferredLocale: locale,
        });

        try {
          const response = await ports.joinIncident(state.config.incident.incidentId, request);
          return { state: { step: 'joined', response }, responseText: formatJoinSuccess(locale, response) };
        } catch {
          return { state, responseText: formatMessage(locale, 'telegram.join.error.default') };
        }
      }

      return { state, responseText: formatMessage(locale, 'telegram.join.prompt') };
    },
  );
}


export function formatTelegramChannelLimitation(freshness: SyncFreshness, locale: SupportedLocale = 'es'): string | null {
  if (freshness.status === 'fresh' && freshness.cursorLag === 0 && !freshness.hasConflicts) return null;

  const details: string[] = [];
  if (freshness.cursorLag > 0) details.push(formatMessage(locale, 'telegram.freshness.cursor_lag', { count: freshness.cursorLag }));
  if (freshness.hasConflicts) details.push(formatMessage(locale, 'telegram.freshness.conflicts'));

  const suffix = details.length > 0 ? ` ${details.join('; ')}.` : '';

  if (freshness.status === 'missing') return formatMessage(locale, 'telegram.freshness.missing', { suffix });
  if (freshness.status === 'expired') return formatMessage(locale, 'telegram.freshness.expired', { suffix });
  return formatMessage(locale, 'telegram.freshness.stale', { suffix });
}

async function getTelegramChannelLimitation(ports: TelegramWorkCenterReportPorts, incidentId: string, locale: SupportedLocale = 'es'): Promise<string | null> {
  if (!ports.getChannelFreshness) return null;

  try {
    return formatTelegramChannelLimitation(await ports.getChannelFreshness(incidentId), locale);
  } catch {
    return formatMessage(locale, 'telegram.freshness.unavailable');
  }
}

export async function handleTelegramWorkCenterReportFlow(
  state: TelegramWorkCenterReportState,
  update: TelegramUpdateLike,
  ports: TelegramWorkCenterReportPorts,
): Promise<TelegramWorkCenterReportFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;

  return withTelegramFlowTelemetry(
    ports,
    'telegram.work_center',
    previousStep,
    startedAt,
    async () => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);
      const locale = resolveTelegramLocale(update);

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
            responseText: formatMessage(locale, 'telegram.error.incident_not_found', { incidentList: formatIncidentList(state.incidents) }),
          };
        }

        const limitation = await getTelegramChannelLimitation(ports, incident.incidentId, locale);

        return {
          state: {
            step: 'awaitingName',
            incident,
            externalUserId: state.externalUserId,
            displayName: state.displayName,
          },
          responseText: [limitation, 'Send the work center name. Use /cancel to stop.'].filter(Boolean).join('\n'),
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
    },
  );
}


export async function handleTelegramResourceReportFlow(
  state: TelegramResourceReportState,
  update: TelegramUpdateLike,
  ports: TelegramResourceReportPorts,
): Promise<TelegramResourceReportFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;

  return withTelegramFlowTelemetry(
    ports,
    'telegram.resource_report',
    previousStep,
    startedAt,
    async () => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);
      const locale = resolveTelegramLocale(update, getPreferredLocaleFromState(state));
      const languageResult = handleTelegramLanguageCommand(update, locale);
      if (languageResult) return { state: withPreferredLocale(state, languageResult.locale), responseText: languageResult.responseText };

      if (command === '/cancel') return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.resource.cancelled') };
      if (command === '/resource' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'reported') {
        return startResourceIncidentSelection(update, ports, locale);
      }

      if (state.step === 'awaitingIncident') {
        const incident = selectIncident(state.incidents, text);
        if (!incident) return { state, responseText: formatMessage(locale, 'telegram.error.incident_not_found', { incidentList: formatIncidentList(state.incidents) }) };
        return { state: { step: 'awaitingKind', incident, externalUserId: state.externalUserId, displayName: state.displayName, preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.resource.kind.prompt') };
      }

      if (state.step === 'awaitingRecommendedNeedSelection') {
        if (isManualFallback(text)) return startResourceManualIncidentSelection(update, ports, locale, state.externalUserId, state.displayName);
        const recommendation = selectResourceNeedRecommendation(state.recommendations, text);
        if (!recommendation) return { state, responseText: formatMessage(locale, 'telegram.resource.recommendations.choose', { recommendationList: formatResourceNeedRecommendationList(locale, state.recommendations) }) };
        const base = {
          incident: recommendation.incident,
          externalUserId: state.externalUserId,
          displayName: state.displayName,
          preferredLocale: locale,
          reportKind: 'surplus' as const,
          ...(recommendation.workCenterId ? { recommendedWorkCenterId: recommendation.workCenterId } : {}),
        };
        if (state.category || recommendation.category) {
          return { state: { step: 'awaitingQuantity', ...base, category: state.category ?? recommendation.category ?? '' }, responseText: formatMessage(locale, 'telegram.resource.quantity.prompt') };
        }
        return { state: { step: 'awaitingCategory', ...base }, responseText: formatMessage(locale, 'telegram.resource.category.prompt') };
      }

      if (state.step === 'awaitingKind') {
        const reportKind = parseReportKind(text.toLowerCase());
        if (!reportKind) return { state, responseText: formatMessage(locale, 'telegram.resource.kind.invalid') };
        return { state: { step: 'awaitingCategory', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, preferredLocale: locale, reportKind }, responseText: formatMessage(locale, 'telegram.resource.category.prompt') };
      }

      if (state.step === 'awaitingCategory') {
        if (!text || text.startsWith('/')) return { state, responseText: formatMessage(locale, 'telegram.resource.category.required') };
        return { state: { step: 'awaitingQuantity', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, preferredLocale: locale, reportKind: state.reportKind, category: text, recommendedWorkCenterId: state.recommendedWorkCenterId }, responseText: formatMessage(locale, 'telegram.resource.quantity.prompt') };
      }

      if (state.step === 'awaitingQuantity') {
        if (!text || text.startsWith('/')) return { state, responseText: formatMessage(locale, 'telegram.resource.quantity.required') };
        return { state: { ...state, step: 'awaitingUrgency', preferredLocale: locale, quantityApprox: text }, responseText: formatMessage(locale, 'telegram.resource.urgency.prompt') };
      }

      if (state.step === 'awaitingUrgency') {
        const urgency = parseUrgency(text.toLowerCase());
        if (!urgency) return { state, responseText: formatMessage(locale, 'telegram.resource.urgency.invalid') };
        return { state: { ...state, step: 'awaitingConstraints', preferredLocale: locale, urgency }, responseText: formatMessage(locale, 'telegram.resource.constraints.prompt') };
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
            ...(state.recommendedWorkCenterId ? { workCenterId: state.recommendedWorkCenterId } : {}),
          },
        });
        return { state: { step: 'awaitingWorkCenter', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, preferredLocale: locale, request }, responseText: formatMessage(locale, 'telegram.resource.work_center.prompt') };
      }

      if (state.step === 'awaitingWorkCenter') {
        const request = text && !isSkip(text) && !text.startsWith('/')
          ? ResourceReportConnectedCreateRequestSchema.parse({ ...state.request, payload: { ...state.request.payload, workCenterId: text } })
          : state.request;
        return { state: { step: 'awaitingConfirmation', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, preferredLocale: locale, request }, responseText: formatResourceReportConfirmation(locale, state.incident, request) };
      }

      if (state.step === 'awaitingConfirmation') {
        if (isCancellation(text)) return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.resource.cancelled') };
        if (!isConfirmation(text)) return { state, responseText: formatMessage(locale, 'telegram.resource.confirmation.required') };
        try {
          const response = await ports.createResourceReport(state.incident.incidentId, state.request);
          return { state: { step: 'reported', response }, responseText: formatResourceReportSuccess(locale, response) };
        } catch (error) {
          const errorCode = readErrorCode(error);
          return {
            state: errorCode === 'permission_denied' ? { step: 'cancelled' } : state,
            responseText: formatResourceReportError(locale, error),
          };
        }
      }

      return { state, responseText: formatMessage(locale, 'telegram.resource.prompt') };
    },
  );
}

export async function handleTelegramDispatchTaskFlow(
  state: TelegramDispatchTaskState,
  update: TelegramUpdateLike,
  ports: TelegramDispatchTaskPorts,
): Promise<TelegramDispatchTaskFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;

  return withTelegramFlowTelemetry(
    ports,
    'telegram.dispatch_task',
    previousStep,
    startedAt,
    async () => {
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
    },
  );
}

export async function handleTelegramSosFlow(
  state: TelegramSosState,
  update: TelegramUpdateLike,
  ports: TelegramSosPorts,
): Promise<TelegramSosFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;

  return withTelegramFlowTelemetry(
    ports,
    'telegram.sos',
    previousStep,
    startedAt,
    async () => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);
      const locale = resolveTelegramLocale(update, getPreferredLocaleFromState(state));
      const languageResult = handleTelegramLanguageCommand(update, locale);
      if (languageResult) return { state: withPreferredLocale(state, languageResult.locale), responseText: languageResult.responseText };

      if (command === '/cancel') {
        return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.sos.cancelled') };
      }

      if (command === '/sos' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'submitted') {
        return startSosIncidentSelection(update, ports);
      }

      if (state.step === 'awaitingIncident') {
        const incident = selectIncident(state.incidents, text);
        if (!incident) {
          return {
            state,
            responseText: formatMessage(locale, 'telegram.error.incident_not_found', { incidentList: formatIncidentList(state.incidents) }),
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
            preferredLocale: locale,
          },
          responseText: formatSosConfirmation(locale, incident),
        };
      }

      if (state.step === 'awaitingConfirmation') {
        if (isCancellation(text)) {
          return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.sos.cancelled') };
        }

        if (!isStrongSosConfirmation(text)) {
          return {
            state,
            responseText: formatMessage(locale, 'telegram.sos.confirmation.required'),
          };
        }

        try {
          const response = await ports.createSosAlert(state.incident.incidentId, state.request);
          return { state: { step: 'submitted', response }, responseText: formatSosSuccess(locale, response) };
        } catch (error) {
          return { state, responseText: formatSosError(locale, error) };
        }
      }

      return { state, responseText: formatMessage(locale, 'telegram.sos.command') };
    },
  );
}

export async function handleTelegramFamilyReunificationFlow(
  state: TelegramFamilyReunificationState,
  update: TelegramUpdateLike,
  ports: TelegramFamilyReunificationPorts,
): Promise<TelegramFamilyReunificationFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;

  return withTelegramFlowTelemetry(
    ports,
    'telegram.private_link',
    previousStep,
    startedAt,
    async () => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);
      const locale = resolveTelegramLocale(update, getPreferredLocaleFromState(state));
      const languageResult = handleTelegramLanguageCommand(update, locale);
      if (languageResult) return { state: withPreferredLocale(state, languageResult.locale), responseText: languageResult.responseText };

      if (command === '/cancel') {
        return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.family.cancelled') };
      }

      if (isFamilyReunificationCommand(command) || state.step === 'idle' || state.step === 'cancelled' || state.step === 'linked') {
        return startFamilyReunificationIncidentSelection(update, ports);
      }

      if (state.step === 'awaitingIncident') {
        const incident = selectIncident(state.incidents, text);
        if (!incident) {
          return {
            state,
            responseText: formatMessage(locale, 'telegram.error.incident_not_found', { incidentList: formatIncidentList(state.incidents) }),
          };
        }

        const request = createFamilyReunificationPrivateLinkRequest();

        try {
          const response = await ports.createPrivateLink(incident.incidentId, request);
          const url = ports.formatPrivateLinkUrl?.(response) ?? formatFamilyReunificationPrivateUrl(response);
          return {
            state: { step: 'linked', response },
            responseText: formatFamilyReunificationLinkSuccess(locale, url),
          };
        } catch {
          return { state, responseText: formatFamilyReunificationLinkError(locale) };
        }
      }

      return { state, responseText: formatMessage(locale, 'telegram.family.prompt') };
    },
  );
}

async function startIncidentSelection(update: TelegramUpdateLike, ports: TelegramIncidentJoinPorts, preferredLocale?: SupportedLocale): Promise<TelegramIncidentJoinFlowResult> {
  const locale = resolveTelegramLocale(update, preferredLocale);
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) {
    return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.join.user.required') };
  }

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) {
      return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.error.no_active_incidents') };
    }

    return {
      state: { step: 'awaitingIncident', incidents, externalUserId, preferredLocale: locale },
      responseText: formatMessage(locale, 'telegram.join.start', { incidentList: formatIncidentList(incidents) }),
    };
  } catch {
    return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.error.incidents_load_failed') };
  }
}

async function startFamilyReunificationIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramFamilyReunificationPorts,
): Promise<TelegramFamilyReunificationFlowResult> {
  const locale = resolveTelegramLocale(update);
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.family.user.required') };

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.family.no.incidents') };
    return {
      state: { step: 'awaitingIncident', incidents, externalUserId, displayName: getTelegramDisplayName(update), preferredLocale: locale },
      responseText: formatMessage(locale, 'telegram.family.start', { incidentList: formatIncidentList(incidents) }),
    };
  } catch {
    return { state: { step: 'idle', preferredLocale: locale }, responseText: formatFamilyReunificationLinkError(locale) };
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


async function startResourceIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramResourceReportPorts,
  preferredLocale?: SupportedLocale,
): Promise<TelegramResourceReportFlowResult> {
  const locale = resolveTelegramLocale(update, preferredLocale);
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.resource.user.required') };

  const displayName = getTelegramDisplayName(update);
  const recommendationInput = createResourceNeedRecommendationInput(update, externalUserId, displayName, locale);
  if (recommendationInput && ports.listResourceNeedRecommendations) {
    try {
      const { recommendations } = await ports.listResourceNeedRecommendations(recommendationInput);
      const topRecommendations = sortResourceNeedRecommendations(recommendations).slice(0, 3);
      if (topRecommendations.length > 0) {
        return {
          state: {
            step: 'awaitingRecommendedNeedSelection',
            recommendations: topRecommendations,
            externalUserId,
            displayName,
            preferredLocale: locale,
            ...(recommendationInput.category ? { category: recommendationInput.category } : {}),
          },
          responseText: formatMessage(locale, 'telegram.resource.recommendations.found', {
            recommendationList: formatResourceNeedRecommendationList(locale, topRecommendations),
          }),
        };
      }
      return startResourceManualIncidentSelection(update, ports, locale, externalUserId, displayName, true);
    } catch {
      // Recommendation lookup is an optional UX accelerator. Fall through to the manual incident flow.
    }
  }

  return startResourceManualIncidentSelection(update, ports, locale, externalUserId, displayName);
}


async function startResourceManualIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramResourceReportPorts,
  locale: SupportedLocale,
  externalUserId: string,
  displayName?: string,
  includeRecommendationFallback = false,
): Promise<TelegramResourceReportFlowResult> {
  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.error.no_active_incidents') };
    const incidentList = formatIncidentList(incidents);
    return {
      state: { step: 'awaitingIncident', incidents, externalUserId, displayName, preferredLocale: locale },
      responseText: includeRecommendationFallback
        ? formatMessage(locale, 'telegram.resource.recommendations.none', { incidentList })
        : formatMessage(locale, 'telegram.resource.start', { incidentList }),
    };
  } catch {
    return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.error.incidents_load_failed') };
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
  const locale = resolveTelegramLocale(update);
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.sos.user.required') };

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.sos.no.incidents') };
    return {
      state: { step: 'awaitingIncident', incidents, externalUserId, displayName: getTelegramDisplayName(update), preferredLocale: locale },
      responseText: formatMessage(locale, 'telegram.sos.start', { incidentList: formatIncidentList(incidents) }),
    };
  } catch {
    return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.sos.incidents_load_failed') };
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

function formatResourceNeedRecommendationList(locale: SupportedLocale, recommendations: TelegramResourceNeedRecommendation[]): string {
  return recommendations.map((recommendation, index) => {
    const destination = recommendation.workCenterName ?? recommendation.workCenterId ?? recommendation.incident.locationName;
    const category = recommendation.category ? ` · ${recommendation.category}` : '';
    const quantity = formatResourceNeedRecommendationQuantity(locale, recommendation);
    const urgency = recommendation.urgency ? ` · ${formatResourceUrgency(locale, recommendation.urgency)}` : '';
    const reason = formatResourceNeedRecommendationReason(locale, recommendation.reasons);
    return `${index + 1}. ${recommendation.incident.name} — ${destination}${category}${quantity}${urgency}${reason}`;
  }).join('\n');
}

function formatResourceNeedRecommendationQuantity(locale: SupportedLocale, recommendation: TelegramResourceNeedRecommendation): string {
  const quantity = recommendation.quantityApprox?.trim();
  const category = recommendation.category?.trim();
  const unspecified = locale === 'es' ? 'cantidad no especificada' : 'quantity not specified';

  if (!quantity) return ` · ${unspecified}`;
  if (category && normalizeRecommendationText(quantity) === normalizeRecommendationText(category)) return ` · ${unspecified}`;
  return ` · ${quantity}`;
}

function normalizeRecommendationText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function formatResourceNeedRecommendationReason(locale: SupportedLocale, reasons: string[] | undefined): string {
  if (!reasons || reasons.length === 0) return '';
  if (locale === 'es') {
    if (reasons.includes('linked_work_center')) return ' · motivo: misma categoría y necesidad vinculada a centro';
    return ' · motivo: misma categoría y prioridad operativa';
  }

  if (reasons.includes('linked_work_center')) return ' · reason: same category and work-center need';
  return ' · reason: same category and operational priority';
}

function selectResourceNeedRecommendation(recommendations: TelegramResourceNeedRecommendation[], text: string): TelegramResourceNeedRecommendation | null {
  const index = Number.parseInt(text, 10);
  if (Number.isInteger(index) && String(index) === text && index >= 1 && index <= recommendations.length) return recommendations[index - 1] ?? null;
  return recommendations.find((recommendation) => recommendation.incident.incidentId === text || recommendation.workCenterId === text) ?? null;
}

function sortResourceNeedRecommendations(recommendations: TelegramResourceNeedRecommendation[]): TelegramResourceNeedRecommendation[] {
  return [...recommendations].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.incident.incidentId.localeCompare(b.incident.incidentId));
}

function createResourceNeedRecommendationInput(
  update: TelegramUpdateLike,
  externalUserId: string,
  displayName: string | undefined,
  preferredLocale: SupportedLocale,
): TelegramResourceNeedRecommendationInput | null {
  const messageText = update.message?.text?.trim() ?? '';
  if (!hasImplicitWhereNeededQuestion(messageText) || !hasResourceOfferLanguage(messageText)) return null;
  return {
    externalUserId,
    displayName,
    preferredLocale,
    messageText,
    category: inferResourceCategory(messageText),
    intent: 'where_needed',
    reportKind: 'surplus',
  };
}

function hasImplicitWhereNeededQuestion(text: string): boolean {
  const normalized = normalizeResourceText(text);
  return normalized.includes('donde la necesitan') || normalized.includes('donde lo necesitan') || normalized.includes('donde se necesita') || normalized.includes('where needed') || normalized.includes('where is it needed');
}

function hasResourceOfferLanguage(text: string): boolean {
  const normalized = normalizeResourceText(text);
  return normalized.includes('tengo ') || normalized.includes('tenemos ') || normalized.includes('dispongo ') || normalized.includes('i have ') || normalized.includes('we have ');
}

function inferResourceCategory(text: string): string | undefined {
  const normalized = normalizeResourceText(text);
  if (['medicamento', 'medicamentos', 'medicina', 'medicinas', 'farmaco', 'farmacos', 'medicine', 'medication'].some((term) => normalized.includes(term))) return 'medication';
  if (['agua', 'water'].some((term) => normalized.includes(term))) return 'water';
  if (['comida', 'alimento', 'alimentos', 'food'].some((term) => normalized.includes(term))) return 'food';
  if (['manta', 'mantas', 'blanket', 'blankets'].some((term) => normalized.includes(term))) return 'blankets';
  if (['combustible', 'fuel'].some((term) => normalized.includes(term))) return 'fuel';
  if (['transporte', 'transport'].some((term) => normalized.includes(term))) return 'transport';
  if (['refugio', 'shelter'].some((term) => normalized.includes(term))) return 'shelter';
  if (['equipamiento', 'equipo', 'equipment'].some((term) => normalized.includes(term))) return 'equipment';
  return undefined;
}

function normalizeResourceText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function isManualFallback(text: string): boolean {
  return ['manual', 'm', 'omitir', 'saltar', 'skip'].includes(text.trim().toLowerCase());
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

function formatRoles(roles: IncidentRole[]): string {
  return roles.map((role, index) => `${index + 1}. ${role}`).join('\n');
}

function formatJoinSuccess(locale: SupportedLocale, response: IncidentJoinResponse): string {
  return formatMessage(locale, 'telegram.join.success', {
    incidentName: response.incident.name,
    role: response.membership.role,
    permissions: formatPermissions(response.membership.permissions),
    auditEventId: response.audit.auditEventId,
  });
}

function isConfirmation(text: string): boolean {
  return ['yes', 'y', 'confirm', 'ok', 'si', 'sí', 'confirmar'].includes(text.trim().toLowerCase());
}

function isCancellation(text: string): boolean {
  return ['no', 'n', 'cancel', 'cancelar'].includes(text.trim().toLowerCase());
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

function formatFamilyReunificationLinkSuccess(locale: SupportedLocale, url: string): string {
  return formatMessage(locale, 'telegram.family.link.success', { url });
}

function formatFamilyReunificationLinkError(locale: SupportedLocale = 'es'): string {
  return formatMessage(locale, 'telegram.family.link.error');
}


function parseOptionalList(text: string): string[] {
  if (isSkip(text)) return [];
  return text.split(',').map((item) => item.trim()).filter(Boolean);
}

function isSkip(text: string): boolean {
  return ['skip', 'none', 'no', 'n/a', 'omitir', 'saltar', 'ninguna', 'ninguno'].includes(text.trim().toLowerCase());
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

function formatResourceReportKind(locale: SupportedLocale, reportKind: ResourceReportKind): string {
  if (locale === 'es') return reportKind === 'needed' ? 'necesario' : 'sobrante';
  return reportKind;
}

function formatResourceUrgency(locale: SupportedLocale, urgency: ResourceReportUrgency): string {
  if (locale !== 'es') return urgency;
  const labels: Record<ResourceReportUrgency, string> = {
    low: 'baja',
    medium: 'media',
    high: 'alta',
    critical: 'crítica',
  };
  return labels[urgency];
}

function formatResourceReportConfirmation(locale: SupportedLocale, incident: IncidentSummary, request: ResourceReportConnectedCreateRequest): string {
  const payload = request.payload;
  return formatMessage(locale, 'telegram.resource.confirmation', {
    incidentName: incident.name,
    reportKind: formatResourceReportKind(locale, payload.reportKind),
    category: payload.category,
    quantityApprox: payload.quantityApprox,
    urgency: formatResourceUrgency(locale, payload.urgency),
    constraints: payload.constraints.length ? payload.constraints.join(', ') : formatMessage(locale, 'telegram.resource.none'),
    workCenter: payload.workCenterId ?? formatMessage(locale, 'telegram.resource.not_linked'),
  });
}

function formatResourceReportSuccess(locale: SupportedLocale, response: ResourceReportCreateResponse): string {
  return formatMessage(locale, 'telegram.resource.success', {
    reportKind: formatResourceReportKind(locale, response.resourceReport.reportKind),
    category: response.resourceReport.category,
    quantityApprox: response.resourceReport.quantityApprox,
    urgency: formatResourceUrgency(locale, response.resourceReport.urgency),
    auditEventId: response.audit.auditEventId,
  });
}

function formatResourceReportError(locale: SupportedLocale, error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'permission_denied') return formatMessage(locale, 'telegram.resource.error.permission_denied');
  if (code === 'invalid_payload') return formatMessage(locale, 'telegram.resource.error.invalid_payload');
  return formatMessage(locale, 'telegram.resource.error.default');
}

function formatDispatchTaskSuccess(response: DispatchTaskResponse): string {
  return [`Dispatch task updated: ${response.dispatchTask.dispatchTaskId}.`, `Status: ${response.dispatchTask.status}`].join('\n');
}

function formatSosConfirmation(locale: SupportedLocale, incident: IncidentSummary): string {
  return formatMessage(locale, 'telegram.sos.confirmation', { incidentName: incident.name });
}

function formatSosSuccess(locale: SupportedLocale, response: SosAlertCreateResponse): string {
  return formatMessage(locale, 'telegram.sos.success', {
    sosAlertId: response.sosAlert.sosAlertId,
    status: response.sosAlert.status,
    total: response.fanout.total,
    queued: response.fanout.queued,
    pending: response.fanout.pending,
    failed: response.fanout.failed,
    cancelled: response.fanout.cancelled,
  });
}

function formatSosError(locale: SupportedLocale, error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'permission_denied') return formatMessage(locale, 'telegram.sos.error.permission_denied');
  if (code === 'not_found') return formatMessage(locale, 'telegram.sos.error.not_found');
  if (code === 'invalid_payload') return formatMessage(locale, 'telegram.sos.error.invalid_payload');
  return formatMessage(locale, 'telegram.sos.error.default');
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

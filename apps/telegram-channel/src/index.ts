import { Bot, type Context } from 'grammy';

import {
  IncidentConfigResponseSchema,
  IncidentJoinRequestSchema,
  IncidentJoinResponseSchema,
  IncidentRoleSchema,
  IncidentSummarySchema,
  WorkCenterConnectedCreateRequestSchema,
  WorkCenterCreateResponseSchema,
  type WorkCenterConnectedCreateRequest,
  type WorkCenterCreateResponse,
  type IncidentConfigResponse,
  type IncidentJoinRequest,
  type IncidentJoinResponse,
  type IncidentListResponse,
  type IncidentRole,
  type IncidentSummary,
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

export type TelegramIncidentJoinState =
  | { step: 'idle' }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string }
  | { step: 'awaitingPseudonym'; incident: IncidentSummary; externalUserId: string }
  | { step: 'awaitingRole'; config: IncidentConfigResponse; externalUserId: string; pseudonym: string }
  | { step: 'joined'; response: IncidentJoinResponse }
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

export const TelegramIncidentJoinStateSchema = {
  parse: parseTelegramIncidentJoinState,
  safeParse: safeParseTelegramIncidentJoinState,
} as const;

export const TelegramWorkCenterReportStateSchema = {
  parse: parseTelegramWorkCenterReportState,
  safeParse: safeParseTelegramWorkCenterReportState,
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

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length > 0);
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

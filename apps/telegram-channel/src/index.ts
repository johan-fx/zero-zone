import { Bot, type Context } from 'grammy';

import {
  IncidentConfigResponseSchema,
  IncidentJoinRequestSchema,
  IncidentJoinResponseSchema,
  IncidentRoleSchema,
  IncidentSummarySchema,
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

export type TelegramIncidentJoinState =
  | { step: 'idle' }
  | { step: 'awaitingIncident'; incidents: IncidentSummary[]; externalUserId: string }
  | { step: 'awaitingPseudonym'; incident: IncidentSummary; externalUserId: string }
  | { step: 'awaitingRole'; config: IncidentConfigResponse; externalUserId: string; pseudonym: string }
  | { step: 'joined'; response: IncidentJoinResponse }
  | { step: 'cancelled' };

type TelegramIncidentJoinStateParseResult =
  | { success: true; data: TelegramIncidentJoinState }
  | { success: false; error: Error };

export const TelegramIncidentJoinStateSchema = {
  parse: parseTelegramIncidentJoinState,
  safeParse: safeParseTelegramIncidentJoinState,
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

export function isTerminalTelegramIncidentJoinState(
  state: TelegramIncidentJoinState,
): state is Extract<TelegramIncidentJoinState, { step: 'joined' | 'cancelled' }> {
  return state.step === 'joined' || state.step === 'cancelled';
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

function getTelegramExternalUserId(update: TelegramUpdateLike): string | null {
  const id = update.message?.from?.id;
  return id == null ? null : String(id);
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

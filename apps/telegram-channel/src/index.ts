import { Bot, type Context } from 'grammy';

import {
  IncidentJoinRequestSchema,
  IncidentRoleSchema,
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

import {
  DisputeReasonSchema,
  OperationalUpdateActionResponseSchema,
  OperationalUpdatePreferenceResponseSchema,
  OperationalUpdatePullResponseSchema,
  type DisputeReason,
  type OperationalUpdate,
  type OperationalUpdateActionRequest,
  type OperationalUpdateActionResponse,
  type OperationalUpdateCorroborateRequest,
  type OperationalUpdateDisputeRequest,
  type OperationalUpdatePreferenceRequest,
  type OperationalUpdatePreferenceResponse,
  type OperationalUpdatePullResponse,
} from '@zona-cero/contracts';

import { getTelegramDisplayName, getTelegramExternalUserId, resolveTelegramCommand } from './telegram-update';
import type { TelegramUpdateLike } from './types';

const defaultCellId = 'connected-telegram';
const defaultLimit = 5;

type TelegramOperationalUpdateAction = 'ack' | 'open' | 'corroborate' | 'dispute';

export type TelegramOperationalUpdatePorts = {
  listUpdates(
    incidentId: string,
    cellId: string,
    input?: { cursor?: string | null; limit?: number; channel?: 'telegram'; externalId?: string; displayName?: string },
  ): Promise<OperationalUpdatePullResponse>;
  ackUpdate(incidentId: string, updateId: string, request: OperationalUpdateActionRequest): Promise<OperationalUpdateActionResponse>;
  openUpdate(incidentId: string, updateId: string, request: OperationalUpdateActionRequest): Promise<OperationalUpdateActionResponse>;
  corroborateUpdate(incidentId: string, updateId: string, request: OperationalUpdateCorroborateRequest): Promise<OperationalUpdateActionResponse>;
  disputeUpdate(incidentId: string, updateId: string, request: OperationalUpdateDisputeRequest): Promise<OperationalUpdateActionResponse>;
  setProactivePreference(incidentId: string, request: OperationalUpdatePreferenceRequest): Promise<OperationalUpdatePreferenceResponse>;
};

export type TelegramOperationalUpdateCommandResult = {
  handled: boolean;
  command: string | null;
  responseText: string;
};

export type TelegramOperationalUpdateHttpPortsOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export async function handleTelegramOperationalUpdateCommand(
  update: TelegramUpdateLike,
  ports: TelegramOperationalUpdatePorts,
): Promise<TelegramOperationalUpdateCommandResult> {
  const command = resolveTelegramCommand(update);
  if (!isOperationalUpdateCommand(command)) {
    return { handled: false, command, responseText: '' };
  }

  const args = readCommandArgs(update);

  if (command === '/updates') {
    return listTelegramOperationalUpdates(command, args, update, ports);
  }

  if (command === '/quietupdates' || command === '/unquietupdates') {
    return setTelegramProactivePreference(command, args, update, ports);
  }

  return actOnTelegramOperationalUpdate(command, args, update, ports);
}

export function createTelegramOperationalUpdateHttpPorts(options: TelegramOperationalUpdateHttpPortsOptions): TelegramOperationalUpdatePorts {
  const requestFetch = options.fetch ?? fetch;
  const baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;

  return {
    async listUpdates(incidentId, cellId, input) {
      const url = new URL(`incidents/${encodeURIComponent(incidentId)}/cells/${encodeURIComponent(cellId)}/updates`, baseUrl);
      if (input?.cursor) url.searchParams.set('cursor', input.cursor);
      if (input?.limit) url.searchParams.set('limit', String(input.limit));
      if (input?.channel) url.searchParams.set('channel', input.channel);
      if (input?.externalId) url.searchParams.set('externalId', input.externalId);
      return OperationalUpdatePullResponseSchema.parse(await requestJson(requestFetch, url));
    },
    async ackUpdate(incidentId, updateId, request) {
      return postOperationalUpdateAction(requestFetch, baseUrl, incidentId, updateId, 'ack', request);
    },
    async openUpdate(incidentId, updateId, request) {
      return postOperationalUpdateAction(requestFetch, baseUrl, incidentId, updateId, 'open', request);
    },
    async corroborateUpdate(incidentId, updateId, request) {
      return postOperationalUpdateAction(requestFetch, baseUrl, incidentId, updateId, 'corroborate', request);
    },
    async disputeUpdate(incidentId, updateId, request) {
      return postOperationalUpdateAction(requestFetch, baseUrl, incidentId, updateId, 'dispute', request);
    },
    async setProactivePreference(incidentId, request) {
      const url = new URL(`incidents/${encodeURIComponent(incidentId)}/updates/preferences`, baseUrl);
      return OperationalUpdatePreferenceResponseSchema.parse(
        await requestJson(requestFetch, url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(request),
        }),
      );
    },
  };
}

async function listTelegramOperationalUpdates(
  command: string,
  args: string[],
  update: TelegramUpdateLike,
  ports: TelegramOperationalUpdatePorts,
): Promise<TelegramOperationalUpdateCommandResult> {
  const incidentId = args[0];
  const cellId = args[1] ?? defaultCellId;
  if (!incidentId) {
    return {
      handled: true,
      command,
      responseText: `Usage: /updates <incidentId> [cellId]\nDefault Telegram cell: ${defaultCellId}.`,
    };
  }

  const externalId = getTelegramExternalUserId(update);
  if (!externalId) {
    return { handled: true, command, responseText: 'Telegram user id is required before listing operational updates.' };
  }

  try {
    const response = await ports.listUpdates(incidentId, cellId, { cursor: null, limit: defaultLimit, channel: 'telegram', externalId, displayName: getTelegramDisplayName(update) });
    return {
      handled: true,
      command,
      responseText: formatOperationalUpdateList(response.updates, incidentId, cellId, response.hasMore),
    };
  } catch {
    return {
      handled: true,
      command,
      responseText: 'Could not load operational updates now. Try again later or use the incident dashboard if available.',
    };
  }
}

async function setTelegramProactivePreference(
  command: string,
  args: string[],
  update: TelegramUpdateLike,
  ports: TelegramOperationalUpdatePorts,
): Promise<TelegramOperationalUpdateCommandResult> {
  const quietProactiveUpdates = command === '/quietupdates';
  const incidentId = args[0];
  if (!incidentId) {
    return {
      handled: true,
      command,
      responseText: `Usage: /${quietProactiveUpdates ? 'quietupdates' : 'unquietupdates'} <incidentId>.`,
    };
  }

  const externalId = getTelegramExternalUserId(update);
  if (!externalId) {
    return { handled: true, command, responseText: 'Telegram user id is required before changing proactive update preferences.' };
  }

  try {
    const response = await ports.setProactivePreference(incidentId, {
      channel: 'telegram',
      externalId,
      quietProactiveUpdates,
    });
    return { handled: true, command, responseText: formatProactivePreferenceResult(response.quietProactiveUpdates) };
  } catch {
    return {
      handled: true,
      command,
      responseText: 'Could not update your proactive alert preference. Check the incident id and that you are a member.',
    };
  }
}

async function actOnTelegramOperationalUpdate(
  command: string,
  args: string[],
  update: TelegramUpdateLike,
  ports: TelegramOperationalUpdatePorts,
): Promise<TelegramOperationalUpdateCommandResult> {
  const action = command.slice(1) as TelegramOperationalUpdateAction;
  const [incidentId, updateId, actionValue] = args;
  if (!incidentId || !updateId) {
    return {
      handled: true,
      command,
      responseText: `Usage: /${action} <incidentId> <updateId>${action === 'corroborate' ? ' [confidence 0-1]' : ''}${action === 'dispute' ? ' [reason]' : ''}.`,
    };
  }

  const externalId = getTelegramExternalUserId(update);
  if (!externalId) {
    return { handled: true, command, responseText: 'Telegram user id is required before acting on operational updates.' };
  }

  const baseRequest = buildTelegramOperationalUpdateActionRequest(action, incidentId, updateId, externalId, getTelegramDisplayName(update));

  try {
    const response = await submitOperationalUpdateAction(ports, action, incidentId, updateId, actionValue, baseRequest);
    return { handled: true, command, responseText: formatOperationalUpdateActionResult(action, response) };
  } catch {
    return {
      handled: true,
      command,
      responseText: 'Action was not accepted. Check incident/update ids, membership, and whether this update supports the action.',
    };
  }
}

function submitOperationalUpdateAction(
  ports: TelegramOperationalUpdatePorts,
  action: TelegramOperationalUpdateAction,
  incidentId: string,
  updateId: string,
  actionValue: string | undefined,
  baseRequest: OperationalUpdateActionRequest,
): Promise<OperationalUpdateActionResponse> {
  if (action === 'ack') return ports.ackUpdate(incidentId, updateId, baseRequest);
  if (action === 'open') return ports.openUpdate(incidentId, updateId, baseRequest);
  if (action === 'corroborate') {
    const confidence = actionValue ? Number(actionValue) : undefined;
    return ports.corroborateUpdate(incidentId, updateId, {
      ...baseRequest,
      ...(Number.isFinite(confidence) ? { confidence } : {}),
    });
  }

  return ports.disputeUpdate(incidentId, updateId, {
    ...baseRequest,
    reason: parseDisputeReason(actionValue),
  });
}

function buildTelegramOperationalUpdateActionRequest(
  action: TelegramOperationalUpdateAction,
  incidentId: string,
  updateId: string,
  externalId: string,
  displayName?: string,
): OperationalUpdateActionRequest {
  return {
    channel: 'telegram',
    externalId,
    displayName,
    idempotencyKey: `telegram:${action}:${incidentId}:${updateId}:${externalId}`,
  };
}

function formatOperationalUpdateList(updates: OperationalUpdate[], incidentId: string, cellId: string, hasMore: boolean): string {
  if (updates.length === 0) {
    return `No operational updates for ${incidentId}/${cellId}.\nAuthority limit: absence of Telegram updates is not proof the incident is safe.`;
  }

  const lines = updates.map((update, index) => {
    const confidence = readMetadataString(update.metadata, 'confidence') ?? 'unknown';
    const freshness = readMetadataString(update.metadata, 'freshness') ?? readMetadataString(update.metadata, 'status') ?? 'unknown';
    const sourceRef = update.source.entityId ? ` Source ref: ${update.source.entityId}.` : '';
    const whyLine = formatReasonCode(update.reasonCode);
    return [
      `${index + 1}. ${formatUrgency(update.urgency)} ${update.title}`,
      `Reason: ${update.summary}`,
      ...(whyLine ? [`Why you: ${whyLine}`] : []),
      `Severity: ${update.urgency}. Confidence: ${confidence}. Freshness: ${freshness}.${sourceRef}`,
      `Actions: /ack ${update.incidentId} ${update.updateId} · /open ${update.incidentId} ${update.updateId} · /corroborate ${update.incidentId} ${update.updateId} 0.7 · /dispute ${update.incidentId} ${update.updateId} context_mismatch`,
    ].join('\n');
  });

  return [
    `Operational updates for ${incidentId}/${cellId}:`,
    ...lines,
    hasMore ? 'More updates exist; repeat with the next cursor in a richer client.' : null,
    'Limits: ACK is not rescue. Corroboration adds context only; it does not grant authority. Social trust does not grant sensitive permissions.',
  ].filter(Boolean).join('\n\n');
}

function formatOperationalUpdateActionResult(action: TelegramOperationalUpdateAction, response: OperationalUpdateActionResponse): string {
  const trustSummary = response.trustState
    ? ` Trust status: ${response.trustState.status}; signals: ${response.trustState.signalCount}; disputes: ${response.trustState.disputeCount}.`
    : '';
  const actionText = response.action.idempotent ? `${action} already recorded` : `${action} recorded`;
  const authorityLimit = action === 'ack'
    ? 'ACK is not rescue and does not assign responders.'
    : action === 'corroborate'
      ? 'Corroboration adds context only; it does not grant authority or sensitive permissions.'
      : action === 'dispute'
        ? 'Dispute asks for review; it does not remove the update by itself.'
        : 'Open records intent to view; it does not grant sensitive permissions.';

  return `${actionText} for ${response.update.updateId}.${trustSummary}\n${authorityLimit}`;
}

// Honest copy for the proactive-match opt-out. Quieting only silences proactive match alerts;
// SOS/critical and the cell feed keep flowing. /unquietupdates reverses it.
function formatProactivePreferenceResult(quietProactiveUpdates: boolean): string {
  if (quietProactiveUpdates) {
    return 'Silenciadas las alertas proactivas de match. Seguirás viendo SOS y el feed de tu celda. Usa /unquietupdates para reactivarlas.';
  }
  return 'Reactivadas las alertas proactivas de match. Volverás a recibir posibles coincidencias de recursos. Usa /quietupdates para silenciarlas de nuevo.';
}

function formatUrgency(urgency: OperationalUpdate['urgency']): string {
  if (urgency === 'critical') return '🚨 CRITICAL';
  if (urgency === 'high') return '⚠️ HIGH';
  return urgency.toUpperCase();
}

// Honest, non-authoritative "why you got this" line for a targeted operational update.
// A possible match is never a reservation, assignment, or authority to move. An absent
// reasonCode simply hides this line; it never breaks the list.
function formatReasonCode(reasonCode: OperationalUpdate['reasonCode']): string | null {
  if (!reasonCode) return null;
  if (reasonCode === 'resource.match.offer_for_open_need') {
    return 'it matches a resource you requested. Possible match, not a reservation; coordinate before you move.';
  }
  if (reasonCode === 'resource.match.need_for_open_offer') {
    return 'it matches a resource you offered. Possible match, not an official assignment.';
  }
  if (reasonCode === 'resource.report.cell_broadcast') {
    return 'general update for your cell.';
  }
  return null;
}

function parseDisputeReason(value: string | undefined): DisputeReason {
  const parsed = DisputeReasonSchema.safeParse(value);
  return parsed.success ? parsed.data : 'context_mismatch';
}

function readMetadataString(metadata: OperationalUpdate['metadata'], key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function isOperationalUpdateCommand(command: string | null): command is '/updates' | '/ack' | '/open' | '/corroborate' | '/dispute' | '/quietupdates' | '/unquietupdates' {
  return (
    command === '/updates' ||
    command === '/ack' ||
    command === '/open' ||
    command === '/corroborate' ||
    command === '/dispute' ||
    command === '/quietupdates' ||
    command === '/unquietupdates'
  );
}

function readCommandArgs(update: TelegramUpdateLike): string[] {
  const text = update.message?.text?.trim();
  if (!text) return [];
  return text.split(/\s+/).slice(1);
}

async function postOperationalUpdateAction(
  requestFetch: typeof fetch,
  baseUrl: string,
  incidentId: string,
  updateId: string,
  action: TelegramOperationalUpdateAction,
  request: OperationalUpdateActionRequest | OperationalUpdateCorroborateRequest | OperationalUpdateDisputeRequest,
): Promise<OperationalUpdateActionResponse> {
  const url = new URL(`incidents/${encodeURIComponent(incidentId)}/updates/${encodeURIComponent(updateId)}/${action}`, baseUrl);
  return OperationalUpdateActionResponseSchema.parse(
    await requestJson(requestFetch, url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    }),
  );
}

async function requestJson(requestFetch: typeof fetch, url: URL, init?: RequestInit): Promise<unknown> {
  const response = await requestFetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

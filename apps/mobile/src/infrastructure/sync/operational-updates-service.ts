import {
  OperationalUpdateActionResponseSchema,
  OperationalUpdateLinkResponseSchema,
  OperationalUpdatePreferenceResponseSchema,
  OperationalUpdatePullResponseSchema,
  type Channel,
  type OperationalUpdate,
  type OperationalUpdateActionRequest,
  type OperationalUpdateActionResponse,
  type OperationalUpdateActionType,
  type OperationalUpdateDeliveryStatus,
  type OperationalUpdateDisputeRequest,
  type OperationalUpdateLinkResponse,
  type OperationalUpdatePreferenceResponse,
  type OperationalUpdatePullResponse,
} from '@zona-cero/contracts';
import type { LocalOperationDatabase, OperationalUpdateActionLocalDocument, OperationalUpdateLocalView } from '@/infrastructure/local-db/local-db';

export type OperationalUpdateListInput = {
  incidentId: string;
  cellId: string;
  cursor?: string | null;
  limit?: number;
};

export type OperationalUpdateActionInput = {
  incidentId: string;
  updateId: string;
  actionType: OperationalUpdateActionType;
  request: OperationalUpdateActionRequest | OperationalUpdateDisputeRequest;
};

export type OperationalUpdatePreferenceInput = {
  incidentId: string;
  quietProactiveUpdates: boolean;
};

export type OperationalUpdatesClient = {
  list(input: OperationalUpdateListInput): Promise<OperationalUpdatePullResponse>;
  sendAction(input: OperationalUpdateActionInput): Promise<OperationalUpdateActionResponse | OperationalUpdateLinkResponse>;
  // Slice 21.1 Fase 2 — opt-out/quieting. Optional so degraded/local-only implementations
  // (e.g. the "unavailable" service on liveOperations) do not need a network method.
  setPreference?(input: OperationalUpdatePreferenceInput): Promise<OperationalUpdatePreferenceResponse>;
};

export type CreateHttpOperationalUpdatesClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>);
  channel?: Channel;
  actorExternalId: string;
};

export type OperationalUpdatesService = {
  syncUpdates(input: OperationalUpdateListInput): Promise<OperationalUpdatesSyncResult>;
  performAction(input: PerformOperationalUpdateActionInput): Promise<OperationalUpdateActionLocalDocument>;
};

export type OperationalUpdatesSyncResult = {
  pulled: number;
  unread: number;
  expired: number;
  queuedActions: number;
  failedActions: number;
  cursor: string | null;
  hasMore: boolean;
};

export type PerformOperationalUpdateActionInput = {
  incidentId: string;
  cellId: string;
  updateId: string;
  actionType: Exclude<OperationalUpdateActionType, 'link'>;
  note?: string;
  reason?: OperationalUpdateDisputeRequest['reason'];
  networkAvailable?: boolean;
};

export type CreateOperationalUpdatesServiceOptions = {
  database: LocalOperationDatabase;
  client?: OperationalUpdatesClient;
  actorExternalId?: string;
  channel?: Channel;
  clock?: () => string;
};

export function createHttpOperationalUpdatesClient({ baseUrl, fetchImpl = fetch, headers, channel = 'mobile', actorExternalId }: CreateHttpOperationalUpdatesClientOptions): OperationalUpdatesClient {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  return {
    async list(input) {
      const params = new URLSearchParams();
      if (input.cursor) {
        params.set('cursor', input.cursor);
      }
      if (input.limit) {
        params.set('limit', String(input.limit));
      }
      params.set('channel', channel);
      params.set('externalId', actorExternalId);

      const query = params.toString();
      const response = await fetchImpl(`${normalizedBaseUrl}${updatesScopePath(input)}/updates${query ? `?${query}` : ''}`, {
        method: 'GET',
        headers: await resolveHeaders(headers),
      });
      const body = await readJsonResponse(response, 'Operational updates request failed');

      return OperationalUpdatePullResponseSchema.parse(body);
    },

    async sendAction(input) {
      const response = await fetchImpl(`${normalizedBaseUrl}${updateActionPath(input)}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(await resolveHeaders(headers)),
        },
        body: JSON.stringify(input.request),
      });
      const body = await readJsonResponse(response, 'Operational update action failed');

      return input.actionType === 'link'
        ? OperationalUpdateLinkResponseSchema.parse(body)
        : OperationalUpdateActionResponseSchema.parse(body);
    },

    async setPreference(input) {
      const response = await fetchImpl(`${normalizedBaseUrl}${updatePreferencePath(input)}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(await resolveHeaders(headers)),
        },
        body: JSON.stringify({ channel, externalId: actorExternalId, quietProactiveUpdates: input.quietProactiveUpdates }),
      });
      const body = await readJsonResponse(response, 'Operational update preference update failed');

      return OperationalUpdatePreferenceResponseSchema.parse(body);
    },
  };
}

export function createOperationalUpdatesService({ database, client, actorExternalId, channel = 'mobile', clock = () => new Date().toISOString() }: CreateOperationalUpdatesServiceOptions): OperationalUpdatesService {
  return {
    async syncUpdates(input) {
      const queuedActions = await flushPendingUpdateActions({ database, client, input, clock });
      const pulled = client ? await client.list(input) : { updates: [], cursor: input.cursor ?? null, hasMore: false };

      await Promise.all(pulled.updates.map((update) => upsertOperationalUpdateView(database, update, clock())));

      const updates = await database.views.operationalUpdates.findByIncident(input.incidentId);
      const scopedUpdates = updates.filter((update) => update.cellId === input.cellId);

      return {
        pulled: pulled.updates.length,
        unread: scopedUpdates.filter((update) => update.readState === 'unread' && update.lifecycleState !== 'expired').length,
        expired: scopedUpdates.filter((update) => update.lifecycleState === 'expired').length,
        queuedActions: queuedActions.confirmed,
        failedActions: queuedActions.failed,
        cursor: pulled.cursor,
        hasMore: pulled.hasMore,
      };
    },

    async performAction(input) {
      if (!actorExternalId) {
        throw new Error('Operational update actor identity is required before sending mobile actions.');
      }

      const occurredAt = clock();
      const localAction = createLocalAction({ input, channel, actorExternalId, occurredAt });
      await database.operationalUpdateActions.upsert(localAction);
      await applyLocalActionState(database, localAction, occurredAt);

      if (!input.networkAvailable || !client) {
        return localAction;
      }

      return sendQueuedAction({ database, client, action: localAction, clock });
    },
  };
}

async function flushPendingUpdateActions(input: {
  database: LocalOperationDatabase;
  client: OperationalUpdatesClient | undefined;
  input: OperationalUpdateListInput;
  clock: () => string;
}): Promise<{ confirmed: number; failed: number }> {
  if (!input.client) {
    return { confirmed: 0, failed: 0 };
  }

  const actions = (await input.database.operationalUpdateActions.findByIncident(input.input.incidentId))
    .filter((action) => action.cellId === input.input.cellId)
    .filter((action) => action.syncState === 'pending' || action.syncState === 'sent')
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  let confirmed = 0;
  let failed = 0;

  for (const action of actions) {
    const result = await sendQueuedAction({ database: input.database, client: input.client, action, clock: input.clock }).catch(() => null);
    if (result?.syncState === 'confirmed') {
      confirmed += 1;
    } else {
      failed += 1;
    }
  }

  return { confirmed, failed };
}

async function sendQueuedAction(input: {
  database: LocalOperationDatabase;
  client: OperationalUpdatesClient;
  action: OperationalUpdateActionLocalDocument;
  clock: () => string;
}): Promise<OperationalUpdateActionLocalDocument> {
  const sentAt = input.clock();
  await input.database.operationalUpdateActions.upsert({ ...input.action, syncState: 'sent', lastAttemptAt: sentAt, errorCode: undefined, errorMessage: undefined });

  try {
    const response = await input.client.sendAction({
      incidentId: input.action.incidentId,
      updateId: input.action.updateId,
      actionType: input.action.actionType,
      request: input.action.request,
    });
    const confirmedAt = response.action.createdAt;
    const confirmed = {
      ...input.action,
      syncState: 'confirmed' as const,
      receiptId: response.action.actionId,
      receiptCreatedAt: confirmedAt,
      lastAttemptAt: sentAt,
      errorCode: undefined,
      errorMessage: undefined,
    };

    await input.database.operationalUpdateActions.upsert(confirmed);
    await upsertOperationalUpdateView(input.database, response.update, confirmedAt);
    await applyConfirmedActionState(input.database, confirmed, confirmedAt);

    return confirmed;
  } catch (error) {
    const failed = {
      ...input.action,
      syncState: classifyActionError(error),
      lastAttemptAt: sentAt,
      errorCode: 'action_sync_failed',
      errorMessage: error instanceof Error ? error.message : 'Operational update action failed',
    } satisfies OperationalUpdateActionLocalDocument;

    await input.database.operationalUpdateActions.upsert(failed);
    await applyFailedActionState(input.database, failed, sentAt);

    throw error;
  }
}

async function upsertOperationalUpdateView(database: LocalOperationDatabase, update: OperationalUpdate, now: string): Promise<void> {
  const existing = await database.views.operationalUpdates.findById(update.updateId);
  const lifecycleState = resolveLifecycleState(update, now);

  await database.views.operationalUpdates.upsert({
    updateId: update.updateId,
    incidentId: update.incidentId,
    cellId: update.cellId,
    type: update.type,
    reasonCode: existing?.reasonCode ?? update.reasonCode,
    urgency: update.urgency,
    title: update.title,
    summary: update.summary,
    body: update.body,
    source: update.source,
    subject: update.subject,
    actions: update.actions,
    delivery: update.delivery,
    metadata: update.metadata,
    createdAt: update.createdAt,
    updatedAt: update.updatedAt,
    expiresAt: update.expiresAt,
    readState: mergeReadState(existing?.readState, update.delivery?.status),
    lifecycleState,
    ackState: mergeAckState(existing?.ackState, update.delivery?.status),
    actionState: existing?.actionState ?? 'idle',
    openedAt: existing?.openedAt,
    readAt: existing?.readAt ?? update.delivery?.readAt,
    ackedAt: existing?.ackedAt ?? update.delivery?.ackedAt,
    pendingActionType: existing?.pendingActionType,
    lastActionType: existing?.lastActionType,
    lastActionError: existing?.lastActionError,
    localUpdatedAt: existing?.localUpdatedAt ?? now,
  });
}

async function applyLocalActionState(database: LocalOperationDatabase, action: OperationalUpdateActionLocalDocument, now: string): Promise<void> {
  const update = await database.views.operationalUpdates.findById(action.updateId);
  if (!update) {
    return;
  }

  await database.views.operationalUpdates.upsert({
    ...update,
    readState: action.actionType === 'read' || action.actionType === 'open' || action.actionType === 'ack' ? 'read' : update.readState,
    ackState: action.actionType === 'ack' ? 'pending' : update.ackState,
    actionState: 'pending',
    openedAt: action.actionType === 'open' ? now : update.openedAt,
    readAt: action.actionType === 'read' || action.actionType === 'open' || action.actionType === 'ack' ? now : update.readAt,
    pendingActionType: action.actionType,
    lastActionType: action.actionType,
    lastActionError: undefined,
    localUpdatedAt: now,
  });
}

async function applyConfirmedActionState(database: LocalOperationDatabase, action: OperationalUpdateActionLocalDocument, now: string): Promise<void> {
  const update = await database.views.operationalUpdates.findById(action.updateId);
  if (!update) {
    return;
  }

  await database.views.operationalUpdates.upsert({
    ...update,
    readState: action.actionType === 'read' || action.actionType === 'open' || action.actionType === 'ack' ? 'read' : update.readState,
    ackState: action.actionType === 'ack' ? 'confirmed' : update.ackState,
    actionState: 'confirmed',
    openedAt: action.actionType === 'open' ? action.request.occurredAt ?? now : update.openedAt,
    readAt: action.actionType === 'read' || action.actionType === 'open' || action.actionType === 'ack' ? action.request.occurredAt ?? now : update.readAt,
    ackedAt: action.actionType === 'ack' ? action.request.occurredAt ?? now : update.ackedAt,
    pendingActionType: undefined,
    lastActionType: action.actionType,
    lastActionError: undefined,
    localUpdatedAt: now,
  });
}

async function applyFailedActionState(database: LocalOperationDatabase, action: OperationalUpdateActionLocalDocument, now: string): Promise<void> {
  const update = await database.views.operationalUpdates.findById(action.updateId);
  if (!update) {
    return;
  }

  await database.views.operationalUpdates.upsert({
    ...update,
    ackState: action.actionType === 'ack' && action.syncState === 'conflict' ? 'conflict' : update.ackState,
    actionState: action.syncState === 'conflict' ? 'conflict' : 'pending',
    pendingActionType: action.syncState === 'pending' ? action.actionType : update.pendingActionType,
    lastActionType: action.actionType,
    lastActionError: action.errorMessage,
    localUpdatedAt: now,
  });
}

function createLocalAction(input: {
  input: PerformOperationalUpdateActionInput;
  channel: Channel;
  actorExternalId: string;
  occurredAt: string;
}): OperationalUpdateActionLocalDocument {
  const request = {
    channel: input.channel,
    externalId: input.actorExternalId,
    idempotencyKey: `${input.input.incidentId}:${input.input.updateId}:${input.input.actionType}:${input.occurredAt}`,
    occurredAt: input.occurredAt,
    ...(input.input.note ? { note: input.input.note } : {}),
    ...(input.input.actionType === 'dispute' ? { reason: input.input.reason ?? 'context_mismatch' } : {}),
  } satisfies OperationalUpdateActionRequest | OperationalUpdateDisputeRequest;

  return {
    localActionId: request.idempotencyKey,
    updateId: input.input.updateId,
    incidentId: input.input.incidentId,
    cellId: input.input.cellId,
    actionType: input.input.actionType,
    request,
    syncState: 'pending',
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
}

function updatesScopePath(input: { incidentId: string; cellId: string }): string {
  return `/incidents/${encodeURIComponent(input.incidentId)}/cells/${encodeURIComponent(input.cellId)}`;
}

function updateActionPath(input: { incidentId: string; updateId: string; actionType: OperationalUpdateActionType }): string {
  const segment = input.actionType === 'link' ? 'links' : input.actionType;

  return `/incidents/${encodeURIComponent(input.incidentId)}/updates/${encodeURIComponent(input.updateId)}/${segment}`;
}

function updatePreferencePath(input: { incidentId: string }): string {
  return `/incidents/${encodeURIComponent(input.incidentId)}/updates/preferences`;
}

function resolveLifecycleState(update: OperationalUpdate, now: string): OperationalUpdateLocalView['lifecycleState'] {
  return update.expiresAt && Date.parse(update.expiresAt) <= Date.parse(now) ? 'expired' : 'active';
}

// Read/ack state advances monotonically: local optimistic progress is preserved, while
// server-side delivery status (e.g. an ACK made from another channel) is still adopted so
// the device does not stay stale after subsequent pulls.
function mergeReadState(
  local: OperationalUpdateLocalView['readState'] | undefined,
  deliveryStatus: OperationalUpdateDeliveryStatus | undefined,
): OperationalUpdateLocalView['readState'] {
  if (local === 'read' || deliveryStatus === 'read' || deliveryStatus === 'acked') {
    return 'read';
  }

  return 'unread';
}

function mergeAckState(
  local: OperationalUpdateLocalView['ackState'] | undefined,
  deliveryStatus: OperationalUpdateDeliveryStatus | undefined,
): OperationalUpdateLocalView['ackState'] {
  if (local === 'conflict' || local === 'confirmed') {
    return local;
  }

  if (deliveryStatus === 'acked') {
    return 'confirmed';
  }

  return local ?? 'none';
}

function classifyActionError(error: unknown): OperationalUpdateActionLocalDocument['syncState'] {
  if (!(error instanceof Error)) {
    return 'pending';
  }

  const status = Number(error.message.match(/^HTTP (\d{3})/)?.[1]);
  if (!Number.isFinite(status) || status < 400 || status >= 500) {
    return 'pending';
  }

  // Transient client errors (timeout / rate limit) must stay pending so the queued
  // action is retried; only genuinely permanent 4xx responses become conflicts.
  const isTransient = status === 408 || status === 429;

  return isTransient ? 'pending' : 'conflict';
}

async function resolveHeaders(headers: CreateHttpOperationalUpdatesClientOptions['headers']): Promise<HeadersInit> {
  return typeof headers === 'function' ? headers() : headers ?? {};
}

async function readJsonResponse(response: Response, fallbackMessage: string): Promise<unknown> {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : fallbackMessage;
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return body;
}

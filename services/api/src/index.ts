import { Hono } from 'hono';
import { cors } from 'hono/cors';

import {
  HealthResponseSchema,
  IncidentConfigResponseSchema,
  IncidentJoinRequestSchema,
  IncidentJoinResponseSchema,
  IncidentListResponseSchema,
  PendingSignedOperationSchema,
  type Channel,
  type ContractErrorCode,
  type IncidentConfigResponse,
  type IncidentJoinResponse,
  type IncidentRole,
  type IncidentSummary,
  type PermissionSnapshot,
  type PendingSignedOperation,
  type SyncPushResponse,
  TelegramWebhookResultSchema,
  WorkCenterConnectedCreateRequestSchema,
  type WorkCenterConnectedCreateRequest,
  WorkCenterCreatePayloadSchema,
  WorkCenterCreateResponseSchema,
  WorkCenterDetailResponseSchema,
  WorkCenterListResponseSchema,
  type WorkCenterCreatePayload,
  type WorkCenterCreateResponse,
  type WorkCenterDetail,
  type WorkCenterPriority,
  type WorkCenterSignalType,
  type WorkCenterSummary,
} from '@zona-cero/contracts';
import { deriveWorkCenterState, type WorkCenterSignalInput } from '@zona-cero/domain';
import {
  handleTelegramIncidentJoinFlow,
  handleTelegramWorkCenterReportFlow,
  isTerminalTelegramIncidentJoinState,
  isTerminalTelegramWorkCenterReportState,
  resolveTelegramCommand,
  safeParseTelegramIncidentJoinState,
  safeParseTelegramWorkCenterReportState,
  type TelegramIncidentJoinPorts,
  type TelegramIncidentJoinState,
  type TelegramUpdateLike,
  type TelegramWorkCenterReportPorts,
  type TelegramWorkCenterReportState,
} from '@zona-cero/telegram-channel';

export class IncidentCellObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(): Promise<Response> {
    return Response.json({ ok: true, storage: 'durable-object-sqlite', id: this.state.id.toString() });
  }
}

export const app = new Hono<{ Bindings: Env }>();

const roles: IncidentRole[] = ['volunteer', 'coordinator', 'logistics', 'medical'];
const channels: Channel[] = ['telegram', 'mobile', 'web-ui'];
const telegramConversationStateTtlMs = 30 * 60 * 1000;

const permissionSnapshots: IncidentConfigResponse['permissionSnapshots'] = {
  volunteer: {
    canReadIncident: true,
    canJoinIncident: true,
    canManageIncident: false,
    canManageLogistics: false,
    canManageMedical: false,
  },
  coordinator: {
    canReadIncident: true,
    canJoinIncident: true,
    canManageIncident: true,
    canManageLogistics: true,
    canManageMedical: true,
  },
  logistics: {
    canReadIncident: true,
    canJoinIncident: true,
    canManageIncident: false,
    canManageLogistics: true,
    canManageMedical: false,
  },
  medical: {
    canReadIncident: true,
    canJoinIncident: true,
    canManageIncident: false,
    canManageLogistics: false,
    canManageMedical: true,
  },
};

app.use('*', cors());

app.get('/health', (c) => {
  return c.json(
    HealthResponseSchema.parse({
      service: 'zona-cero-api',
      ok: true,
      version: c.env.API_VERSION ?? '0.0.0-boilerplate',
    }),
  );
});

app.get('/incidents', async (c) => {
  const results = await listIncidents(c.env.DB);

  return c.json(IncidentListResponseSchema.parse({ incidents: results }));
});

app.get('/incidents/:incidentId/config', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));

  if (!incident) {
    return c.json({ error: 'incident_not_found' }, 404);
  }

  return c.json(IncidentConfigResponseSchema.parse({ incident, roles, channels, permissionSnapshots }));
});

app.post('/incidents/:incidentId/join', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));

  if (!incident) {
    return c.json({ error: 'incident_not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = IncidentJoinRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const response = await joinIncident(c.env.DB, incident, parsed.data);
  return c.json(IncidentJoinResponseSchema.parse(response));
});

app.post('/incidents/:incidentId/work-centers', async (c) => {
  const startedAt = Date.now();
  const incidentId = c.req.param('incidentId');
  const incident = await findIncident(c.env.DB, incidentId);

  if (!incident) {
    logOperationEvent({ channel: null, opType: 'work_center.create', opId: null, entityId: null, result: 'rejected', errorCode: 'not_found', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = WorkCenterConnectedCreateRequestSchema.safeParse(body);

  if (!parsed.success) {
    logOperationEvent({ channel: null, opType: 'work_center.create', opId: null, entityId: null, result: 'rejected', errorCode: 'invalid_payload', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const membership = await findIncidentMembershipForChannel(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);

  if (!membership) {
    logOperationEvent({
      channel: parsed.data.channel,
      opType: 'work_center.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'permission_denied',
      latencyMs: Date.now() - startedAt,
    });
    return c.json({ error: 'permission_denied' }, 403);
  }

  const response = await createConnectedWorkCenter(c.env.DB, incident, parsed.data, membership);
  logOperationEvent({
    channel: parsed.data.channel,
    opType: 'work_center.create',
    opId: null,
    entityId: response.workCenter.workCenterId,
    result: 'accepted',
    errorCode: null,
    latencyMs: Date.now() - startedAt,
  });

  return c.json(WorkCenterCreateResponseSchema.parse(response));
});

app.get('/incidents/:incidentId/work-centers', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));

  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  return c.json(WorkCenterListResponseSchema.parse({ workCenters: await listWorkCenters(c.env.DB, incident.incidentId) }));
});

app.get('/incidents/:incidentId/work-centers/:workCenterId', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));

  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  const workCenter = await getWorkCenterDetail(c.env.DB, incident.incidentId, c.req.param('workCenterId'));

  if (!workCenter) {
    return c.json({ error: 'not_found' }, 404);
  }

  return c.json(WorkCenterDetailResponseSchema.parse({ workCenter }));
});

app.post('/sync/push', async (c) => {
  const startedAt = Date.now();
  const body = await c.req.json().catch(() => null);
  const parsed = parseSyncPushBody(body);

  if (!parsed.success) {
    logOperationEvent({ channel: null, opType: null, opId: null, entityId: null, result: 'rejected', errorCode: 'invalid_payload', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const response: SyncPushResponse = {
    results: [],
  };

  for (const rawOperation of parsed.data.operations) {
    const result = await handleSyncPushOperation(c.env.DB, rawOperation, startedAt);
    response.results.push(result);
  }

  return c.json(response);
});

app.get('/sync/pull', (c) => {
  return c.json({ operations: [], cursor: c.req.query('cursor') ?? null });
});

app.post('/telegram/webhook', async (c) => {
  const update = (await c.req.json().catch(() => ({}))) as TelegramUpdateLike;
  const command = resolveTelegramCommand(update);
  const responseText = await handleTelegramConversation(c.env.DB, update, command);

  return c.json(
    TelegramWebhookResultSchema.parse({
      accepted: true,
      command,
      responseText,
    }),
  );
});

async function findIncident(db: D1Database, incidentId: string): Promise<IncidentSummary | null> {
  return db
    .prepare('SELECT incident_id AS incidentId, name, status, starts_at AS startsAt, location_name AS locationName FROM incidents WHERE incident_id = ?')
    .bind(incidentId)
    .first<IncidentSummary>();
}

async function listIncidents(db: D1Database): Promise<IncidentSummary[]> {
  const { results } = await db
    .prepare(
      'SELECT incident_id AS incidentId, name, status, starts_at AS startsAt, location_name AS locationName FROM incidents ORDER BY starts_at DESC',
    )
    .all<IncidentSummary>();

  return results;
}

type SyncPushBodyParseResult =
  | { success: true; data: { operations: unknown[]; cursor?: string | null } }
  | { success: false; error: { issues: unknown[] } };

type SyncPushOperationResult = SyncPushResponse['results'][number];

type IncidentMembershipLookup = {
  channelIdentityId: string;
  incidentMembershipId: string;
};

type WorkCenterRow = {
  workCenterId: string;
  incidentId: string;
  cellId: string;
  name: string;
  centerType: string | null;
  description: string | null;
  priority: WorkCenterPriority;
  initialNeed: string | null;
  surplus: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceChannel: Channel | null;
  status: WorkCenterSummary['status'];
  activationState: WorkCenterSummary['activationState'];
  freshness: WorkCenterSummary['freshness'];
  confidence: WorkCenterSummary['confidence'];
  risk: WorkCenterSummary['risk'];
  signalCount: number;
  corroboratingSignalCount: number;
  createdAt: string;
  updatedAt: string;
};

type WorkCenterSignalRow = {
  signalId: string;
  signalType: WorkCenterSignalType;
  sourceChannel: Channel;
  sourceId: string;
  createdAt: string;
};

function parseSyncPushBody(body: unknown): SyncPushBodyParseResult {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { operations?: unknown }).operations)) {
    return { success: false, error: { issues: [{ message: 'operations must be an array' }] } };
  }

  const cursor = (body as { cursor?: unknown }).cursor;

  if (cursor !== undefined && cursor !== null && typeof cursor !== 'string') {
    return { success: false, error: { issues: [{ message: 'cursor must be a string or null' }] } };
  }

  return { success: true, data: { operations: (body as { operations: unknown[] }).operations, cursor } };
}

async function handleSyncPushOperation(db: D1Database, rawOperation: unknown, startedAt: number): Promise<SyncPushOperationResult> {
  const opId = readStringProperty(rawOperation, 'opId');
  const opType = readStringProperty(rawOperation, 'opType');
  const entityId = readStringProperty(rawOperation, 'entityId');

  if (!rawOperation || typeof rawOperation !== 'object' || (rawOperation as { version?: unknown }).version !== 1) {
    logOperationEvent({
      channel: 'mobile',
      opType,
      opId,
      entityId,
      result: 'rejected',
      errorCode: 'invalid_operation_version',
      latencyMs: Date.now() - startedAt,
    });
    return { status: 'rejected', ...(opId ? { opId } : {}), code: 'invalid_operation_version' };
  }

  const parsed = PendingSignedOperationSchema.safeParse(rawOperation);

  if (!parsed.success) {
    logOperationEvent({ channel: 'mobile', opType, opId, entityId, result: 'rejected', errorCode: 'invalid_payload', latencyMs: Date.now() - startedAt });
    return { status: 'rejected', ...(opId ? { opId } : {}), code: 'invalid_payload' };
  }

  if (parsed.data.opType !== 'work_center.create') {
    logOperationEvent({
      channel: 'mobile',
      opType: parsed.data.opType,
      opId: parsed.data.opId,
      entityId: parsed.data.entityId,
      result: 'accepted',
      errorCode: null,
      latencyMs: Date.now() - startedAt,
    });
    return { opId: parsed.data.opId, status: 'accepted' };
  }

  const payload = WorkCenterCreatePayloadSchema.safeParse(parsed.data.payload);

  if (!payload.success) {
    logOperationEvent({
      channel: 'mobile',
      opType: parsed.data.opType,
      opId: parsed.data.opId,
      entityId: parsed.data.entityId,
      result: 'rejected',
      errorCode: 'invalid_payload',
      latencyMs: Date.now() - startedAt,
    });
    return { opId: parsed.data.opId, status: 'rejected', code: 'invalid_payload' };
  }

  const incident = await findIncident(db, parsed.data.incidentId);

  if (!incident) {
    logOperationEvent({
      channel: 'mobile',
      opType: parsed.data.opType,
      opId: parsed.data.opId,
      entityId: parsed.data.entityId,
      result: 'rejected',
      errorCode: 'not_found',
      latencyMs: Date.now() - startedAt,
    });
    return { opId: parsed.data.opId, status: 'rejected', code: 'not_found' };
  }

  const payloadHash = await hashJson({ operation: parsed.data });
  const existingOperation = await db
    .prepare('SELECT payload_hash AS payloadHash, status FROM sync_operations WHERE op_id = ?')
    .bind(parsed.data.opId)
    .first<{ payloadHash: string; status: string }>();

  if (existingOperation) {
    const result = existingOperation.payloadHash === payloadHash && existingOperation.status === 'accepted' ? 'accepted' : 'rejected';
    const errorCode = result === 'accepted' ? null : 'operation_conflict';
    logOperationEvent({
      channel: 'mobile',
      opType: parsed.data.opType,
      opId: parsed.data.opId,
      entityId: parsed.data.entityId,
      result,
      errorCode,
      latencyMs: Date.now() - startedAt,
    });
    return result === 'accepted' ? { opId: parsed.data.opId, status: 'accepted' } : { opId: parsed.data.opId, status: 'rejected', code: 'operation_conflict' };
  }

  const existingWorkCenter = await db
    .prepare('SELECT source_operation_id AS sourceOperationId FROM work_centers WHERE work_center_id = ?')
    .bind(parsed.data.entityId)
    .first<{ sourceOperationId: string | null }>();

  if (existingWorkCenter && existingWorkCenter.sourceOperationId !== parsed.data.opId) {
    await recordSyncOperation(db, parsed.data, payloadHash, 'rejected');
    logOperationEvent({
      channel: 'mobile',
      opType: parsed.data.opType,
      opId: parsed.data.opId,
      entityId: parsed.data.entityId,
      result: 'rejected',
      errorCode: 'operation_conflict',
      latencyMs: Date.now() - startedAt,
    });
    return { opId: parsed.data.opId, status: 'rejected', code: 'operation_conflict' };
  }

  await materializeWorkCenterCreateOperation(db, incident, parsed.data, payload.data);
  await recordSyncOperation(db, parsed.data, payloadHash, 'accepted');
  logOperationEvent({
    channel: 'mobile',
    opType: parsed.data.opType,
    opId: parsed.data.opId,
    entityId: parsed.data.entityId,
    result: 'accepted',
    errorCode: null,
    latencyMs: Date.now() - startedAt,
  });

  return { opId: parsed.data.opId, status: 'accepted' };
}

async function materializeWorkCenterCreateOperation(
  db: D1Database,
  incident: IncidentSummary,
  operation: PendingSignedOperation,
  payload: WorkCenterCreatePayload,
): Promise<void> {
  const timestamp = payload.reportedAt ?? operation.createdAtDevice;
  const initialState = deriveWorkCenterState({
    signals: [{ signalType: 'creator_report', sourceId: operation.actorKeyId }],
    updatedAt: timestamp,
    priority: payload.priority,
  });

  await db
    .prepare(
      `INSERT INTO work_centers (
         work_center_id, incident_id, cell_id, name, center_type, description, priority, initial_need, surplus,
         latitude, longitude, source_channel, source_operation_id, status, activation_state, freshness, confidence, risk,
         signal_count, corroborating_signal_count, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      operation.entityId,
      incident.incidentId,
      operation.cellId,
      payload.name,
      payload.centerType ?? null,
      payload.description ?? null,
      payload.priority,
      payload.initialNeed ?? null,
      payload.surplus ?? null,
      payload.location?.latitude ?? null,
      payload.location?.longitude ?? null,
      'mobile',
      operation.opId,
      initialState.status,
      initialState.activationState,
      initialState.freshness,
      initialState.confidence,
      initialState.risk,
      initialState.signalCount,
      initialState.corroboratingSignalCount,
      timestamp,
      timestamp,
    )
    .run();

  await insertWorkCenterSignal(db, {
    signalId: `sig_${slug(operation.opId)}`,
    workCenterId: operation.entityId,
    incidentId: incident.incidentId,
    signalType: 'creator_report',
    sourceChannel: 'mobile',
    sourceId: operation.actorKeyId,
    actorKeyId: operation.actorKeyId,
    operationId: operation.opId,
    createdAt: timestamp,
    payload,
  });
  await refreshWorkCenterDerivedState(db, operation.entityId, timestamp, payload.priority);
}

async function recordSyncOperation(db: D1Database, operation: PendingSignedOperation, payloadHash: string, status: 'accepted' | 'rejected'): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sync_operations (op_id, incident_id, entity_id, entity_type, op_type, version, payload_hash, status, result_entity_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(operation.opId, operation.incidentId, operation.entityId, operation.entityType, operation.opType, operation.version, payloadHash, status, operation.entityId)
    .run();
}

async function findIncidentMembershipForChannel(
  db: D1Database,
  incidentId: string,
  channel: Channel,
  externalId: string,
): Promise<IncidentMembershipLookup | null> {
  return db
    .prepare(
      `SELECT ci.channel_identity_id AS channelIdentityId, im.incident_membership_id AS incidentMembershipId
       FROM channel_identities ci
       JOIN incident_memberships im ON im.channel_identity_id = ci.channel_identity_id
       WHERE im.incident_id = ? AND ci.channel = ? AND ci.external_id = ?
       ORDER BY im.created_at ASC
       LIMIT 1`,
    )
    .bind(incidentId, channel, externalId)
    .first<IncidentMembershipLookup>();
}

async function createConnectedWorkCenter(
  db: D1Database,
  incident: IncidentSummary,
  request: WorkCenterConnectedCreateRequest,
  membership: IncidentMembershipLookup,
): Promise<WorkCenterCreateResponse> {
  const nowIso = new Date().toISOString();
  const workCenterId = `wc_${slug(incident.incidentId)}_${slug(request.channel)}_${slug(request.externalId)}_${slug(request.payload.name)}`;
  const signalId = `sig_${workCenterId}_creator`;
  const auditEventId = `audit_work_center_created_${slug(incident.incidentId)}_${workCenterId}`;
  const initialState = deriveWorkCenterState({
    signals: [{ signalType: 'creator_report', sourceId: request.externalId }],
    updatedAt: nowIso,
    priority: request.payload.priority,
  });

  const insert = await db
    .prepare(
      `INSERT OR IGNORE INTO work_centers (
         work_center_id, incident_id, cell_id, name, center_type, description, priority, initial_need, surplus,
         latitude, longitude, source_channel, source_operation_id, status, activation_state, freshness, confidence, risk,
         signal_count, corroborating_signal_count, created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      workCenterId,
      incident.incidentId,
      `connected-${request.channel}`,
      request.payload.name,
      request.payload.centerType ?? null,
      request.payload.description ?? null,
      request.payload.priority,
      request.payload.initialNeed ?? null,
      request.payload.surplus ?? null,
      request.payload.location?.latitude ?? null,
      request.payload.location?.longitude ?? null,
      request.channel,
      null,
      initialState.status,
      initialState.activationState,
      initialState.freshness,
      initialState.confidence,
      initialState.risk,
      initialState.signalCount,
      initialState.corroboratingSignalCount,
      nowIso,
      nowIso,
    )
    .run();

  await insertWorkCenterSignal(db, {
    signalId,
    workCenterId,
    incidentId: incident.incidentId,
    signalType: 'creator_report',
    sourceChannel: request.channel,
    sourceId: request.externalId,
    actorKeyId: null,
    operationId: null,
    createdAt: nowIso,
    payload: request.payload,
  });

  await db
    .prepare(
      `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      auditEventId,
      incident.incidentId,
      membership.channelIdentityId,
      membership.incidentMembershipId,
      'work_center.created',
      JSON.stringify({ channel: request.channel, externalId: request.externalId, workCenterId }),
    )
    .run();

  const detail = await getWorkCenterDetail(db, incident.incidentId, workCenterId);

  if (!detail) {
    throw new Error(`Work center was not persisted: ${workCenterId}`);
  }

  return WorkCenterCreateResponseSchema.parse({
    workCenter: detail,
    audit: { auditEventId },
    idempotent: insert.meta.changes === 0,
  });
}

async function insertWorkCenterSignal(
  db: D1Database,
  input: {
    signalId: string;
    workCenterId: string;
    incidentId: string;
    signalType: WorkCenterSignalType;
    sourceChannel: Channel;
    sourceId: string;
    actorKeyId: string | null;
    operationId: string | null;
    createdAt: string;
    payload: WorkCenterCreatePayload;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO work_center_signals (
         work_center_signal_id, work_center_id, incident_id, signal_type, source_channel, source_id,
         actor_key_id, operation_id, created_at, payload_json
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.signalId,
      input.workCenterId,
      input.incidentId,
      input.signalType,
      input.sourceChannel,
      input.sourceId,
      input.actorKeyId,
      input.operationId,
      input.createdAt,
      JSON.stringify(input.payload),
    )
    .run();
}

async function refreshWorkCenterDerivedState(db: D1Database, workCenterId: string, updatedAt: string, priority: WorkCenterPriority): Promise<void> {
  const { results } = await db
    .prepare('SELECT signal_type AS signalType, source_id AS sourceId FROM work_center_signals WHERE work_center_id = ?')
    .bind(workCenterId)
    .all<WorkCenterSignalInput>();
  const state = deriveWorkCenterState({ signals: results, updatedAt, priority });

  await db
    .prepare(
      `UPDATE work_centers
       SET status = ?, activation_state = ?, freshness = ?, confidence = ?, risk = ?,
         signal_count = ?, corroborating_signal_count = ?, updated_at = ?
       WHERE work_center_id = ?`,
    )
    .bind(
      state.status,
      state.activationState,
      state.freshness,
      state.confidence,
      state.risk,
      state.signalCount,
      state.corroboratingSignalCount,
      updatedAt,
      workCenterId,
    )
    .run();
}

async function listWorkCenters(db: D1Database, incidentId: string): Promise<WorkCenterSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT work_center_id AS workCenterId, incident_id AS incidentId, cell_id AS cellId, name, center_type AS centerType,
        description, priority, initial_need AS initialNeed, surplus, latitude, longitude, source_channel AS sourceChannel,
        status, activation_state AS activationState, freshness, confidence, risk, signal_count AS signalCount,
        corroborating_signal_count AS corroboratingSignalCount, created_at AS createdAt, updated_at AS updatedAt
       FROM work_centers
       WHERE incident_id = ?
       ORDER BY updated_at DESC`,
    )
    .bind(incidentId)
    .all<WorkCenterRow>();

  return Promise.all(results.map((row) => rowToWorkCenterSummary(db, row)));
}

async function getWorkCenterDetail(db: D1Database, incidentId: string, workCenterId: string): Promise<WorkCenterDetail | null> {
  const row = await db
    .prepare(
      `SELECT work_center_id AS workCenterId, incident_id AS incidentId, cell_id AS cellId, name, center_type AS centerType,
        description, priority, initial_need AS initialNeed, surplus, latitude, longitude, source_channel AS sourceChannel,
        status, activation_state AS activationState, freshness, confidence, risk, signal_count AS signalCount,
        corroborating_signal_count AS corroboratingSignalCount, created_at AS createdAt, updated_at AS updatedAt
       FROM work_centers
       WHERE incident_id = ? AND work_center_id = ?`,
    )
    .bind(incidentId, workCenterId)
    .first<WorkCenterRow>();

  if (!row) {
    return null;
  }

  const { results } = await db
    .prepare(
      `SELECT work_center_signal_id AS signalId, signal_type AS signalType, source_channel AS sourceChannel, source_id AS sourceId, created_at AS createdAt
       FROM work_center_signals
       WHERE work_center_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
    )
    .bind(workCenterId)
    .all<WorkCenterSignalRow>();

  return {
    ...(await rowToWorkCenterBase(db, row)),
    latestSignals: results,
  };
}

async function rowToWorkCenterSummary(db: D1Database, row: WorkCenterRow): Promise<WorkCenterSummary> {
  const { description: _description, initialNeed: _initialNeed, surplus: _surplus, ...summary } = await rowToWorkCenterBase(db, row);
  return summary;
}

async function rowToWorkCenterBase(db: D1Database, row: WorkCenterRow): Promise<Omit<WorkCenterDetail, 'latestSignals'>> {
  const derivedState = await deriveWorkCenterReadState(db, row);

  return {
    workCenterId: row.workCenterId,
    incidentId: row.incidentId,
    cellId: row.cellId,
    name: row.name,
    ...(row.centerType ? { centerType: row.centerType } : {}),
    ...(row.description ? { description: row.description } : {}),
    priority: row.priority,
    ...(row.initialNeed ? { initialNeed: row.initialNeed } : {}),
    ...(row.surplus ? { surplus: row.surplus } : {}),
    ...(row.latitude !== null && row.longitude !== null ? { location: { latitude: row.latitude, longitude: row.longitude } } : {}),
    status: derivedState.status,
    activationState: derivedState.activationState,
    freshness: derivedState.freshness,
    confidence: derivedState.confidence,
    risk: derivedState.risk,
    signalCount: derivedState.signalCount,
    corroboratingSignalCount: derivedState.corroboratingSignalCount,
    ...(row.sourceChannel ? { sourceChannel: row.sourceChannel } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function deriveWorkCenterReadState(db: D1Database, row: WorkCenterRow) {
  const { results } = await db
    .prepare('SELECT signal_type AS signalType, source_id AS sourceId FROM work_center_signals WHERE work_center_id = ?')
    .bind(row.workCenterId)
    .all<WorkCenterSignalInput>();

  return deriveWorkCenterState({ signals: results, updatedAt: row.updatedAt, priority: row.priority });
}

function readStringProperty(value: unknown, property: string): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const result = (value as Record<string, unknown>)[property];
  return typeof result === 'string' ? result : null;
}

async function hashJson(value: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(stableStringify(value));
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function logOperationEvent(input: {
  channel: Channel | 'mobile' | null;
  opType: string | null;
  opId: string | null;
  entityId: string | null;
  result: 'accepted' | 'rejected';
  errorCode: ContractErrorCode | null;
  latencyMs: number;
}): void {
  console.log(
    JSON.stringify({
      event: 'operation.processed',
      channel: input.channel,
      opType: input.opType,
      opId: input.opId,
      entityId: input.entityId,
      result: input.result,
      errorCode: input.errorCode,
      latencyMs: input.latencyMs,
    }),
  );
}

function createIncidentConfigResponse(incident: IncidentSummary): IncidentConfigResponse {
  return IncidentConfigResponseSchema.parse({ incident, roles, channels, permissionSnapshots });
}


async function handleTelegramConversation(db: D1Database, update: TelegramUpdateLike, command: string | null): Promise<string> {
  const workCenterStateKey = getTelegramWorkCenterConversationStateKey(update);
  const joinStateKey = getTelegramConversationStateKey(update);

  if (command === '/workcenter') {
    return handleTelegramWorkCenterConversation(db, update, workCenterStateKey);
  }

  if (command !== '/start' && workCenterStateKey) {
    const existingWorkCenterState = await loadTelegramConversationState(
      db,
      workCenterStateKey,
      safeParseTelegramWorkCenterReportState,
      { step: 'idle' } satisfies TelegramWorkCenterReportState,
    );

    if (existingWorkCenterState.step !== 'idle') {
      return handleTelegramWorkCenterConversation(db, update, workCenterStateKey, existingWorkCenterState);
    }
  }

  return handleTelegramIncidentJoinConversation(db, update, joinStateKey);
}

async function handleTelegramIncidentJoinConversation(db: D1Database, update: TelegramUpdateLike, stateKey: string | null): Promise<string> {
  const currentState = stateKey
    ? await loadTelegramConversationState(db, stateKey, safeParseTelegramIncidentJoinState, { step: 'idle' } satisfies TelegramIncidentJoinState)
    : ({ step: 'idle' } satisfies TelegramIncidentJoinState);
  const ports = createTelegramIncidentJoinPorts(db);
  const result = await handleTelegramIncidentJoinFlow(currentState, update, ports);

  if (stateKey) {
    if (isTerminalTelegramIncidentJoinState(result.state)) {
      await deleteTelegramConversationState(db, stateKey);
    } else {
      await persistTelegramConversationState(db, stateKey, result.state);
    }
  }

  return result.responseText;
}

async function handleTelegramWorkCenterConversation(
  db: D1Database,
  update: TelegramUpdateLike,
  stateKey: string | null,
  loadedState?: TelegramWorkCenterReportState,
): Promise<string> {
  const currentState = loadedState ?? (stateKey
    ? await loadTelegramConversationState(db, stateKey, safeParseTelegramWorkCenterReportState, { step: 'idle' } satisfies TelegramWorkCenterReportState)
    : ({ step: 'idle' } satisfies TelegramWorkCenterReportState));
  const ports = createTelegramWorkCenterReportPorts(db);
  const result = await handleTelegramWorkCenterReportFlow(currentState, update, ports);

  if (stateKey) {
    if (isTerminalTelegramWorkCenterReportState(result.state) || isPermissionDeniedTelegramWorkCenterResult(currentState, result.responseText)) {
      await deleteTelegramConversationState(db, stateKey);
    } else {
      await persistTelegramConversationState(db, stateKey, result.state);
    }
  }

  return result.responseText;
}

function isPermissionDeniedTelegramWorkCenterResult(state: TelegramWorkCenterReportState, responseText: string): boolean {
  return state.step === 'awaitingConfirmation' && responseText.includes('Permission denied');
}

function createTelegramIncidentJoinPorts(db: D1Database): TelegramIncidentJoinPorts {
  return {
    async listIncidents() {
      return IncidentListResponseSchema.parse({ incidents: await listIncidents(db) });
    },
    async getIncidentConfig(incidentId) {
      const incident = await findIncident(db, incidentId);
      if (!incident) {
        throw new Error(`Incident not found: ${incidentId}`);
      }

      return createIncidentConfigResponse(incident);
    },
    async joinIncident(incidentId, request) {
      const incident = await findIncident(db, incidentId);
      if (!incident) {
        throw new Error(`Incident not found: ${incidentId}`);
      }

      return IncidentJoinResponseSchema.parse(await joinIncident(db, incident, request));
    },
  };
}

function createTelegramWorkCenterReportPorts(db: D1Database): TelegramWorkCenterReportPorts {
  return {
    async listIncidents() {
      return IncidentListResponseSchema.parse({ incidents: await listIncidents(db) });
    },
    async createWorkCenter(incidentId, request) {
      const incident = await findIncident(db, incidentId);
      if (!incident) {
        throw Object.assign(new Error('not_found'), { error: 'not_found' });
      }

      const membership = await findIncidentMembershipForChannel(db, incident.incidentId, request.channel, request.externalId);
      if (!membership) {
        throw Object.assign(new Error('permission_denied'), { error: 'permission_denied' });
      }

      return WorkCenterCreateResponseSchema.parse(await createConnectedWorkCenter(db, incident, request, membership));
    },
  };
}

function getTelegramConversationStateKey(update: TelegramUpdateLike): string | null {
  return getTelegramConversationBaseStateKey(update);
}

function getTelegramWorkCenterConversationStateKey(update: TelegramUpdateLike): string | null {
  const baseKey = getTelegramConversationBaseStateKey(update);
  return baseKey ? `flow:workcenter:${baseKey}` : null;
}

function getTelegramConversationBaseStateKey(update: TelegramUpdateLike): string | null {
  const chatId = update.message?.chat?.id;
  const fromId = update.message?.from?.id;

  if (chatId == null && fromId == null) {
    return null;
  }

  return `chat:${chatId ?? 'unknown'}:from:${fromId ?? 'unknown'}`;
}

async function loadTelegramConversationState<TState>(
  db: D1Database,
  stateKey: string,
  safeParseState: (value: unknown) => { success: true; data: TState } | { success: false; error: Error },
  idleState: TState,
): Promise<TState> {
  const row = await db
    .prepare('SELECT state_json AS stateJson, expires_at AS expiresAt FROM telegram_conversation_states WHERE state_key = ?')
    .bind(stateKey)
    .first<{ stateJson: string; expiresAt: string }>();

  if (!row) {
    return idleState;
  }

  const expiresAt = Date.parse(row.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await deleteTelegramConversationState(db, stateKey);
    return idleState;
  }

  try {
    const parsed = safeParseState(JSON.parse(row.stateJson));
    if (parsed.success) {
      return parsed.data;
    }
  } catch {
    // Corrupt JSON is treated like missing state and removed below.
  }

  await deleteTelegramConversationState(db, stateKey);
  return idleState;
}

async function persistTelegramConversationState(
  db: D1Database,
  stateKey: string,
  state: TelegramIncidentJoinState | TelegramWorkCenterReportState,
): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAtIso = new Date(now.getTime() + telegramConversationStateTtlMs).toISOString();

  await db
    .prepare(
      `INSERT INTO telegram_conversation_states (state_key, state_json, step, created_at, updated_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(state_key) DO UPDATE SET
         state_json = excluded.state_json,
         step = excluded.step,
         updated_at = excluded.updated_at,
         expires_at = excluded.expires_at`,
    )
    .bind(stateKey, JSON.stringify(state), state.step, nowIso, nowIso, expiresAtIso)
    .run();
}

async function deleteTelegramConversationState(db: D1Database, stateKey: string): Promise<void> {
  await db.prepare('DELETE FROM telegram_conversation_states WHERE state_key = ?').bind(stateKey).run();
}

async function joinIncident(
  db: D1Database,
  incident: IncidentSummary,
  request: { channel: Channel; externalId: string; role: IncidentRole; displayName?: string },
): Promise<IncidentJoinResponse> {
  const channelIdentityId = `chid_${slug(request.channel)}_${slug(request.externalId)}`;
  const permissions: PermissionSnapshot = permissionSnapshots[request.role];
  const incidentMembershipId = `mship_${slug(incident.incidentId)}_${channelIdentityId}_${request.role}`;
  const auditEventId = `audit_join_${slug(incident.incidentId)}_${channelIdentityId}_${request.role}`;

  await db
    .prepare(
      `INSERT OR IGNORE INTO channel_identities (channel_identity_id, channel, external_id, display_name)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(channelIdentityId, request.channel, request.externalId, request.displayName ?? null)
    .run();

  const membershipInsert = await db
    .prepare(
      `INSERT OR IGNORE INTO incident_memberships (incident_membership_id, incident_id, channel_identity_id, role, permissions_json)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(incidentMembershipId, incident.incidentId, channelIdentityId, request.role, JSON.stringify(permissions))
    .run();

  const idempotent = membershipInsert.meta.changes === 0;

  await db
    .prepare(
      `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      auditEventId,
      incident.incidentId,
      channelIdentityId,
      incidentMembershipId,
      'incident.joined',
      JSON.stringify({ channel: request.channel, externalId: request.externalId, role: request.role }),
    )
    .run();

  return {
    incident,
    channelIdentity: {
      channelIdentityId,
      channel: request.channel,
      externalId: request.externalId,
      ...(request.displayName ? { displayName: request.displayName } : {}),
    },
    membership: {
      incidentMembershipId,
      incidentId: incident.incidentId,
      channelIdentityId,
      role: request.role,
      permissions,
    },
    audit: { auditEventId },
    idempotent,
  };
}

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export default app;

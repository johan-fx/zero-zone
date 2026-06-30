import { Hono } from 'hono';
import { cors } from 'hono/cors';

import {
  HealthResponseSchema,
  IncidentConfigResponseSchema,
  IncidentJoinRequestSchema,
  DispatchEventCreatePayloadSchema,
  DispatchEventUpdatePayloadSchema,
  DispatchTaskConnectedCreateRequestSchema,
  DispatchTaskConnectedUpdateRequestSchema,
  DispatchTaskListResponseSchema,
  DispatchTaskResponseSchema,
  type DispatchEventCreatePayload,
  type DispatchEventUpdatePayload,
  type DispatchTask,
  type DispatchTaskConnectedCreateRequest,
  type DispatchTaskConnectedUpdateRequest,
  type DispatchTaskStatus,
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
  ResourceReportConnectedCreateRequestSchema,
  ResourceReportCreateResponseSchema,
  ResourceReportDetailResponseSchema,
  ResourceReportListResponseSchema,
  ResourceReportMatchResponseSchema,
  ResourceReportPayloadSchema,
  type ResourceReportConnectedCreateRequest,
  type ResourceReportCreateResponse,
  type ResourceReportDetail,
  type ResourceReportPayload,
  type ResourceReportSummary,
  SosAlertCreateResponseSchema,
  SosAlertStatusResponseSchema,
  SosCancelPayloadSchema,
  SosConnectedCreateRequestSchema,
  SosCreatePayloadSchema,
  type SosAlert,
  type SosAlertCreateResponse,
  type SosCancelPayload,
  type SosConnectedCreateRequest,
  type SosCreatePayload,
  type SosFanoutStatus,
  type SosFanoutJobStatus,
  type SosSeverity,
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
import { deriveResourceReportState, deriveWorkCenterState, matchResourceReports, type WorkCenterSignalInput } from '@zona-cero/domain';
import {
  handleTelegramDispatchTaskFlow,
  handleTelegramIncidentJoinFlow,
  handleTelegramResourceReportFlow,
  handleTelegramSosFlow,
  handleTelegramWorkCenterReportFlow,
  isTerminalTelegramDispatchTaskState,
  isTerminalTelegramIncidentJoinState,
  isTerminalTelegramResourceReportState,
  isTerminalTelegramSosState,
  isTerminalTelegramWorkCenterReportState,
  resolveTelegramCommand,
  safeParseTelegramDispatchTaskState,
  safeParseTelegramIncidentJoinState,
  safeParseTelegramResourceReportState,
  safeParseTelegramSosState,
  safeParseTelegramWorkCenterReportState,
  type TelegramDispatchTaskPorts,
  type TelegramDispatchTaskState,
  type TelegramIncidentJoinPorts,
  type TelegramIncidentJoinState,
  type TelegramResourceReportPorts,
  type TelegramResourceReportState,
  type TelegramSosPorts,
  type TelegramSosState,
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


app.post('/incidents/:incidentId/resource-reports', async (c) => {
  const startedAt = Date.now();
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));

  if (!incident) {
    logOperationEvent({ channel: null, opType: 'resource_report.create', opId: null, entityId: null, result: 'rejected', errorCode: 'not_found', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = ResourceReportConnectedCreateRequestSchema.safeParse(body);

  if (!parsed.success) {
    logOperationEvent({ channel: null, opType: 'resource_report.create', opId: null, entityId: null, result: 'rejected', errorCode: 'invalid_payload', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const membership = await findIncidentMembershipForChannel(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!membership) {
    logOperationEvent({ channel: parsed.data.channel, opType: 'resource_report.create', opId: null, entityId: null, result: 'rejected', errorCode: 'permission_denied', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'permission_denied' }, 403);
  }

  const response = await createConnectedResourceReport(c.env.DB, incident, parsed.data, membership);
  logOperationEvent({ channel: parsed.data.channel, opType: 'resource_report.create', opId: null, entityId: response.resourceReport.resourceReportId, result: 'accepted', errorCode: null, latencyMs: Date.now() - startedAt });
  return c.json(ResourceReportCreateResponseSchema.parse(response));
});

app.get('/incidents/:incidentId/resource-reports', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  return c.json(ResourceReportListResponseSchema.parse({ resourceReports: await listResourceReports(c.env.DB, incident.incidentId) }));
});

app.get('/incidents/:incidentId/resource-reports/matches', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  const reports = await listResourceReports(c.env.DB, incident.incidentId);
  return c.json(ResourceReportMatchResponseSchema.parse({ matches: matchResourceReports(reports) }));
});

app.get('/incidents/:incidentId/resource-reports/:resourceReportId', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  const resourceReport = await getResourceReportDetail(c.env.DB, incident.incidentId, c.req.param('resourceReportId'));
  if (!resourceReport) {
    return c.json({ error: 'not_found' }, 404);
  }

  return c.json(ResourceReportDetailResponseSchema.parse({ resourceReport }));
});

app.post('/incidents/:incidentId/dispatch-tasks', async (c) => {
  const startedAt = Date.now();
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    logOperationEvent({ channel: null, opType: 'dispatch_event.create', opId: null, entityId: null, result: 'rejected', errorCode: 'not_found', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = DispatchTaskConnectedCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    logOperationEvent({ channel: null, opType: 'dispatch_event.create', opId: null, entityId: null, result: 'rejected', errorCode: 'invalid_payload', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const membership = await findIncidentMembershipForChannel(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!membership) {
    logOperationEvent({ channel: parsed.data.channel, opType: 'dispatch_event.create', opId: null, entityId: null, result: 'rejected', errorCode: 'permission_denied', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'permission_denied' }, 403);
  }

  const response = await createConnectedDispatchTask(c.env.DB, incident, parsed.data, membership);
  logOperationEvent({ channel: parsed.data.channel, opType: 'dispatch_event.create', opId: null, entityId: response.dispatchTask.dispatchTaskId, result: 'accepted', errorCode: null, latencyMs: Date.now() - startedAt });
  return c.json(DispatchTaskResponseSchema.parse(response));
});

app.get('/incidents/:incidentId/dispatch-tasks', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  return c.json(DispatchTaskListResponseSchema.parse({ dispatchTasks: await listDispatchTasks(c.env.DB, incident.incidentId) }));
});

app.patch('/incidents/:incidentId/dispatch-tasks/:dispatchTaskId', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = DispatchTaskConnectedUpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const membership = await findIncidentMembershipForChannel(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!membership) {
    return c.json({ error: 'permission_denied' }, 403);
  }

  const response = await updateConnectedDispatchTask(c.env.DB, incident, c.req.param('dispatchTaskId'), parsed.data, membership);
  if (!response) {
    return c.json({ error: 'not_found' }, 404);
  }

  return c.json(DispatchTaskResponseSchema.parse(response));
});

app.post('/incidents/:incidentId/sos', async (c) => {
  const startedAt = Date.now();
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    logOperationEvent({ channel: null, opType: 'sos.create', opId: null, entityId: null, result: 'rejected', errorCode: 'not_found', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = SosConnectedCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    logOperationEvent({ channel: null, opType: 'sos.create', opId: null, entityId: null, result: 'rejected', errorCode: 'invalid_payload', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const membership = await findIncidentMembershipForChannel(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!membership) {
    logOperationEvent({ channel: parsed.data.channel, opType: 'sos.create', opId: null, entityId: null, result: 'rejected', errorCode: 'permission_denied', latencyMs: Date.now() - startedAt });
    return c.json({ error: 'permission_denied' }, 403);
  }

  const response = await createConnectedSosAlert(c.env.DB, incident, parsed.data, membership);
  logOperationEvent({ channel: parsed.data.channel, opType: 'sos.create', opId: null, entityId: response.sosAlert.sosAlertId, result: 'accepted', errorCode: null, latencyMs: Date.now() - startedAt });
  return c.json(SosAlertCreateResponseSchema.parse(response));
});

app.get('/incidents/:incidentId/sos', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  return c.json(SosAlertStatusResponseSchema.parse({
    sosAlerts: await listSosAlerts(c.env.DB, incident.incidentId),
    fanout: await getSosFanoutStatus(c.env.DB, incident.incidentId),
  }));
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

type ResourceReportRow = {
  resourceReportId: string;
  incidentId: string;
  cellId: string;
  workCenterId: string | null;
  category: string;
  quantityApprox: string;
  urgency: ResourceReportSummary['urgency'];
  constraintsJson: string;
  reportKind: ResourceReportSummary['reportKind'];
  freshness: ResourceReportSummary['freshness'];
  confidence: ResourceReportSummary['confidence'];
  risk: ResourceReportSummary['risk'];
  sourceChannel: Channel | null;
  sourceOperationId: string | null;
  actorKeyId: string | null;
  createdAt: string;
  updatedAt: string;
};

type DispatchTaskRow = {
  dispatchTaskId: string;
  incidentId: string;
  cellId: string;
  category: string;
  quantityApprox: string;
  fromResourceReportId: string | null;
  toResourceReportId: string | null;
  targetWorkCenterId: string | null;
  status: DispatchTaskStatus;
  notes: string | null;
  sourceChannel: Channel | null;
  createdAt: string;
  updatedAt: string;
};

type ExistingDispatchTaskCreateRow = DispatchTaskRow & {
  sourceOperationId: string | null;
};

type SosAlertRow = {
  sosAlertId: string;
  incidentId: string;
  cellId: string;
  severity: SosSeverity;
  message: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  status: SosAlert['status'];
  sourceChannel: Channel | null;
  sourceOperationId: string | null;
  actorKeyId: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
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

  if (parsed.data.opType === 'resource_report.create') {
    return handleResourceReportCreateSyncOperation(db, parsed.data, startedAt);
  }

  if (parsed.data.opType === 'dispatch_event.create' || parsed.data.opType === 'dispatch_event.update') {
    return handleDispatchEventSyncOperation(db, parsed.data, startedAt);
  }

  if (parsed.data.opType === 'sos.create' || parsed.data.opType === 'sos.cancel') {
    return handleSosSyncOperation(db, parsed.data, startedAt);
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


async function handleResourceReportCreateSyncOperation(db: D1Database, operation: PendingSignedOperation, startedAt: number): Promise<SyncPushOperationResult> {
  const payload = ResourceReportPayloadSchema.safeParse(operation.payload);
  if (!payload.success) {
    logOperationEvent({ channel: 'mobile', opType: operation.opType, opId: operation.opId, entityId: operation.entityId, result: 'rejected', errorCode: 'invalid_payload', latencyMs: Date.now() - startedAt });
    return { opId: operation.opId, status: 'rejected', code: 'invalid_payload' };
  }

  const incident = await findIncident(db, operation.incidentId);
  if (!incident) {
    logOperationEvent({ channel: 'mobile', opType: operation.opType, opId: operation.opId, entityId: operation.entityId, result: 'rejected', errorCode: 'not_found', latencyMs: Date.now() - startedAt });
    return { opId: operation.opId, status: 'rejected', code: 'not_found' };
  }

  const payloadHash = await hashJson({ operation });
  const existing = await resolveExistingSyncOperation(db, operation, payloadHash, startedAt);
  if (existing) {
    return existing;
  }

  const existingReport = await db.prepare('SELECT source_operation_id AS sourceOperationId FROM resource_reports WHERE resource_report_id = ?')
    .bind(operation.entityId)
    .first<{ sourceOperationId: string | null }>();
  if (existingReport && existingReport.sourceOperationId !== operation.opId) {
    await recordSyncOperation(db, operation, payloadHash, 'rejected');
    return rejectOperation(operation, startedAt, 'operation_conflict');
  }

  await materializeResourceReportCreateOperation(db, operation, payload.data, 'mobile');
  await recordSyncOperation(db, operation, payloadHash, 'accepted');
  logOperationEvent({ channel: 'mobile', opType: operation.opType, opId: operation.opId, entityId: operation.entityId, result: 'accepted', errorCode: null, latencyMs: Date.now() - startedAt });
  return { opId: operation.opId, status: 'accepted' };
}

async function handleDispatchEventSyncOperation(db: D1Database, operation: PendingSignedOperation, startedAt: number): Promise<SyncPushOperationResult> {
  const createPayload = operation.opType === 'dispatch_event.create' ? DispatchEventCreatePayloadSchema.safeParse(operation.payload) : null;
  const updatePayload = operation.opType === 'dispatch_event.update' ? DispatchEventUpdatePayloadSchema.safeParse(operation.payload) : null;
  if ((operation.opType === 'dispatch_event.create' && !createPayload?.success) || (operation.opType === 'dispatch_event.update' && !updatePayload?.success)) {
    return rejectOperation(operation, startedAt, 'invalid_payload');
  }

  const incident = await findIncident(db, operation.incidentId);
  if (!incident) {
    return rejectOperation(operation, startedAt, 'not_found');
  }

  const payloadHash = await hashJson({ operation });
  const existing = await resolveExistingSyncOperation(db, operation, payloadHash, startedAt);
  if (existing) {
    return existing;
  }

  if (createPayload?.success) {
    const existingDispatchTask = await getExistingDispatchTaskForCreate(db, operation.incidentId, operation.entityId);
    if (existingDispatchTask) {
      if (isConflictingDispatchTaskCreate(existingDispatchTask, operation, createPayload.data)) {
        await recordSyncOperation(db, operation, payloadHash, 'rejected');
        return rejectOperation(operation, startedAt, 'operation_conflict');
      }

      await recordSyncOperation(db, operation, payloadHash, 'accepted');
      logOperationEvent({ channel: 'mobile', opType: operation.opType, opId: operation.opId, entityId: operation.entityId, result: 'accepted', errorCode: null, latencyMs: Date.now() - startedAt });
      return { opId: operation.opId, status: 'accepted' };
    }

    await materializeDispatchTaskCreateOperation(db, operation, createPayload.data, 'mobile');
  } else if (updatePayload?.success) {
    const updated = await materializeDispatchTaskUpdateOperation(db, operation, updatePayload.data, 'mobile');
    if (!updated) {
      await recordSyncOperation(db, operation, payloadHash, 'rejected');
      return rejectOperation(operation, startedAt, 'not_found');
    }
  }

  await recordSyncOperation(db, operation, payloadHash, 'accepted');
  logOperationEvent({ channel: 'mobile', opType: operation.opType, opId: operation.opId, entityId: operation.entityId, result: 'accepted', errorCode: null, latencyMs: Date.now() - startedAt });
  return { opId: operation.opId, status: 'accepted' };
}

async function handleSosSyncOperation(db: D1Database, operation: PendingSignedOperation, startedAt: number): Promise<SyncPushOperationResult> {
  const createPayload = operation.opType === 'sos.create' ? SosCreatePayloadSchema.safeParse(operation.payload) : null;
  const cancelPayload = operation.opType === 'sos.cancel' ? SosCancelPayloadSchema.safeParse(operation.payload) : null;
  if ((operation.opType === 'sos.create' && !createPayload?.success) || (operation.opType === 'sos.cancel' && !cancelPayload?.success)) {
    return rejectOperation(operation, startedAt, 'invalid_payload');
  }

  const incident = await findIncident(db, operation.incidentId);
  if (!incident) {
    return rejectOperation(operation, startedAt, 'not_found');
  }

  const payloadHash = await hashJson({ operation });
  const existing = await resolveExistingSyncOperation(db, operation, payloadHash, startedAt);
  if (existing) {
    return existing;
  }

  if (createPayload?.success) {
    const existingAlert = await getSosAlertById(db, operation.incidentId, operation.entityId);
    if (existingAlert) {
      if (existingAlert.sourceOperationId !== operation.opId) {
        await recordSyncOperation(db, operation, payloadHash, 'rejected');
        return rejectOperation(operation, startedAt, 'operation_conflict');
      }

      await recordSyncOperation(db, operation, payloadHash, 'accepted');
      logOperationEvent({ channel: 'mobile', opType: operation.opType, opId: operation.opId, entityId: operation.entityId, result: 'accepted', errorCode: null, latencyMs: Date.now() - startedAt });
      return { opId: operation.opId, status: 'accepted' };
    }

    await insertSosAlert(db, operation.entityId, operation.incidentId, operation.cellId, createPayload.data, 'mobile', operation.opId, operation.actorKeyId, createPayload.data.reportedAt ?? operation.createdAtDevice);
  } else if (cancelPayload?.success) {
    const cancelled = await cancelSosAlert(db, operation.incidentId, operation.entityId, cancelPayload.data, 'mobile', operation.opId, operation.actorKeyId, cancelPayload.data.cancelledAt ?? operation.createdAtDevice);
    if (!cancelled) {
      await recordSyncOperation(db, operation, payloadHash, 'rejected');
      return rejectOperation(operation, startedAt, 'not_found');
    }
  }

  await recordSyncOperation(db, operation, payloadHash, 'accepted');
  logOperationEvent({ channel: 'mobile', opType: operation.opType, opId: operation.opId, entityId: operation.entityId, result: 'accepted', errorCode: null, latencyMs: Date.now() - startedAt });
  return { opId: operation.opId, status: 'accepted' };
}

async function resolveExistingSyncOperation(
  db: D1Database,
  operation: PendingSignedOperation,
  payloadHash: string,
  startedAt: number,
): Promise<SyncPushOperationResult | null> {
  const existingOperation = await db
    .prepare('SELECT payload_hash AS payloadHash, status FROM sync_operations WHERE op_id = ?')
    .bind(operation.opId)
    .first<{ payloadHash: string; status: string }>();

  if (!existingOperation) {
    return null;
  }

  const result = existingOperation.payloadHash === payloadHash && existingOperation.status === 'accepted' ? 'accepted' : 'rejected';
  const errorCode = result === 'accepted' ? null : 'operation_conflict';
  logOperationEvent({ channel: 'mobile', opType: operation.opType, opId: operation.opId, entityId: operation.entityId, result, errorCode, latencyMs: Date.now() - startedAt });
  return result === 'accepted' ? { opId: operation.opId, status: 'accepted' } : { opId: operation.opId, status: 'rejected', code: 'operation_conflict' };
}

function rejectOperation(operation: PendingSignedOperation, startedAt: number, code: ContractErrorCode): SyncPushOperationResult {
  logOperationEvent({ channel: 'mobile', opType: operation.opType, opId: operation.opId, entityId: operation.entityId, result: 'rejected', errorCode: code, latencyMs: Date.now() - startedAt });
  return { opId: operation.opId, status: 'rejected', code };
}

async function getExistingDispatchTaskForCreate(db: D1Database, incidentId: string, dispatchTaskId: string): Promise<ExistingDispatchTaskCreateRow | null> {
  const row = await db.prepare(dispatchTaskSelectSql('WHERE incident_id = ? AND dispatch_task_id = ?'))
    .bind(incidentId, dispatchTaskId)
    .first<ExistingDispatchTaskCreateRow>();
  return row ?? null;
}

function isConflictingDispatchTaskCreate(existing: ExistingDispatchTaskCreateRow, operation: PendingSignedOperation, payload: DispatchEventCreatePayload): boolean {
  if (existing.sourceOperationId !== operation.opId) {
    return true;
  }

  return existing.incidentId !== operation.incidentId
    || existing.cellId !== operation.cellId
    || existing.category !== payload.category
    || existing.quantityApprox !== payload.quantityApprox
    || existing.fromResourceReportId !== (payload.fromResourceReportId ?? null)
    || existing.toResourceReportId !== (payload.toResourceReportId ?? null)
    || existing.targetWorkCenterId !== (payload.targetWorkCenterId ?? null)
    || existing.status !== (payload.status ?? 'pending')
    || existing.notes !== (payload.notes ?? null);
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


async function createConnectedResourceReport(
  db: D1Database,
  incident: IncidentSummary,
  request: ResourceReportConnectedCreateRequest,
  membership: IncidentMembershipLookup,
): Promise<ResourceReportCreateResponse> {
  const resourceReportId = `rr_${slug(incident.incidentId)}_${slug(request.channel)}_${slug(request.externalId)}_${slug(request.payload.reportKind)}_${slug(request.payload.category)}`;
  const auditEventId = `audit_resource_report_created_${slug(incident.incidentId)}_${resourceReportId}`;
  const nowIso = new Date().toISOString();
  await insertResourceReport(db, resourceReportId, incident.incidentId, `connected-${request.channel}`, request.payload, request.channel, null, null, nowIso);
  await db.prepare(
    `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(auditEventId, incident.incidentId, membership.channelIdentityId, membership.incidentMembershipId, 'resource_report.created', JSON.stringify({ resourceReportId })).run();
  const resourceReport = await getResourceReportDetail(db, incident.incidentId, resourceReportId);
  if (!resourceReport) {
    throw new Error(`Resource report was not persisted: ${resourceReportId}`);
  }
  return ResourceReportCreateResponseSchema.parse({ resourceReport, audit: { auditEventId }, idempotent: false });
}

async function materializeResourceReportCreateOperation(
  db: D1Database,
  operation: PendingSignedOperation,
  payload: ResourceReportPayload,
  channel: Channel,
): Promise<void> {
  await insertResourceReport(db, operation.entityId, operation.incidentId, operation.cellId, payload, channel, operation.opId, operation.actorKeyId, payload.reportedAt ?? operation.createdAtDevice);
}

async function insertResourceReport(
  db: D1Database,
  resourceReportId: string,
  incidentId: string,
  cellId: string,
  payload: ResourceReportPayload,
  sourceChannel: Channel,
  sourceOperationId: string | null,
  actorKeyId: string | null,
  timestamp: string,
): Promise<void> {
  const state = deriveResourceReportState({ updatedAt: timestamp, reportKind: payload.reportKind, urgency: payload.urgency, constraints: payload.constraints });
  await db.prepare(
    `INSERT OR IGNORE INTO resource_reports (
       resource_report_id, incident_id, cell_id, work_center_id, category, quantity_approx, urgency, constraints_json,
       report_kind, freshness, confidence, risk, source_channel, source_operation_id, actor_key_id, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    resourceReportId,
    incidentId,
    cellId,
    payload.workCenterId ?? null,
    payload.category,
    payload.quantityApprox,
    payload.urgency,
    JSON.stringify(payload.constraints),
    payload.reportKind,
    state.freshness,
    state.confidence,
    state.risk,
    sourceChannel,
    sourceOperationId,
    actorKeyId,
    timestamp,
    timestamp,
  ).run();
}

async function listResourceReports(db: D1Database, incidentId: string): Promise<ResourceReportSummary[]> {
  const { results } = await db.prepare(resourceReportSelectSql('WHERE incident_id = ? ORDER BY updated_at DESC')).bind(incidentId).all<ResourceReportRow>();
  return results.map(rowToResourceReportSummary);
}

async function getResourceReportDetail(db: D1Database, incidentId: string, resourceReportId: string): Promise<ResourceReportDetail | null> {
  const row = await db.prepare(resourceReportSelectSql('WHERE incident_id = ? AND resource_report_id = ?')).bind(incidentId, resourceReportId).first<ResourceReportRow>();
  return row ? rowToResourceReportDetail(row) : null;
}

function resourceReportSelectSql(whereClause: string): string {
  return `SELECT resource_report_id AS resourceReportId, incident_id AS incidentId, cell_id AS cellId, work_center_id AS workCenterId,
    category, quantity_approx AS quantityApprox, urgency, constraints_json AS constraintsJson, report_kind AS reportKind,
    freshness, confidence, risk, source_channel AS sourceChannel, source_operation_id AS sourceOperationId,
    actor_key_id AS actorKeyId, created_at AS createdAt, updated_at AS updatedAt
    FROM resource_reports ${whereClause}`;
}

function rowToResourceReportSummary(row: ResourceReportRow): ResourceReportSummary {
  const state = deriveResourceReportState({ updatedAt: row.updatedAt, reportKind: row.reportKind, urgency: row.urgency, constraints: parseStringArray(row.constraintsJson) });
  return ResourceReportListResponseSchema.shape.resourceReports.element.parse({
    resourceReportId: row.resourceReportId,
    incidentId: row.incidentId,
    cellId: row.cellId,
    ...(row.workCenterId ? { workCenterId: row.workCenterId } : {}),
    category: row.category,
    quantityApprox: row.quantityApprox,
    urgency: row.urgency,
    constraints: parseStringArray(row.constraintsJson),
    reportKind: row.reportKind,
    freshness: state.freshness,
    confidence: state.confidence,
    risk: state.risk,
    ...(row.sourceChannel ? { sourceChannel: row.sourceChannel } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function rowToResourceReportDetail(row: ResourceReportRow): ResourceReportDetail {
  return ResourceReportDetailResponseSchema.shape.resourceReport.parse({
    ...rowToResourceReportSummary(row),
    ...(row.sourceOperationId ? { sourceOperationId: row.sourceOperationId } : {}),
    ...(row.actorKeyId ? { actorKeyId: row.actorKeyId } : {}),
  });
}

async function createConnectedDispatchTask(
  db: D1Database,
  incident: IncidentSummary,
  request: DispatchTaskConnectedCreateRequest,
  membership: IncidentMembershipLookup,
): Promise<{ dispatchTask: DispatchTask; audit: { auditEventId: string }; idempotent: boolean }> {
  const dispatchTaskId = `dt_${slug(incident.incidentId)}_${slug(request.channel)}_${slug(request.externalId)}_${slug(request.payload.category)}`;
  const auditEventId = `audit_dispatch_task_created_${slug(incident.incidentId)}_${dispatchTaskId}`;
  const nowIso = new Date().toISOString();
  await insertDispatchTask(db, dispatchTaskId, incident.incidentId, `connected-${request.channel}`, request.payload, request.channel, null, nowIso);
  await db.prepare(`INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(auditEventId, incident.incidentId, membership.channelIdentityId, membership.incidentMembershipId, 'dispatch_task.created', JSON.stringify({ dispatchTaskId })).run();
  const dispatchTask = await getDispatchTask(db, incident.incidentId, dispatchTaskId);
  if (!dispatchTask) {
    throw new Error(`Dispatch task was not persisted: ${dispatchTaskId}`);
  }
  return { dispatchTask, audit: { auditEventId }, idempotent: false };
}

async function updateConnectedDispatchTask(
  db: D1Database,
  incident: IncidentSummary,
  dispatchTaskId: string,
  request: DispatchTaskConnectedUpdateRequest,
  membership: IncidentMembershipLookup,
): Promise<{ dispatchTask: DispatchTask; audit: { auditEventId: string } } | null> {
  const payload: DispatchEventUpdatePayload = { dispatchTaskId, status: request.status, ...(request.notes ? { notes: request.notes } : {}) };
  const updated = await updateDispatchTaskStatus(db, incident.incidentId, payload, request.channel, null, null, new Date().toISOString());
  if (!updated) {
    return null;
  }
  const auditEventId = `audit_dispatch_task_updated_${slug(incident.incidentId)}_${slug(dispatchTaskId)}_${slug(request.status)}`;
  await db.prepare(`INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(auditEventId, incident.incidentId, membership.channelIdentityId, membership.incidentMembershipId, 'dispatch_task.updated', JSON.stringify({ dispatchTaskId, status: request.status })).run();
  return { dispatchTask: updated, audit: { auditEventId } };
}

async function materializeDispatchTaskCreateOperation(db: D1Database, operation: PendingSignedOperation, payload: DispatchEventCreatePayload, channel: Channel): Promise<void> {
  await insertDispatchTask(db, operation.entityId, operation.incidentId, operation.cellId, payload, channel, operation.opId, operation.createdAtDevice, payload.status ?? 'pending');
}

async function materializeDispatchTaskUpdateOperation(db: D1Database, operation: PendingSignedOperation, payload: DispatchEventUpdatePayload, channel: Channel): Promise<DispatchTask | null> {
  return updateDispatchTaskStatus(db, operation.incidentId, payload, channel, operation.opId, operation.actorKeyId, operation.createdAtDevice);
}

async function insertDispatchTask(
  db: D1Database,
  dispatchTaskId: string,
  incidentId: string,
  cellId: string,
  payload: DispatchEventCreatePayload,
  sourceChannel: Channel,
  sourceOperationId: string | null,
  timestamp: string,
  explicitStatus: DispatchTaskStatus = 'pending',
): Promise<void> {
  const status = payload.status ?? explicitStatus;
  await db.prepare(
    `INSERT OR IGNORE INTO dispatch_tasks (
      dispatch_task_id, incident_id, cell_id, category, quantity_approx, from_resource_report_id, to_resource_report_id,
      target_work_center_id, status, notes, source_channel, source_operation_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(dispatchTaskId, incidentId, cellId, payload.category, payload.quantityApprox, payload.fromResourceReportId ?? null, payload.toResourceReportId ?? null, payload.targetWorkCenterId ?? null, status, payload.notes ?? null, sourceChannel, sourceOperationId, timestamp, timestamp).run();
  await insertDispatchEvent(db, `de_${slug(sourceOperationId ?? dispatchTaskId)}_created`, dispatchTaskId, incidentId, status, payload.notes ?? null, sourceChannel, sourceOperationId, null, timestamp);
}

async function updateDispatchTaskStatus(
  db: D1Database,
  incidentId: string,
  payload: DispatchEventUpdatePayload,
  sourceChannel: Channel,
  sourceOperationId: string | null,
  actorKeyId: string | null,
  timestamp: string,
): Promise<DispatchTask | null> {
  const existing = await getDispatchTask(db, incidentId, payload.dispatchTaskId);
  if (!existing) {
    return null;
  }
  await db.prepare('UPDATE dispatch_tasks SET status = ?, notes = COALESCE(?, notes), updated_at = ? WHERE incident_id = ? AND dispatch_task_id = ?')
    .bind(payload.status, payload.notes ?? null, timestamp, incidentId, payload.dispatchTaskId).run();
  await insertDispatchEvent(db, `de_${slug(sourceOperationId ?? `${payload.dispatchTaskId}_${payload.status}`)}`, payload.dispatchTaskId, incidentId, payload.status, payload.notes ?? null, sourceChannel, sourceOperationId, actorKeyId, timestamp);
  return getDispatchTask(db, incidentId, payload.dispatchTaskId);
}

async function insertDispatchEvent(
  db: D1Database,
  dispatchEventId: string,
  dispatchTaskId: string,
  incidentId: string,
  status: DispatchTaskStatus,
  notes: string | null,
  sourceChannel: Channel,
  sourceOperationId: string | null,
  actorKeyId: string | null,
  timestamp: string,
): Promise<void> {
  await db.prepare(`INSERT OR IGNORE INTO dispatch_events (dispatch_event_id, dispatch_task_id, incident_id, status, notes, source_channel, source_operation_id, actor_key_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(dispatchEventId, dispatchTaskId, incidentId, status, notes, sourceChannel, sourceOperationId, actorKeyId, timestamp).run();
}

async function listDispatchTasks(db: D1Database, incidentId: string): Promise<DispatchTask[]> {
  const { results } = await db.prepare(dispatchTaskSelectSql('WHERE incident_id = ? ORDER BY updated_at DESC')).bind(incidentId).all<DispatchTaskRow>();
  return results.map(rowToDispatchTask);
}

async function getDispatchTask(db: D1Database, incidentId: string, dispatchTaskId: string): Promise<DispatchTask | null> {
  const row = await db.prepare(dispatchTaskSelectSql('WHERE incident_id = ? AND dispatch_task_id = ?')).bind(incidentId, dispatchTaskId).first<DispatchTaskRow>();
  return row ? rowToDispatchTask(row) : null;
}

function dispatchTaskSelectSql(whereClause: string): string {
  return `SELECT dispatch_task_id AS dispatchTaskId, incident_id AS incidentId, cell_id AS cellId, category, quantity_approx AS quantityApprox,
    from_resource_report_id AS fromResourceReportId, to_resource_report_id AS toResourceReportId, target_work_center_id AS targetWorkCenterId,
    status, notes, source_channel AS sourceChannel, source_operation_id AS sourceOperationId, created_at AS createdAt, updated_at AS updatedAt FROM dispatch_tasks ${whereClause}`;
}

function rowToDispatchTask(row: DispatchTaskRow): DispatchTask {
  return DispatchTaskResponseSchema.shape.dispatchTask.parse({
    dispatchTaskId: row.dispatchTaskId,
    incidentId: row.incidentId,
    cellId: row.cellId,
    category: row.category,
    quantityApprox: row.quantityApprox,
    ...(row.fromResourceReportId ? { fromResourceReportId: row.fromResourceReportId } : {}),
    ...(row.toResourceReportId ? { toResourceReportId: row.toResourceReportId } : {}),
    ...(row.targetWorkCenterId ? { targetWorkCenterId: row.targetWorkCenterId } : {}),
    status: row.status,
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.sourceChannel ? { sourceChannel: row.sourceChannel } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

async function createConnectedSosAlert(
  db: D1Database,
  incident: IncidentSummary,
  request: SosConnectedCreateRequest,
  membership: IncidentMembershipLookup,
): Promise<SosAlertCreateResponse> {
  const nowIso = new Date().toISOString();
  const timestamp = request.payload.reportedAt ?? nowIso;
  const sosAlertId = `sos_${slug(incident.incidentId)}_${slug(request.channel)}_${slug(request.externalId)}_${slug(timestamp)}`;
  const auditEventId = `audit_sos_created_${slug(incident.incidentId)}_${sosAlertId}`;
  const inserted = await insertSosAlert(db, sosAlertId, incident.incidentId, `connected-${request.channel}`, request.payload, request.channel, null, null, timestamp);

  await db.prepare(
    `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(auditEventId, incident.incidentId, membership.channelIdentityId, membership.incidentMembershipId, 'sos.created', JSON.stringify({ sosAlertId })).run();

  const sosAlert = await getSosAlertById(db, incident.incidentId, sosAlertId);
  if (!sosAlert) {
    throw new Error(`SOS alert was not persisted: ${sosAlertId}`);
  }

  return SosAlertCreateResponseSchema.parse({
    sosAlert,
    fanout: await getSosFanoutStatusForAlert(db, sosAlertId),
    audit: { auditEventId },
    idempotent: !inserted,
  });
}

async function insertSosAlert(
  db: D1Database,
  sosAlertId: string,
  incidentId: string,
  cellId: string,
  payload: SosCreatePayload,
  sourceChannel: Channel,
  sourceOperationId: string | null,
  actorKeyId: string | null,
  timestamp: string,
): Promise<boolean> {
  const insert = await db.prepare(
    `INSERT OR IGNORE INTO sos_alerts (
      sos_alert_id, incident_id, cell_id, severity, message, latitude, longitude, accuracy_meters,
      status, source_channel, source_operation_id, actor_key_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    sosAlertId,
    incidentId,
    cellId,
    payload.severity,
    payload.message ?? null,
    payload.location?.latitude ?? null,
    payload.location?.longitude ?? null,
    payload.location?.accuracyMeters ?? null,
    'open',
    sourceChannel,
    sourceOperationId,
    actorKeyId,
    timestamp,
    timestamp,
  ).run();

  await insertSosEvent(db, `sos_evt_${slug(sourceOperationId ?? sosAlertId)}_created`, sosAlertId, incidentId, 'sos.created', sourceChannel, sourceOperationId, actorKeyId, timestamp, payload);
  await enqueueCriticalFanoutJobs(db, sosAlertId, incidentId, 'sos.created', timestamp, payload);
  return insert.meta.changes > 0;
}

async function cancelSosAlert(
  db: D1Database,
  incidentId: string,
  sosAlertId: string,
  payload: SosCancelPayload,
  sourceChannel: Channel,
  sourceOperationId: string | null,
  actorKeyId: string | null,
  timestamp: string,
): Promise<boolean> {
  const existing = await getSosAlertById(db, incidentId, sosAlertId);
  if (!existing) {
    return false;
  }

  if (existing.status !== 'cancelled') {
    await db.prepare('UPDATE sos_alerts SET status = ?, updated_at = ?, cancelled_at = ?, cancel_reason = ? WHERE incident_id = ? AND sos_alert_id = ?')
      .bind('cancelled', timestamp, timestamp, payload.reason ?? null, incidentId, sosAlertId)
      .run();
    await db.prepare("UPDATE critical_fanout_jobs SET status = ?, updated_at = ? WHERE sos_alert_id = ? AND event_type = 'sos.created' AND status IN ('queued', 'pending')")
      .bind('cancelled', timestamp, sosAlertId)
      .run();
  }

  await insertSosEvent(db, `sos_evt_${slug(sourceOperationId ?? `${sosAlertId}_cancelled`)}_cancelled`, sosAlertId, incidentId, 'sos.cancelled', sourceChannel, sourceOperationId, actorKeyId, timestamp, payload);
  await enqueueCriticalFanoutJobs(db, sosAlertId, incidentId, 'sos.cancelled', timestamp, payload);
  return true;
}

async function insertSosEvent(
  db: D1Database,
  sosEventId: string,
  sosAlertId: string,
  incidentId: string,
  eventType: 'sos.created' | 'sos.cancelled',
  sourceChannel: Channel,
  sourceOperationId: string | null,
  actorKeyId: string | null,
  timestamp: string,
  payload: SosCreatePayload | SosCancelPayload,
): Promise<void> {
  await db.prepare(
    `INSERT OR IGNORE INTO sos_events (sos_event_id, sos_alert_id, incident_id, event_type, source_channel, source_operation_id, actor_key_id, created_at, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(sosEventId, sosAlertId, incidentId, eventType, sourceChannel, sourceOperationId, actorKeyId, timestamp, JSON.stringify(payload)).run();
}

async function enqueueCriticalFanoutJobs(
  db: D1Database,
  sosAlertId: string,
  incidentId: string,
  eventType: 'sos.created' | 'sos.cancelled',
  timestamp: string,
  payload: SosCreatePayload | SosCancelPayload,
): Promise<void> {
  for (const targetChannel of channels) {
    await db.prepare(
      `INSERT OR IGNORE INTO critical_fanout_jobs (fanout_job_id, sos_alert_id, incident_id, event_type, target_channel, status, created_at, updated_at, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      `fanout_${slug(sosAlertId)}_${slug(eventType)}_${slug(targetChannel)}`,
      sosAlertId,
      incidentId,
      eventType,
      targetChannel,
      'queued',
      timestamp,
      timestamp,
      JSON.stringify(payload),
    ).run();
  }
}

async function listSosAlerts(db: D1Database, incidentId: string): Promise<SosAlert[]> {
  const { results } = await db.prepare(sosAlertSelectSql('WHERE incident_id = ? ORDER BY updated_at DESC')).bind(incidentId).all<SosAlertRow>();
  return results.map(rowToSosAlert);
}

async function getSosAlertById(db: D1Database, incidentId: string, sosAlertId: string): Promise<SosAlert | null> {
  const row = await db.prepare(sosAlertSelectSql('WHERE incident_id = ? AND sos_alert_id = ?')).bind(incidentId, sosAlertId).first<SosAlertRow>();
  return row ? rowToSosAlert(row) : null;
}

function sosAlertSelectSql(whereClause: string): string {
  return `SELECT sos_alert_id AS sosAlertId, incident_id AS incidentId, cell_id AS cellId, severity, message,
    latitude, longitude, accuracy_meters AS accuracyMeters, status, source_channel AS sourceChannel,
    source_operation_id AS sourceOperationId, actor_key_id AS actorKeyId, created_at AS createdAt,
    updated_at AS updatedAt, cancelled_at AS cancelledAt, cancel_reason AS cancelReason
    FROM sos_alerts ${whereClause}`;
}

function rowToSosAlert(row: SosAlertRow): SosAlert {
  return SosAlertStatusResponseSchema.shape.sosAlerts.element.parse({
    sosAlertId: row.sosAlertId,
    incidentId: row.incidentId,
    cellId: row.cellId,
    severity: row.severity,
    ...(row.message ? { message: row.message } : {}),
    ...(row.latitude !== null && row.longitude !== null ? { location: { latitude: row.latitude, longitude: row.longitude, ...(row.accuracyMeters !== null ? { accuracyMeters: row.accuracyMeters } : {}) } } : {}),
    status: row.status,
    ...(row.sourceChannel ? { sourceChannel: row.sourceChannel } : {}),
    ...(row.sourceOperationId ? { sourceOperationId: row.sourceOperationId } : {}),
    ...(row.actorKeyId ? { actorKeyId: row.actorKeyId } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.cancelledAt ? { cancelledAt: row.cancelledAt } : {}),
    ...(row.cancelReason ? { cancelReason: row.cancelReason } : {}),
  });
}

async function getSosFanoutStatus(db: D1Database, incidentId: string): Promise<SosFanoutStatus> {
  const { results } = await db.prepare('SELECT status, COUNT(*) AS count FROM critical_fanout_jobs WHERE incident_id = ? GROUP BY status')
    .bind(incidentId)
    .all<{ status: SosFanoutJobStatus; count: number }>();
  return summarizeFanout(results);
}

async function getSosFanoutStatusForAlert(db: D1Database, sosAlertId: string): Promise<SosFanoutStatus> {
  const { results } = await db.prepare('SELECT status, COUNT(*) AS count FROM critical_fanout_jobs WHERE sos_alert_id = ? GROUP BY status')
    .bind(sosAlertId)
    .all<{ status: SosFanoutJobStatus; count: number }>();
  return summarizeFanout(results);
}

function summarizeFanout(rows: { status: SosFanoutJobStatus; count: number }[]): SosFanoutStatus {
  const summary: SosFanoutStatus = { total: 0, queued: 0, pending: 0, failed: 0, cancelled: 0 };
  for (const row of rows) {
    summary[row.status] = row.count;
    summary.total += row.count;
  }
  return summary;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
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
  const joinStateKey = getTelegramConversationStateKey(update);
  const workCenterStateKey = getTelegramWorkCenterConversationStateKey(update);
  const resourceStateKey = getTelegramResourceConversationStateKey(update);
  const dispatchStateKey = getTelegramDispatchConversationStateKey(update);
  const sosStateKey = getTelegramSosConversationStateKey(update);

  if (command === '/start') {
    await deleteTelegramConversationStates(db, [workCenterStateKey, resourceStateKey, dispatchStateKey, sosStateKey]);
    return handleTelegramIncidentJoinConversation(db, update, joinStateKey);
  }

  if (command === '/workcenter') {
    await deleteTelegramConversationStates(db, [resourceStateKey, dispatchStateKey, sosStateKey]);
    return handleTelegramWorkCenterConversation(db, update, workCenterStateKey);
  }

  if (command === '/resource') {
    await deleteTelegramConversationStates(db, [workCenterStateKey, dispatchStateKey, sosStateKey]);
    return handleTelegramResourceConversation(db, update, resourceStateKey);
  }

  if (command === '/dispatch') {
    await deleteTelegramConversationStates(db, [workCenterStateKey, resourceStateKey, sosStateKey]);
    return handleTelegramDispatchConversation(db, update, dispatchStateKey);
  }

  if (command === '/sos') {
    await deleteTelegramConversationStates(db, [workCenterStateKey, resourceStateKey, dispatchStateKey]);
    return handleTelegramSosConversation(db, update, sosStateKey);
  }

  const routedSos = await routeExistingTelegramFlow(
    db,
    sosStateKey,
    safeParseTelegramSosState,
    { step: 'idle' } satisfies TelegramSosState,
    (state) => handleTelegramSosConversation(db, update, sosStateKey, state),
  );
  if (routedSos) {
    return routedSos;
  }

  const routedResource = await routeExistingTelegramFlow(
    db,
    resourceStateKey,
    safeParseTelegramResourceReportState,
    { step: 'idle' } satisfies TelegramResourceReportState,
    (state) => handleTelegramResourceConversation(db, update, resourceStateKey, state),
  );
  if (routedResource) {
    return routedResource;
  }

  const routedDispatch = await routeExistingTelegramFlow(
    db,
    dispatchStateKey,
    safeParseTelegramDispatchTaskState,
    { step: 'idle' } satisfies TelegramDispatchTaskState,
    (state) => handleTelegramDispatchConversation(db, update, dispatchStateKey, state),
  );
  if (routedDispatch) {
    return routedDispatch;
  }

  const routedWorkCenter = await routeExistingTelegramFlow(
    db,
    workCenterStateKey,
    safeParseTelegramWorkCenterReportState,
    { step: 'idle' } satisfies TelegramWorkCenterReportState,
    (state) => handleTelegramWorkCenterConversation(db, update, workCenterStateKey, state),
  );
  if (routedWorkCenter) {
    return routedWorkCenter;
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

async function handleTelegramResourceConversation(
  db: D1Database,
  update: TelegramUpdateLike,
  stateKey: string | null,
  loadedState?: TelegramResourceReportState,
): Promise<string> {
  const currentState = loadedState ?? (stateKey
    ? await loadTelegramConversationState(db, stateKey, safeParseTelegramResourceReportState, { step: 'idle' } satisfies TelegramResourceReportState)
    : ({ step: 'idle' } satisfies TelegramResourceReportState));
  const ports = createTelegramResourceReportPorts(db);
  const result = await handleTelegramResourceReportFlow(currentState, update, ports);

  if (stateKey) {
    if (isTerminalTelegramResourceReportState(result.state) || isPermissionDeniedTelegramResourceResult(currentState, result.responseText)) {
      await deleteTelegramConversationState(db, stateKey);
    } else {
      await persistTelegramConversationState(db, stateKey, result.state);
    }
  }

  return result.responseText;
}

async function handleTelegramDispatchConversation(
  db: D1Database,
  update: TelegramUpdateLike,
  stateKey: string | null,
  loadedState?: TelegramDispatchTaskState,
): Promise<string> {
  const currentState = loadedState ?? (stateKey
    ? await loadTelegramConversationState(db, stateKey, safeParseTelegramDispatchTaskState, { step: 'idle' } satisfies TelegramDispatchTaskState)
    : ({ step: 'idle' } satisfies TelegramDispatchTaskState));
  const ports = createTelegramDispatchTaskPorts(db);
  const result = await handleTelegramDispatchTaskFlow(currentState, update, ports);

  if (stateKey) {
    if (isTerminalLikeTelegramDispatchResult(result.state, result.responseText)) {
      await deleteTelegramConversationState(db, stateKey);
    } else {
      await persistTelegramConversationState(db, stateKey, result.state);
    }
  }

  return result.responseText;
}

async function handleTelegramSosConversation(
  db: D1Database,
  update: TelegramUpdateLike,
  stateKey: string | null,
  loadedState?: TelegramSosState,
): Promise<string> {
  const currentState = loadedState ?? (stateKey
    ? await loadTelegramConversationState(db, stateKey, safeParseTelegramSosState, { step: 'idle' } satisfies TelegramSosState)
    : ({ step: 'idle' } satisfies TelegramSosState));
  const ports = createTelegramSosPorts(db);
  const result = await handleTelegramSosFlow(currentState, update, ports);

  if (stateKey) {
    if (isTerminalLikeTelegramSosResult(result.state, result.responseText)) {
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

function isPermissionDeniedTelegramResourceResult(state: TelegramResourceReportState, responseText: string): boolean {
  return state.step === 'awaitingConfirmation' && responseText.includes('Permission denied');
}

function isTerminalLikeTelegramDispatchResult(state: TelegramDispatchTaskState, responseText: string): boolean {
  return isTerminalTelegramDispatchTaskState(state) || responseText.includes('Permission denied') || responseText.includes('Dispatch task not found');
}

function isTerminalLikeTelegramSosResult(state: TelegramSosState, responseText: string): boolean {
  return isTerminalTelegramSosState(state) || responseText.includes('Permission denied') || responseText.includes('Incident not found');
}

async function routeExistingTelegramFlow<TState extends { step: string }>(
  db: D1Database,
  stateKey: string | null,
  safeParseState: (value: unknown) => { success: true; data: TState } | { success: false; error: Error },
  idleState: TState,
  handle: (state: TState) => Promise<string>,
): Promise<string | null> {
  if (!stateKey) {
    return null;
  }

  const state = await loadTelegramConversationState(db, stateKey, safeParseState, idleState);
  return state.step === 'idle' ? null : handle(state);
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

function createTelegramResourceReportPorts(db: D1Database): TelegramResourceReportPorts {
  return {
    async listIncidents() {
      return IncidentListResponseSchema.parse({ incidents: await listIncidents(db) });
    },
    async createResourceReport(incidentId, request) {
      const incident = await findIncident(db, incidentId);
      if (!incident) {
        throw Object.assign(new Error('not_found'), { error: 'not_found' });
      }

      const membership = await findIncidentMembershipForChannel(db, incident.incidentId, request.channel, request.externalId);
      if (!membership) {
        throw Object.assign(new Error('permission_denied'), { error: 'permission_denied' });
      }

      return ResourceReportCreateResponseSchema.parse(await createConnectedResourceReport(db, incident, request, membership));
    },
  };
}

function createTelegramSosPorts(db: D1Database): TelegramSosPorts {
  return {
    async listIncidents() {
      return IncidentListResponseSchema.parse({ incidents: await listIncidents(db) });
    },
    async createSosAlert(incidentId, request) {
      const incident = await findIncident(db, incidentId);
      if (!incident) {
        throw Object.assign(new Error('not_found'), { error: 'not_found' });
      }

      const membership = await findIncidentMembershipForChannel(db, incident.incidentId, request.channel, request.externalId);
      if (!membership) {
        throw Object.assign(new Error('permission_denied'), { error: 'permission_denied' });
      }

      return SosAlertCreateResponseSchema.parse(await createConnectedSosAlert(db, incident, request, membership));
    },
  };
}

function createTelegramDispatchTaskPorts(db: D1Database): TelegramDispatchTaskPorts {
  return {
    async listIncidents() {
      return IncidentListResponseSchema.parse({ incidents: await listIncidents(db) });
    },
    async listDispatchTasks(incidentId) {
      const incident = await findIncident(db, incidentId);
      if (!incident) {
        throw Object.assign(new Error('not_found'), { error: 'not_found' });
      }

      return DispatchTaskListResponseSchema.parse({ dispatchTasks: await listDispatchTasks(db, incident.incidentId) });
    },
    async updateDispatchTask(incidentId, dispatchTaskId, request) {
      const incident = await findIncident(db, incidentId);
      if (!incident) {
        throw Object.assign(new Error('not_found'), { error: 'not_found' });
      }

      const membership = await findIncidentMembershipForChannel(db, incident.incidentId, request.channel, request.externalId);
      if (!membership) {
        throw Object.assign(new Error('permission_denied'), { error: 'permission_denied' });
      }

      const response = await updateConnectedDispatchTask(db, incident, dispatchTaskId, request, membership);
      if (!response) {
        throw Object.assign(new Error('not_found'), { error: 'not_found' });
      }

      return DispatchTaskResponseSchema.parse(response);
    },
  };
}

function getTelegramConversationStateKey(update: TelegramUpdateLike): string | null {
  return getTelegramConversationBaseStateKey(update);
}

function getTelegramWorkCenterConversationStateKey(update: TelegramUpdateLike): string | null {
  return getTelegramNamespacedConversationStateKey(update, 'workcenter');
}

function getTelegramResourceConversationStateKey(update: TelegramUpdateLike): string | null {
  return getTelegramNamespacedConversationStateKey(update, 'resource');
}

function getTelegramDispatchConversationStateKey(update: TelegramUpdateLike): string | null {
  return getTelegramNamespacedConversationStateKey(update, 'dispatch');
}

function getTelegramSosConversationStateKey(update: TelegramUpdateLike): string | null {
  return getTelegramNamespacedConversationStateKey(update, 'sos');
}

function getTelegramNamespacedConversationStateKey(update: TelegramUpdateLike, flow: 'workcenter' | 'resource' | 'dispatch' | 'sos'): string | null {
  const baseKey = getTelegramConversationBaseStateKey(update);
  return baseKey ? `flow:${flow}:${baseKey}` : null;
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
  state: TelegramIncidentJoinState | TelegramWorkCenterReportState | TelegramResourceReportState | TelegramDispatchTaskState | TelegramSosState,
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

async function deleteTelegramConversationStates(db: D1Database, stateKeys: Array<string | null>): Promise<void> {
  for (const stateKey of stateKeys) {
    if (stateKey) {
      await deleteTelegramConversationState(db, stateKey);
    }
  }
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

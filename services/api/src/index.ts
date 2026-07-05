import { Hono } from 'hono';
import { cors } from 'hono/cors';

import {
  HealthResponseSchema,
  IncidentConfigResponseSchema,
  IncidentJoinRequestSchema,
  FamilyReunificationSearchRequestSchema,
  FamilyReunificationSearchResponseSchema,
  DispatchEventCreatePayloadSchema,
  DispatchEventUpdatePayloadSchema,
  DispatchTaskConnectedCreateRequestSchema,
  DispatchTaskConnectedUpdateRequestSchema,
  DispatchTaskListResponseSchema,
  DispatchTaskResponseSchema,
  type TrustSubject,
  type TrustState,
  type TrustSignalCreateRequest,
  type TrustSignal,
  type DisputeCreateRequest,
  type Dispute,
  TrustStateResponseSchema,
  TrustSubjectSchema,
  TrustSignalCreateResponseSchema,
  TrustSignalCreateRequestSchema,
  DisputeCreateResponseSchema,
  DisputeCreateRequestSchema,
  type DispatchEventCreatePayload,
  type DispatchEventUpdatePayload,
  type DispatchTask,
  type DispatchTaskConnectedCreateRequest,
  type DispatchTaskConnectedUpdateRequest,
  type DispatchTaskStatus,
  IncidentJoinResponseSchema,
  IncidentListResponseSchema,
  CountryListResponseSchema,
  OperationalMapResponseSchema,
  OperationalUpdateActionRequestSchema,
  OperationalUpdateActionResponseSchema,
  OperationalUpdateCorroborateRequestSchema,
  OperationalUpdateDisputeRequestSchema,
  OperationalUpdateLinkRequestSchema,
  OperationalUpdateLinkResponseSchema,
  OperationalUpdatePullResponseSchema,
  OperationalUpdateReasonCodeSchema,
  OperationalEventSchema,
  PendingSignedOperationSchema,
  PrivateWebLinkConsumeRequestSchema,
  PrivateWebLinkConsumeResponseSchema,
  PrivateWebLinkIssueRequestSchema,
  PrivateWebLinkIssueResponseSchema,
  PrivateWebLinkValidateRequestSchema,
  PrivateWebLinkValidateResponseSchema,
  type Channel,
  type ContractErrorCode,
  type FamilyReunificationSearchResponse,
  type IncidentConfigResponse,
  type IncidentJoinResponse,
  type IncidentRole,
  type IncidentSummary,
  type CountryOption,
  type IncidentMapSummary,
  type MapBounds,
  type MapWorkCenterMarker,
  type OperationalMapResponse,
  resolveSupportedLocale,
  type SupportedLocale,
  type OperationalEvent,
  type OperationalEventType,
  type OperationalUpdate,
  type OperationalUpdateActionReceipt,
  type OperationalUpdateActionRequest,
  type OperationalUpdateCorroborateRequest,
  type OperationalUpdateDisputeRequest,
  type OperationalUpdateActionType,
  type OperationalUpdateLinkResponse,
  type OperationalUpdateReasonCode,
  type OperationalUpdateType,
  type OperationalUpdateUrgency,
  type PermissionSnapshot,
  type PendingSignedOperation,
  type PrivateWebLinkConsumeRequest,
  type PrivateWebLinkIssueRequest,
  type PrivateWebLinkIssueResponse,
  type PrivateWebLinkValidateRequest,
  type WebLinkScope,
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
  SyncCursorSchema,
  SyncPullResponseSchema,
  type SyncConflict,
  type SyncCursor,
  type SyncFreshness,
  type SyncPullOperation,
  type SyncPullResponse,
  type SyncPushResponse,
  SyncPushResponseSchema,
  TelegramDispatchIntentFactsSchema,
  TelegramFamilyReunificationIntentFactsSchema,
  TelegramIncidentJoinIntentFactsSchema,
  TelegramResourceIntentFactsSchema,
  TelegramSosIntentFactsSchema,
  TelegramWebhookResultSchema,
  TelegramWorkCenterIntentFactsSchema,
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
  type TelegramIntentClassification,
  type TelegramDispatchIntentFacts,
  type TelegramFamilyReunificationIntentFacts,
  type TelegramIncidentJoinIntentFacts,
  type TelegramResourceIntentFacts,
  type TelegramSosIntentFacts,
  type TelegramWorkCenterIntentFacts,
  type WorkCenterSummary,
} from '@zona-cero/contracts';
import {
  deriveResourceReportState,
  deriveCanonicalTrustState,
  deriveWorkCenterState,
  matchResourceReports,
  normalizeResourceCategory,
  recommendResourceNeeds,
  type ResourceNeedRecommendation,
  type WorkCenterSignalInput,
} from '@zona-cero/domain';
import {
  handleTelegramDispatchTaskFlow,
  handleTelegramFamilyReunificationFlow,
  handleTelegramIncidentJoinFlow,
  handleTelegramOperationalUpdateCommand,
  handleTelegramResourceReportFlow,
  handleTelegramSosFlow,
  handleTelegramWorkCenterReportFlow,
  isTerminalTelegramDispatchTaskState,
  isTerminalTelegramFamilyReunificationState,
  isTerminalTelegramIncidentJoinState,
  isTerminalTelegramResourceReportState,
  isTerminalTelegramSosState,
  isTerminalTelegramWorkCenterReportState,
  resolveTelegramCommand,
  resolveTelegramLocale,
  safeParseTelegramDispatchTaskState,
  safeParseTelegramFamilyReunificationState,
  safeParseTelegramIncidentJoinState,
  safeParseTelegramResourceReportState,
  safeParseTelegramSosState,
  safeParseTelegramWorkCenterReportState,
  type ChannelTelemetryPort,
  type TelegramDispatchTaskPorts,
  type TelegramDispatchTaskState,
  type TelegramFamilyReunificationPorts,
  type TelegramFamilyReunificationState,
  type TelegramIncidentJoinPorts,
  type TelegramIncidentJoinState,
  type TelegramOperationalUpdatePorts,
  type TelegramResourceReportPorts,
  type TelegramResourceReportState,
  type TelegramSosPorts,
  type TelegramSosState,
  type TelegramFlowContext,
  type TelegramUpdateLike,
  type TelegramWorkCenterReportPorts,
  type TelegramWorkCenterReportState,
} from '@zona-cero/telegram-channel';
import { classifyTelegramIntent, resolveTelegramIntentRouterConfig, type TelegramIntentAiBinding } from './telegram-intent-classifier';

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
const familyReunificationSearchLinkTtlSeconds = 15 * 60;
const familyReunificationSearchLinkMaxUses = 1;
const defaultOperationalCellId = 'cell-zc-demo';

const permissionSnapshots: IncidentConfigResponse['permissionSnapshots'] = {
  volunteer: { canReadIncident: true, canJoinIncident: true, canManageIncident: false, canManageLogistics: false, canManageMedical: false },
  coordinator: { canReadIncident: true, canJoinIncident: true, canManageIncident: true, canManageLogistics: true, canManageMedical: true },
  logistics: { canReadIncident: true, canJoinIncident: true, canManageIncident: false, canManageLogistics: true, canManageMedical: false },
  medical: { canReadIncident: true, canJoinIncident: true, canManageIncident: false, canManageLogistics: false, canManageMedical: true },
};

app.use('*', cors());

app.get('/health', (c) => {
  return c.json(HealthResponseSchema.parse({ service: 'zona-cero-api', ok: true, version: c.env.API_VERSION ?? '0.0.0-boilerplate' }));
});

app.get('/incidents', async (c) => {
  const results = await listIncidents(c.env.DB);

  return c.json(IncidentListResponseSchema.parse({ incidents: results }));
});

app.get('/map/countries', async (c) => {
  return c.json(CountryListResponseSchema.parse({ countries: await listMapCountries(c.env.DB) }));
});

app.get('/map', async (c) => {
  const countryCode = normalizeCountryCode(c.req.query('countryCode'));
  if (!countryCode) {
    return c.json({ error: 'invalid_payload', issues: [{ message: 'countryCode must be an ISO 3166-1 alpha-2 code' }] }, 400);
  }

  const response = await getOperationalMap(c.env.DB, countryCode);
  if (!response) {
    return c.json({ error: 'country_not_found' }, 404);
  }

  return c.json(OperationalMapResponseSchema.parse(response));
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

app.post('/incidents/:incidentId/private-links', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = PrivateWebLinkIssueRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  if (parsed.data.scope !== 'family_reunification.search') {
    return c.json({ error: 'invalid_link_scope' }, 400);
  }

  const membership = await findIncidentMembershipWithPermissions(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!membership?.permissions.canReadIncident) {
    return c.json({ error: 'permission_denied' }, 403);
  }

  const response = await issuePrivateWebLink(c.env.DB, incident, parsed.data, membership);
  return c.json(PrivateWebLinkIssueResponseSchema.parse(response));
});

app.post('/private-links/validate', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = PrivateWebLinkValidateRequestSchema.safeParse(body);
  if (!parsed.success) {
    await auditPrivateWebLinkAttempt(c.env.DB, createRejectedAttemptInput(c, body, 'validate', 'invalid_payload'));
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const limit = await checkRateLimit(c.env.DB, {
    scope: 'private_link.validate',
    key: `${parsed.data.fingerprint}:${parsed.data.token.slice(0, 16)}`,
    limit: 20,
    windowSeconds: 60,
    action: 'validate',
  });
  if (!limit.allowed) {
    return c.json({ error: limit.error, resetAt: limit.resetAt }, privateWebLinkErrorStatus(limit.error));
  }

  const result = await validatePrivateWebLink(c.env.DB, c.req.raw, parsed.data, 'validate');
  if (!result.success) {
    return c.json({ error: result.error }, privateWebLinkErrorStatus(result.error));
  }

  return c.json(
    PrivateWebLinkValidateResponseSchema.parse({
      valid: true,
      linkId: result.link.linkId,
      scope: result.link.scope,
      incidentId: result.link.incidentId,
      correlationId: result.link.correlationId,
      expiresAt: result.link.expiresAt,
      remainingUses: Math.max(0, result.link.maxUses - result.link.useCount),
      nextAction: 'in_person_verification',
      audit: { auditEventId: result.auditEventId },
    }),
  );
});

app.post('/private-links/consume', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = PrivateWebLinkConsumeRequestSchema.safeParse(body);
  if (!parsed.success) {
    await auditPrivateWebLinkAttempt(c.env.DB, createRejectedAttemptInput(c, body, 'consume', 'invalid_payload'));
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const result = await consumePrivateWebLink(c.env.DB, c.req.raw, parsed.data);
  if (!result.success) {
    return c.json({ error: result.error }, privateWebLinkErrorStatus(result.error));
  }

  return c.json(
    PrivateWebLinkConsumeResponseSchema.parse({
      accepted: true,
      linkId: result.linkId,
      referral: {
        type: 'in_person_verification',
        reasonCode: 'family_reunification_in_person_verification',
        messageCode: 'family_reunification.referral.in_person_verification',
        message: 'family_reunification.referral.in_person_verification',
      },
      audit: { auditEventId: result.auditEventId },
    }),
  );
});

app.post('/private-links/operational-updates/detail', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = PrivateWebLinkValidateRequestSchema.safeParse(body);
  if (!parsed.success) {
    await auditPrivateWebLinkAttempt(c.env.DB, createRejectedAttemptInput(c, body, 'operational_update.detail', 'invalid_payload'));
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  if (parsed.data.scope !== 'operational_update.detail') {
    return c.json({ error: 'invalid_link_scope' }, 400);
  }

  const validation = await validatePrivateWebLink(c.env.DB, c.req.raw, parsed.data, 'consume');
  if (!validation.success) {
    return c.json({ error: validation.error }, privateWebLinkErrorStatus(validation.error));
  }
  const debit = await debitPrivateWebLinkUse(c.env.DB, c.req.raw, parsed.data, validation, 'consume');
  if (!debit.success) {
    return c.json({ error: debit.error }, privateWebLinkErrorStatus(debit.error));
  }

  const metadata = parseJsonObject(validation.link.metadataJson);
  const nestedMetadata = metadata.metadata && typeof metadata.metadata === 'object' && !Array.isArray(metadata.metadata)
    ? (metadata.metadata as Record<string, unknown>)
    : {};
  const updateId = typeof nestedMetadata.updateId === 'string' ? nestedMetadata.updateId : null;
  if (!updateId) {
    return c.json({ error: 'invalid_payload' }, 400);
  }

  const update = await getOperationalUpdate(c.env.DB, validation.link.incidentId, updateId);
  if (!update) {
    return c.json({ error: 'not_found' }, 404);
  }

  return c.json({
    valid: true,
    linkId: validation.link.linkId,
    scope: validation.link.scope,
    incidentId: validation.link.incidentId,
    correlationId: validation.link.correlationId,
    expiresAt: validation.link.expiresAt,
    update,
    audit: { auditEventId: validation.auditEventId },
  });
});

app.post('/private-links/family-reunification/search', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = FamilyReunificationSearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    await auditPrivateWebLinkAttempt(c.env.DB, createRejectedAttemptInput(c, body, 'family_reunification.search', 'invalid_payload'));
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const turnstile = await verifyTurnstileForRequest(c.env, c.req.raw, {
    action: 'family_reunification.search',
    remoteIp: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? null,
  });
  if (!turnstile.success) {
    await safeRecordOperationalAudit(c.env.DB, {
      eventType: 'security.challenge.required',
      category: 'security',
      result: 'rejected',
      scope: 'family_reunification.search',
      action: 'turnstile',
      subjectRef: parsed.data.fingerprint,
      errorCode: turnstile.error,
    });
    return c.json({ error: turnstile.error }, privateWebLinkErrorStatus(turnstile.error));
  }

  const limit = await checkRateLimit(c.env.DB, {
    scope: 'family_reunification.search',
    key: `${parsed.data.fingerprint}:${parsed.data.correlationId}`,
    limit: 10,
    windowSeconds: 60,
    action: 'family_reunification.search',
  });
  if (!limit.allowed) {
    return c.json({ error: limit.error, resetAt: limit.resetAt }, privateWebLinkErrorStatus(limit.error));
  }

  const result = await validatePrivateWebLink(
    c.env.DB,
    c.req.raw,
    { token: parsed.data.token, scope: 'family_reunification.search', correlationId: parsed.data.correlationId, fingerprint: parsed.data.fingerprint },
    'family_reunification.search',
  );
  if (!result.success) {
    return c.json({ error: result.error }, privateWebLinkErrorStatus(result.error));
  }

  const debit = await debitPrivateWebLinkUse(
    c.env.DB,
    c.req.raw,
    { token: parsed.data.token, scope: 'family_reunification.search', correlationId: parsed.data.correlationId, fingerprint: parsed.data.fingerprint },
    result,
    'family_reunification.search',
  );
  if (!debit.success) {
    return c.json({ error: debit.error }, privateWebLinkErrorStatus(debit.error));
  }

  const response: FamilyReunificationSearchResponse = {
    matches: [
      {
        matchId: `match_${slug(result.link.incidentId)}_referral`,
        status: 'possible_match',
        reasonCode: 'family_reunification.match.family_desk_compare_details',
        ...(parsed.data.query.ageBand ? { ageBand: parsed.data.query.ageBand } : {}),
        ...(parsed.data.query.lastKnownAreaLabel ? { lastKnownAreaLabel: parsed.data.query.lastKnownAreaLabel } : {}),
        verificationRequired: true,
      },
    ],
    referral: {
      type: 'in_person_verification',
      reasonCode: 'family_reunification_in_person_verification',
      messageCode: 'family_reunification.referral.in_person_verification',
      message: 'family_reunification.referral.in_person_verification',
    },
    audit: { auditEventId: result.auditEventId },
  };

  return c.json(FamilyReunificationSearchResponseSchema.parse(response));
});

app.post('/incidents/:incidentId/work-centers', async (c) => {
  const startedAt = Date.now();
  const incidentId = c.req.param('incidentId');
  const incident = await findIncident(c.env.DB, incidentId);

  if (!incident) {
    logOperationEvent({
      channel: null,
      opType: 'work_center.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'not_found',
      latencyMs: Date.now() - startedAt,
    });
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = WorkCenterConnectedCreateRequestSchema.safeParse(body);

  if (!parsed.success) {
    logOperationEvent({
      channel: null,
      opType: 'work_center.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'invalid_payload',
      latencyMs: Date.now() - startedAt,
    });
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
    logOperationEvent({
      channel: null,
      opType: 'resource_report.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'not_found',
      latencyMs: Date.now() - startedAt,
    });
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = ResourceReportConnectedCreateRequestSchema.safeParse(body);

  if (!parsed.success) {
    logOperationEvent({
      channel: null,
      opType: 'resource_report.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'invalid_payload',
      latencyMs: Date.now() - startedAt,
    });
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const membership = await findIncidentMembershipForChannel(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!membership) {
    logOperationEvent({
      channel: parsed.data.channel,
      opType: 'resource_report.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'permission_denied',
      latencyMs: Date.now() - startedAt,
    });
    return c.json({ error: 'permission_denied' }, 403);
  }

  const response = await createConnectedResourceReport(c.env.DB, incident, parsed.data, membership);
  logOperationEvent({
    channel: parsed.data.channel,
    opType: 'resource_report.create',
    opId: null,
    entityId: response.resourceReport.resourceReportId,
    result: 'accepted',
    errorCode: null,
    latencyMs: Date.now() - startedAt,
  });
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
    logOperationEvent({
      channel: null,
      opType: 'dispatch_event.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'not_found',
      latencyMs: Date.now() - startedAt,
    });
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = DispatchTaskConnectedCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    logOperationEvent({
      channel: null,
      opType: 'dispatch_event.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'invalid_payload',
      latencyMs: Date.now() - startedAt,
    });
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const membership = await findIncidentMembershipForChannel(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!membership) {
    logOperationEvent({
      channel: parsed.data.channel,
      opType: 'dispatch_event.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'permission_denied',
      latencyMs: Date.now() - startedAt,
    });
    return c.json({ error: 'permission_denied' }, 403);
  }

  const response = await createConnectedDispatchTask(c.env.DB, incident, parsed.data, membership);
  logOperationEvent({
    channel: parsed.data.channel,
    opType: 'dispatch_event.create',
    opId: null,
    entityId: response.dispatchTask.dispatchTaskId,
    result: 'accepted',
    errorCode: null,
    latencyMs: Date.now() - startedAt,
  });
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
    logOperationEvent({
      channel: null,
      opType: 'sos.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'not_found',
      latencyMs: Date.now() - startedAt,
    });
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = SosConnectedCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    logOperationEvent({
      channel: null,
      opType: 'sos.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'invalid_payload',
      latencyMs: Date.now() - startedAt,
    });
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const membership = await findIncidentMembershipForChannel(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!membership) {
    logOperationEvent({
      channel: parsed.data.channel,
      opType: 'sos.create',
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'permission_denied',
      latencyMs: Date.now() - startedAt,
    });
    return c.json({ error: 'permission_denied' }, 403);
  }

  const response = await createConnectedSosAlert(c.env.DB, incident, parsed.data, membership);
  logOperationEvent({
    channel: parsed.data.channel,
    opType: 'sos.create',
    opId: null,
    entityId: response.sosAlert.sosAlertId,
    result: 'accepted',
    errorCode: null,
    latencyMs: Date.now() - startedAt,
  });
  return c.json(SosAlertCreateResponseSchema.parse(response));
});

app.get('/incidents/:incidentId/sos', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  return c.json(
    SosAlertStatusResponseSchema.parse({
      sosAlerts: await listSosAlerts(c.env.DB, incident.incidentId),
      fanout: await getSosFanoutStatus(c.env.DB, incident.incidentId),
    }),
  );
});



app.post('/incidents/:incidentId/trust-signals', async (c) => {
  const incidentId = c.req.param('incidentId');
  const incident = await findIncident(c.env.DB, incidentId);
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = TrustSignalCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  if (parsed.data.subject.incidentId !== incident.incidentId) {
    return c.json({ error: 'scope_mismatch' }, 400);
  }

  const membership = await findIncidentMembershipForChannel(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!membership) {
    return c.json({ error: 'permission_denied' }, 403);
  }

  const limit = await checkRateLimit(c.env.DB, {
    scope: 'trust_signal.create',
    key: `${incident.incidentId}:${parsed.data.channel}:${parsed.data.externalId}:trust_signal.create`,
    limit: 30,
    windowSeconds: 60,
    incidentId: incident.incidentId,
    channel: parsed.data.channel,
    action: 'trust_signal.create',
  });
  if (!limit.allowed) {
    await recordTrustRejectedAudit(c.env.DB, incident.incidentId, membership, parsed.data.channel, parsed.data.externalId, 'trust_signal.rejected', 'rate_limited', parsed.data.subject);
    return c.json({ error: limit.error, resetAt: limit.resetAt }, 429);
  }

  const response = await createTrustSignal(c.env.DB, incident.incidentId, parsed.data, membership);
  return c.json(TrustSignalCreateResponseSchema.parse(response));
});

app.post('/incidents/:incidentId/disputes', async (c) => {
  const incidentId = c.req.param('incidentId');
  const incident = await findIncident(c.env.DB, incidentId);
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = DisputeCreateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  if (parsed.data.subject.incidentId !== incident.incidentId) {
    return c.json({ error: 'scope_mismatch' }, 400);
  }

  const membership = await findIncidentMembershipForChannel(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!membership) {
    return c.json({ error: 'permission_denied' }, 403);
  }

  const limit = await checkRateLimit(c.env.DB, {
    scope: 'dispute.create',
    key: `${incident.incidentId}:${parsed.data.channel}:${parsed.data.externalId}:dispute.create`,
    limit: 20,
    windowSeconds: 60,
    incidentId: incident.incidentId,
    channel: parsed.data.channel,
    action: 'dispute.create',
  });
  if (!limit.allowed) {
    await recordTrustRejectedAudit(c.env.DB, incident.incidentId, membership, parsed.data.channel, parsed.data.externalId, 'dispute.rejected', 'rate_limited', parsed.data.subject);
    return c.json({ error: limit.error, resetAt: limit.resetAt }, 429);
  }

  const response = await createDispute(c.env.DB, incident.incidentId, parsed.data, membership);
  return c.json(DisputeCreateResponseSchema.parse(response));
});

app.get('/incidents/:incidentId/trust-state', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  const entityType = c.req.query('entityType');
  const entityId = c.req.query('entityId');
  const subjectParse = TrustSubjectSchema.safeParse({ entityType, entityId, incidentId: incident.incidentId });
  if (!subjectParse.success) {
    return c.json({ error: 'invalid_payload', issues: subjectParse.error.issues }, 400);
  }

  const trustState = await getTrustState(c.env.DB, incident.incidentId, subjectParse.data);
  return c.json(TrustStateResponseSchema.parse({ trustState }));
});

app.get('/incidents/:incidentId/cells/:cellId/updates', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  const actor = await resolveOperationalUpdateActor(c.env.DB, incident.incidentId, c.req.query('channel'), c.req.query('externalId'));
  if (!actor.success) {
    return c.json({ error: actor.error }, actor.status);
  }

  const limit = parseOperationalUpdateLimit(c.req.query('limit'));
  if (!limit.valid) {
    return c.json({ error: 'invalid_payload', issues: [{ message: 'limit must be an integer between 1 and 50' }] }, 400);
  }

  const response = await listOperationalUpdates(c.env.DB, incident.incidentId, c.req.param('cellId'), c.req.query('cursor') ?? null, limit.value, actor.actor);
  if (!response.success) {
    return c.json({ error: response.error, message: response.message }, 400);
  }

  return c.json(OperationalUpdatePullResponseSchema.parse(response.body));
});

app.post('/incidents/:incidentId/updates/:updateId/ack', async (c) => {
  return handleOperationalUpdateBasicAction(c.env.DB, c.req.param('incidentId'), c.req.param('updateId'), 'ack', await c.req.json().catch(() => null));
});

app.post('/incidents/:incidentId/updates/:updateId/read', async (c) => {
  return handleOperationalUpdateBasicAction(c.env.DB, c.req.param('incidentId'), c.req.param('updateId'), 'read', await c.req.json().catch(() => null));
});

app.post('/incidents/:incidentId/updates/:updateId/open', async (c) => {
  return handleOperationalUpdateBasicAction(c.env.DB, c.req.param('incidentId'), c.req.param('updateId'), 'open', await c.req.json().catch(() => null));
});

app.post('/incidents/:incidentId/updates/:updateId/corroborate', async (c) => {
  return handleOperationalUpdateCorroborateAction(c.env.DB, c.req.param('incidentId'), c.req.param('updateId'), await c.req.json().catch(() => null));
});

app.post('/incidents/:incidentId/updates/:updateId/dispute', async (c) => {
  return handleOperationalUpdateDisputeAction(c.env.DB, c.req.param('incidentId'), c.req.param('updateId'), await c.req.json().catch(() => null));
});

app.post('/incidents/:incidentId/updates/:updateId/links', async (c) => {
  const incident = await findIncident(c.env.DB, c.req.param('incidentId'));
  if (!incident) {
    return c.json({ error: 'not_found' }, 404);
  }

  const update = await getOperationalUpdate(c.env.DB, incident.incidentId, c.req.param('updateId'));
  if (!update) {
    return c.json({ error: 'not_found' }, 404);
  }

  const parsed = OperationalUpdateLinkRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'invalid_payload', issues: parsed.error.issues }, 400);
  }

  const actor = await resolveOperationalUpdateActor(c.env.DB, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!actor.success) {
    return c.json({ error: actor.error }, actor.status);
  }
  if (!await isOperationalUpdateTargetedToActor(c.env.DB, update, actor.actor)) {
    return c.json({ error: 'permission_denied' }, 403);
  }

  const action = await recordOperationalUpdateAction(c.env.DB, update, 'link', parsed.data);
  const correlationId = `operational_update:${update.updateId}:${parsed.data.idempotencyKey ?? crypto.randomUUID()}`;
  const privateLink = await issuePrivateWebLink(c.env.DB, incident, {
    scope: 'operational_update.detail',
    channel: parsed.data.channel,
    externalId: parsed.data.externalId,
    displayName: parsed.data.displayName,
    correlationId,
    returnState: parsed.data.returnState,
    ttlSeconds: 15 * 60,
    maxUses: 1,
    metadata: { updateId: update.updateId },
  }, actor.actor.membership);
  const params = new URLSearchParams({
    token: privateLink.token,
    scope: privateLink.scope,
    correlationId: privateLink.correlationId,
  });
  const response: OperationalUpdateLinkResponse = {
    update: await getOperationalUpdate(c.env.DB, incident.incidentId, update.updateId, actor.actor) ?? update,
    action,
    link: {
      href: `/operational-updates/private-detail#${params.toString()}`,
      scope: 'operational_update.detail',
      expiresAt: privateLink.expiresAt,
    },
  };

  return c.json(OperationalUpdateLinkResponseSchema.parse(response));
});

app.post('/sync/push', async (c) => {
  const startedAt = Date.now();
  const body = await c.req.json().catch(() => null);
  const response = await handleSyncPushRequest(c.env.DB, body, startedAt);

  if (!response.success) {
    return c.json(response.error, 400);
  }

  return c.json(response.body);
});

app.post('/incidents/:incidentId/cells/:cellId/sync/push', async (c) => {
  const startedAt = Date.now();
  const scope = { incidentId: c.req.param('incidentId'), cellId: c.req.param('cellId') };
  const limit = await checkRateLimit(c.env.DB, {
    scope: 'sync.push',
    key: `${scope.incidentId}:${scope.cellId}:${c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? c.req.header('user-agent') ?? 'unknown'}`,
    limit: 120,
    windowSeconds: 60,
    incidentId: scope.incidentId,
    channel: 'mobile',
    action: 'sync.push',
  });
  if (!limit.allowed) {
    return c.json({ error: limit.error, resetAt: limit.resetAt }, 429);
  }

  const body = await c.req.json().catch(() => null);
  const response = await handleSyncPushRequest(c.env.DB, body, startedAt, scope);

  if (!response.success) {
    return c.json(response.error, 400);
  }

  return c.json(response.body);
});

app.get('/sync/pull', (c) => {
  return c.json({ operations: [], cursor: c.req.query('cursor') ?? null });
});

app.get('/incidents/:incidentId/cells/:cellId/sync/pull', async (c) => {
  const incidentId = c.req.param('incidentId');
  const cellId = c.req.param('cellId');
  const cursor = c.req.query('cursor') ?? null;
  const rawLimit = c.req.query('limit');
  const limit = parseSyncPullLimit(rawLimit);

  if (!limit.valid) {
    return c.json({ error: 'invalid_payload', issues: [{ message: 'limit must be an integer between 1 and 100' }] }, 400);
  }

  const rateLimit = await checkRateLimit(c.env.DB, {
    scope: 'sync.pull',
    key: `${incidentId}:${cellId}:${c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? c.req.header('user-agent') ?? 'unknown'}`,
    limit: 180,
    windowSeconds: 60,
    incidentId,
    channel: 'mobile',
    action: 'sync.pull',
  });
  if (!rateLimit.allowed) {
    return c.json({ error: rateLimit.error, resetAt: rateLimit.resetAt }, 429);
  }

  const response = await handleSyncPullRequest(c.env.DB, incidentId, cellId, cursor, limit.value);

  if (!response.success) {
    return c.json({ error: response.error, message: response.message }, 400);
  }

  return c.json(response.body);
});

app.post('/telegram/webhook', async (c) => {
  if (!(await isTelegramWebhookSecretValid(c.req.raw, c.env.TELEGRAM_WEBHOOK_SECRET_TOKEN))) {
    logStructuredOperationalEvent({
      event: 'security.challenge.required',
      category: 'security',
      result: 'rejected',
      channel: 'telegram',
      scope: 'telegram.delivery',
      action: 'header_auth',
      errorCode: 'permission_denied',
    });
    return c.json({ error: 'permission_denied' }, 403);
  }

  const update = (await c.req.json().catch(() => ({}))) as TelegramUpdateLike;
  const command = resolveTelegramCommand(update);
  const telemetry = createTelegramChannelTelemetrySink();
  const responseText = await handleTelegramConversation(c.env, c.env.DB, update, command, telemetry);
  c.executionCtx.waitUntil(sendTelegramWebhookResponse(c.env, update, responseText));

  return c.json(TelegramWebhookResultSchema.parse({ accepted: true, command, responseText }));
});

async function findIncident(db: D1Database, incidentId: string): Promise<IncidentSummary | null> {
  return db
    .prepare('SELECT incident_id AS incidentId, name, status, starts_at AS startsAt, location_name AS locationName FROM incidents WHERE incident_id = ?')
    .bind(incidentId)
    .first<IncidentSummary>();
}

async function listIncidents(db: D1Database): Promise<IncidentSummary[]> {
  const { results } = await db
    .prepare('SELECT incident_id AS incidentId, name, status, starts_at AS startsAt, location_name AS locationName FROM incidents ORDER BY starts_at DESC')
    .all<IncidentSummary>();

  return results;
}

type SyncPushBodyParseResult = { success: true; data: { operations: unknown[]; cursor?: string | null } } | { success: false; error: { issues: unknown[] } };

type SyncPushOperationResult = SyncPushResponse['results'][number];

type SyncScope = { incidentId: string; cellId: string };

type SyncPushRequestResult = { success: true; body: SyncPushResponse } | { success: false; error: { error: ContractErrorCode; issues: unknown[] } };

type ExistingSyncOperationRow = {
  payloadHash: string;
  status: 'accepted' | 'rejected';
  resultEntityId: string | null;
  serverVersion: number | null;
  serverUpdatedAt: string | null;
  conflictCode: ContractErrorCode | null;
  conflictMessage: string | null;
};

type SyncChangeLogRow = {
  sequence: number;
  opId: string;
  incidentId: string;
  cellId: string;
  entityId: string;
  entityType: string;
  opType: string;
  operationJson: string;
  serverVersion: number;
  serverUpdatedAt: string;
};

type SyncScopeStats = { maxSequence: number; latestServerUpdatedAt: string | null };

type IncidentMembershipLookup = { channelIdentityId: string; incidentMembershipId: string; role: IncidentRole };

type IncidentMembershipWithPermissions = IncidentMembershipLookup & { permissions: PermissionSnapshot };

type OperationalUpdateActor = {
  channel: Channel;
  externalId: string;
  membership: IncidentMembershipWithPermissions;
};

type PrivateWebLinkRow = {
  linkId: string;
  incidentId: string;
  channelIdentityId: string;
  incidentMembershipId: string;
  scope: WebLinkScope;
  tokenHash: string;
  correlationId: string;
  expiresAt: string;
  consumedAt: string | null;
  maxUses: number;
  useCount: number;
  createdAt: string;
  revokedAt: string | null;
  metadataJson: string;
};

type PrivateWebLinkValidationSuccess = { success: true; link: PrivateWebLinkRow; auditEventId: string };

type PrivateWebLinkValidationFailure = { success: false; error: ContractErrorCode };

type RateLimitResult =
  | { allowed: true; count: number; remaining: number; resetAt: string }
  | { allowed: false; count: number; remaining: 0; resetAt: string; error: 'rate_limited' };

type TurnstileResult =
  | { success: true; mode: 'disabled' | 'observe' | 'enforced' }
  | { success: false; mode: 'enforced'; error: 'security_challenge_required' | 'turnstile_failed' };

type OperationalAuditInput = {
  eventType: OperationalEventType;
  category: 'audit' | 'sync' | 'security' | 'rate_limit';
  result: 'accepted' | 'rejected' | 'bypassed';
  incidentId?: string | null;
  channel?: Channel | null;
  scope?: string | null;
  action?: string | null;
  subjectRef?: string | null;
  errorCode?: ContractErrorCode | null;
  metadata?: Record<string, string | number | boolean | null>;
};

type PrivateWebLinkAttemptInput = {
  action: string;
  linkId: string | null;
  incidentId: string | null;
  scope: string | null;
  correlationId: string | null;
  fingerprintHash: string;
  tokenHashPrefix: string | null;
  result: 'accepted' | 'rejected';
  errorCode: ContractErrorCode | null;
  ipHash: string | null;
  userAgentHash: string | null;
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

type WorkCenterSignalRow = { signalId: string; signalType: WorkCenterSignalType; sourceChannel: Channel; sourceId: string; createdAt: string };

type TrustAuditEventRow = { eventType: string; payloadJson: string; createdAt: string };

type TrustAuditEventType = 'trust_signal.accepted' | 'trust_signal.degraded' | 'trust_signal.rejected' | 'dispute.created' | 'dispute.rejected';

type OperationalUpdateRow = {
  updateId: string;
  incidentId: string;
  cellId: string;
  updateType: OperationalUpdateType;
  urgency: OperationalUpdateUrgency;
  title: string;
  summary: string;
  body: string | null;
  sourceKind: OperationalUpdate['source']['kind'];
  sourceEntityId: string | null;
  subjectEntityType: TrustSubject['entityType'] | null;
  subjectEntityId: string | null;
  subjectDisplayRef: string | null;
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

type OperationalUpdateCursor = { incidentId: string; cellId: string; updatedAt: string; updateId: string; issuedAt: string };

type OperationalUpdateSeed = {
  updateId: string;
  incidentId: string;
  cellId: string;
  type: OperationalUpdateType;
  urgency: OperationalUpdateUrgency;
  title: string;
  summary: string;
  body?: string;
  source: OperationalUpdate['source'];
  subject?: TrustSubject;
  reasonCode?: OperationalUpdateReasonCode;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type TelegramNeedRecommendation = {
  incidentId: string;
  incidentName?: string;
  incidentStatus?: IncidentSummary['status'];
  incidentStartsAt?: string;
  incidentLocationName?: string;
  workCenterId?: string;
  workCenterName?: string;
  workCenterLocation?: { latitude: number; longitude: number };
  category: string;
  quantityApprox: string;
  urgency: ResourceReportSummary['urgency'];
  score: number;
  reasons: string[];
};

export type TelegramNeedRecommendationInput = {
  resourceLabel?: string | null;
  resourceType?: string | null;
  incidentId?: string | null;
  limit?: number;
};

type ResourceNeedRecommendationRow = ResourceReportRecommendationRow | WorkCenterInitialNeedRecommendationRow;

type ResourceReportRecommendationRow = ResourceReportRow & {
  incidentName: string | null;
  incidentStatus: IncidentSummary['status'] | null;
  incidentStartsAt: string | null;
  incidentLocationName: string | null;
  workCenterName: string | null;
  workCenterLatitude: number | null;
  workCenterLongitude: number | null;
};

type WorkCenterInitialNeedRecommendationRow = ResourceReportRow & {
  incidentName: string | null;
  incidentStatus: IncidentSummary['status'] | null;
  incidentStartsAt: string | null;
  incidentLocationName: string | null;
  workCenterName: string;
  workCenterLatitude: number | null;
  workCenterLongitude: number | null;
  initialNeed: string;
  workCenterPriority: WorkCenterPriority;
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

type ExistingDispatchTaskCreateRow = DispatchTaskRow & { sourceOperationId: string | null };

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

type MapIncidentRow = {
  incidentId: string;
  name: string;
  status: IncidentSummary['status'];
  startsAt: string;
  locationName: string;
  countryCode: string;
  countryName: string;
  latitude: number | null;
  longitude: number | null;
};

type CountryOptionRow = {
  countryCode: string;
  countryName: string;
  incidentCount: number;
  markerCount: number;
};

function normalizeCountryCode(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

async function listMapCountries(db: D1Database): Promise<CountryOption[]> {
  const { results } = await db
    .prepare(
      `SELECT i.country_code AS countryCode, i.country_name AS countryName, COUNT(DISTINCT i.incident_id) AS incidentCount,
        (
          COUNT(DISTINCT CASE WHEN i.latitude IS NOT NULL AND i.longitude IS NOT NULL THEN i.incident_id END)
          + COUNT(DISTINCT CASE WHEN wc.latitude IS NOT NULL AND wc.longitude IS NOT NULL THEN wc.work_center_id END)
        ) AS markerCount
       FROM incidents i
       LEFT JOIN work_centers wc ON wc.incident_id = i.incident_id
       WHERE i.country_code IS NOT NULL AND i.country_name IS NOT NULL
       GROUP BY i.country_code, i.country_name
       ORDER BY i.country_name ASC`,
    )
    .all<CountryOptionRow>();

  return results.map((row) => ({
    countryCode: row.countryCode,
    countryName: row.countryName,
    incidentCount: Number(row.incidentCount),
    markerCount: Number(row.markerCount),
  }));
}

async function getOperationalMap(db: D1Database, countryCode: string): Promise<OperationalMapResponse | null> {
  const incidents = await listMapIncidents(db, countryCode);
  const countryName = incidents[0]?.countryName ?? (await findCountryName(db, countryCode));

  if (!countryName) {
    return null;
  }

  const workCenters = await listMapWorkCenterMarkers(db, countryCode);
  const sosAlertCount = await countMapSosAlerts(db, countryCode);
  const withoutLocation = await countMapItemsWithoutLocation(db, countryCode);
  // Public map payloads intentionally reduce location precision for operational privacy.
  const publicIncidents = incidents.map((incident) => ({ ...incident, location: toPublicMapLocation(incident.location) }));
  const publicWorkCenters = workCenters.map((marker) => ({ ...marker, location: toPublicMapLocation(marker.location) }));
  const points = [...publicIncidents.map((incident) => incident.location), ...publicWorkCenters.map((marker) => marker.location)];

  return OperationalMapResponseSchema.parse({
    countryCode,
    countryName,
    ...(points.length > 0 ? { bounds: calculateMapBounds(points) } : {}),
    incidents: publicIncidents,
    workCenters: publicWorkCenters,
    sosAlerts: [],
    counts: {
      incidents: incidents.length,
      workCenters: workCenters.length,
      sosAlerts: sosAlertCount,
      withoutLocation,
    },
  });
}

async function findCountryName(db: D1Database, countryCode: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT country_name AS countryName FROM incidents WHERE country_code = ? AND country_name IS NOT NULL LIMIT 1')
    .bind(countryCode)
    .first<{ countryName: string }>();
  return row?.countryName ?? null;
}

async function listMapIncidents(db: D1Database, countryCode: string): Promise<IncidentMapSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT incident_id AS incidentId, name, status, starts_at AS startsAt, location_name AS locationName,
        country_code AS countryCode, country_name AS countryName, latitude, longitude
       FROM incidents
       WHERE country_code = ? AND country_name IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
       ORDER BY starts_at DESC`,
    )
    .bind(countryCode)
    .all<MapIncidentRow>();

  return results.map((row) => ({
    incidentId: row.incidentId,
    name: row.name,
    status: row.status,
    startsAt: row.startsAt,
    locationName: row.locationName,
    countryCode: row.countryCode,
    countryName: row.countryName,
    location: { latitude: Number(row.latitude), longitude: Number(row.longitude) },
  }));
}

async function listMapWorkCenterMarkers(db: D1Database, countryCode: string): Promise<MapWorkCenterMarker[]> {
  const { results } = await db
    .prepare(
      `SELECT wc.work_center_id AS workCenterId, wc.incident_id AS incidentId, wc.name, wc.priority, wc.status,
        wc.latitude, wc.longitude, wc.updated_at AS updatedAt
       FROM work_centers wc
       INNER JOIN incidents i ON i.incident_id = wc.incident_id
       WHERE i.country_code = ? AND wc.latitude IS NOT NULL AND wc.longitude IS NOT NULL
       ORDER BY wc.updated_at DESC`,
    )
    .bind(countryCode)
    .all<Pick<WorkCenterRow, 'workCenterId' | 'incidentId' | 'name' | 'priority' | 'status' | 'latitude' | 'longitude' | 'updatedAt'>>();

  return results.map((row) => ({
    markerId: `work_center:${row.workCenterId}`,
    type: 'work_center',
    workCenterId: row.workCenterId,
    incidentId: row.incidentId,
    name: row.name,
    priority: row.priority,
    status: row.status,
    location: { latitude: Number(row.latitude), longitude: Number(row.longitude) },
    updatedAt: row.updatedAt,
  }));
}

async function countMapSosAlerts(db: D1Database, countryCode: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(DISTINCT sa.sos_alert_id) AS sosAlertCount
       FROM incidents i
       INNER JOIN sos_alerts sa ON sa.incident_id = i.incident_id
       WHERE i.country_code = ?`,
    )
    .bind(countryCode)
    .first<{ sosAlertCount: number | null }>();

  return Number(row?.sosAlertCount ?? 0);
}

async function countMapItemsWithoutLocation(db: D1Database, countryCode: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT
        COUNT(DISTINCT CASE WHEN i.latitude IS NULL OR i.longitude IS NULL THEN i.incident_id END)
        + COUNT(DISTINCT CASE WHEN wc.latitude IS NULL OR wc.longitude IS NULL THEN wc.work_center_id END)
        + COUNT(DISTINCT CASE WHEN sa.latitude IS NULL OR sa.longitude IS NULL THEN sa.sos_alert_id END) AS withoutLocation
       FROM incidents i
       LEFT JOIN work_centers wc ON wc.incident_id = i.incident_id
       LEFT JOIN sos_alerts sa ON sa.incident_id = i.incident_id
       WHERE i.country_code = ?`,
    )
    .bind(countryCode)
    .first<{ withoutLocation: number | null }>();

  return Number(row?.withoutLocation ?? 0);
}

function toPublicMapLocation(point: { latitude: number; longitude: number }): { latitude: number; longitude: number } {
  return { latitude: roundCoordinate(point.latitude), longitude: roundCoordinate(point.longitude) };
}

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculateMapBounds(points: Array<{ latitude: number; longitude: number }>): MapBounds {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  return {
    northEast: { latitude: Math.max(...latitudes), longitude: Math.max(...longitudes) },
    southWest: { latitude: Math.min(...latitudes), longitude: Math.min(...longitudes) },
  };
}

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

async function handleSyncPushRequest(db: D1Database, body: unknown, startedAt: number, scope?: SyncScope): Promise<SyncPushRequestResult> {
  const parsed = parseSyncPushBody(body);

  if (!parsed.success) {
    logOperationEvent({
      channel: null,
      opType: null,
      opId: null,
      entityId: null,
      result: 'rejected',
      errorCode: 'invalid_payload',
      latencyMs: Date.now() - startedAt,
    });
    return { success: false, error: { error: 'invalid_payload', issues: parsed.error.issues } };
  }

  const response: SyncPushResponse = { results: [] };

  for (const rawOperation of parsed.data.operations) {
    const result = await handleSyncPushOperation(db, rawOperation, startedAt, scope);
    response.results.push(result);
  }

  return { success: true, body: SyncPushResponseSchema.parse(response) };
}

function parseSyncPullLimit(rawLimit: string | undefined): { valid: true; value: number } | { valid: false } {
  if (rawLimit === undefined) {
    return { valid: true, value: 50 };
  }

  if (!/^\d+$/.test(rawLimit)) {
    return { valid: false };
  }

  const value = Number(rawLimit);
  return Number.isInteger(value) && value >= 1 && value <= 100 ? { valid: true, value } : { valid: false };
}

async function handleSyncPullRequest(
  db: D1Database,
  incidentId: string,
  cellId: string,
  encodedCursor: string | null,
  limit: number,
): Promise<{ success: true; body: SyncPullResponse } | { success: false; error: ContractErrorCode; message: string }> {
  const decodedCursor = decodeSyncCursor(encodedCursor);

  if (!decodedCursor.success) {
    return { success: false, error: 'stale_cursor', message: decodedCursor.message };
  }

  if (decodedCursor.cursor && (decodedCursor.cursor.incidentId !== incidentId || decodedCursor.cursor.cellId !== cellId)) {
    return { success: false, error: 'scope_mismatch', message: 'cursor scope does not match request scope' };
  }

  const cursorSequence = decodedCursor.cursor?.sequence ?? 0;
  const rows = await listSyncChanges(db, incidentId, cellId, cursorSequence, limit);
  const lastSequence = rows.at(-1)?.sequence ?? cursorSequence;
  const nextCursor = rows.length > 0 ? encodeSyncCursor({ incidentId, cellId, sequence: lastSequence, issuedAt: new Date().toISOString() }) : encodedCursor;
  const stats = await getSyncScopeStats(db, incidentId, cellId);
  const cursorLag = Math.max(0, stats.maxSequence - lastSequence);
  const conflicts = await listSyncConflicts(db, incidentId, cellId);
  const freshness = buildSyncFreshness(stats, cursorLag, conflicts.length > 0);
  const operations: SyncPullOperation[] = rows.map((row) => {
    const operation = JSON.parse(row.operationJson) as PendingSignedOperation;
    return {
      sequence: row.sequence,
      serverVersion: row.serverVersion,
      serverUpdatedAt: row.serverUpdatedAt,
      operation: { ...operation, syncState: 'confirmed' },
    };
  });

  return { success: true, body: SyncPullResponseSchema.parse({ operations, cursor: nextCursor, hasMore: cursorLag > 0, freshness, conflicts }) };
}

async function handleSyncPushOperation(db: D1Database, rawOperation: unknown, startedAt: number, scope?: SyncScope): Promise<SyncPushOperationResult> {
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

  if (scope && (parsed.data.incidentId !== scope.incidentId || parsed.data.cellId !== scope.cellId)) {
    return rejectOperation(parsed.data, startedAt, 'scope_mismatch', {
      opId: parsed.data.opId,
      entityId: parsed.data.entityId,
      entityType: parsed.data.entityType,
      code: 'scope_mismatch',
      message: 'operation scope does not match endpoint scope',
    });
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

  if (parsed.data.opType === 'trust_signal.create') {
    return handleTrustSignalSyncOperation(db, parsed.data, startedAt);
  }

  if (parsed.data.opType === 'dispute.create') {
    return handleDisputeSyncOperation(db, parsed.data, startedAt);
  }

  if (parsed.data.opType !== 'work_center.create') {
    const payloadHash = await hashJson({ operation: parsed.data });
    const existing = await resolveExistingSyncOperation(db, parsed.data, payloadHash, startedAt);
    return existing ?? acceptSyncOperation(db, parsed.data, payloadHash, startedAt);
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
  const existing = await resolveExistingSyncOperation(db, parsed.data, payloadHash, startedAt);
  if (existing) {
    return existing;
  }

  const existingWorkCenter = await db
    .prepare('SELECT source_operation_id AS sourceOperationId FROM work_centers WHERE work_center_id = ?')
    .bind(parsed.data.entityId)
    .first<{ sourceOperationId: string | null }>();

  if (existingWorkCenter && existingWorkCenter.sourceOperationId !== parsed.data.opId) {
    await recordSyncOperation(db, parsed.data, payloadHash, 'rejected', 'operation_conflict', 'entity already exists with another source operation');
    return rejectOperation(parsed.data, startedAt, 'operation_conflict', {
      opId: parsed.data.opId,
      entityId: parsed.data.entityId,
      entityType: parsed.data.entityType,
      code: 'operation_conflict',
      message: 'entity already exists with another source operation',
    });
  }

  await materializeWorkCenterCreateOperation(db, incident, parsed.data, payload.data);
  return acceptSyncOperation(db, parsed.data, payloadHash, startedAt);
}

async function handleResourceReportCreateSyncOperation(db: D1Database, operation: PendingSignedOperation, startedAt: number): Promise<SyncPushOperationResult> {
  const payload = ResourceReportPayloadSchema.safeParse(operation.payload);
  if (!payload.success) {
    logOperationEvent({
      channel: 'mobile',
      opType: operation.opType,
      opId: operation.opId,
      entityId: operation.entityId,
      result: 'rejected',
      errorCode: 'invalid_payload',
      latencyMs: Date.now() - startedAt,
    });
    return { opId: operation.opId, status: 'rejected', code: 'invalid_payload' };
  }

  const incident = await findIncident(db, operation.incidentId);
  if (!incident) {
    logOperationEvent({
      channel: 'mobile',
      opType: operation.opType,
      opId: operation.opId,
      entityId: operation.entityId,
      result: 'rejected',
      errorCode: 'not_found',
      latencyMs: Date.now() - startedAt,
    });
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
    await recordSyncOperation(db, operation, payloadHash, 'rejected', 'operation_conflict', 'entity already exists with another source operation');
    return rejectOperation(operation, startedAt, 'operation_conflict', {
      opId: operation.opId,
      entityId: operation.entityId,
      entityType: operation.entityType,
      code: 'operation_conflict',
      message: 'entity already exists with another source operation',
    });
  }

  await materializeResourceReportCreateOperation(db, operation, payload.data, 'mobile');
  return acceptSyncOperation(db, operation, payloadHash, startedAt);
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
        await recordSyncOperation(db, operation, payloadHash, 'rejected', 'operation_conflict', 'dispatch task create conflicts with existing entity');
        return rejectOperation(operation, startedAt, 'operation_conflict', {
          opId: operation.opId,
          entityId: operation.entityId,
          entityType: operation.entityType,
          code: 'operation_conflict',
          message: 'dispatch task create conflicts with existing entity',
        });
      }

      return acceptSyncOperation(db, operation, payloadHash, startedAt);
    }

    await materializeDispatchTaskCreateOperation(db, operation, createPayload.data, 'mobile');
  } else if (updatePayload?.success) {
    const updated = await materializeDispatchTaskUpdateOperation(db, operation, updatePayload.data, 'mobile');
    if (!updated) {
      await recordSyncOperation(db, operation, payloadHash, 'rejected', 'not_found', 'dispatch task was not found for update');
      return rejectOperation(operation, startedAt, 'not_found');
    }
  }

  return acceptSyncOperation(db, operation, payloadHash, startedAt);
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
        await recordSyncOperation(db, operation, payloadHash, 'rejected', 'operation_conflict', 'SOS alert already exists with another source operation');
        return rejectOperation(operation, startedAt, 'operation_conflict', {
          opId: operation.opId,
          entityId: operation.entityId,
          entityType: operation.entityType,
          code: 'operation_conflict',
          message: 'SOS alert already exists with another source operation',
        });
      }

      return acceptSyncOperation(db, operation, payloadHash, startedAt);
    }

    await insertSosAlert(
      db,
      operation.entityId,
      operation.incidentId,
      operation.cellId,
      createPayload.data,
      'mobile',
      operation.opId,
      operation.actorKeyId,
      createPayload.data.reportedAt ?? operation.createdAtDevice,
    );
  } else if (cancelPayload?.success) {
    const cancelled = await cancelSosAlert(
      db,
      operation.incidentId,
      operation.entityId,
      cancelPayload.data,
      'mobile',
      operation.opId,
      operation.actorKeyId,
      cancelPayload.data.cancelledAt ?? operation.createdAtDevice,
    );
    if (!cancelled) {
      await recordSyncOperation(db, operation, payloadHash, 'rejected', 'not_found', 'SOS alert was not found for cancellation');
      return rejectOperation(operation, startedAt, 'not_found');
    }
  }

  return acceptSyncOperation(db, operation, payloadHash, startedAt);
}


async function handleTrustSignalSyncOperation(db: D1Database, operation: PendingSignedOperation, startedAt: number): Promise<SyncPushOperationResult> {
  const payloadHash = await hashJson({ operation });
  const existing = await resolveExistingSyncOperation(db, operation, payloadHash, startedAt);
  if (existing) {
    return existing;
  }

  const payload = TrustSignalCreateRequestSchema.safeParse(operation.payload);
  if (!payload.success) {
    return rejectAndRecordSyncOperation(db, operation, payloadHash, startedAt, 'invalid_payload', 'trust signal sync payload is invalid');
  }

  const incident = await findIncident(db, operation.incidentId);
  if (!incident) {
    return rejectAndRecordSyncOperation(db, operation, payloadHash, startedAt, 'not_found', 'incident was not found');
  }

  if (payload.data.subject.incidentId !== incident.incidentId) {
    return rejectAndRecordSyncOperation(db, operation, payloadHash, startedAt, 'scope_mismatch', 'trust signal subject does not match operation incident', {
      opId: operation.opId,
      entityId: operation.entityId,
      entityType: operation.entityType,
      code: 'scope_mismatch',
      message: 'trust signal subject does not match operation incident',
    });
  }

  const membership = await findIncidentMembershipForChannel(db, incident.incidentId, payload.data.channel, payload.data.externalId);
  if (!membership) {
    return rejectAndRecordSyncOperation(db, operation, payloadHash, startedAt, 'permission_denied', 'actor is not an incident member');
  }

  const limit = await checkRateLimit(db, {
    scope: 'trust_signal.create',
    key: `${incident.incidentId}:${payload.data.channel}:${payload.data.externalId}:trust_signal.create`,
    limit: 30,
    windowSeconds: 60,
    incidentId: incident.incidentId,
    channel: payload.data.channel,
    action: 'trust_signal.create',
  });
  if (!limit.allowed) {
    await recordTrustRejectedAudit(db, incident.incidentId, membership, payload.data.channel, payload.data.externalId, 'trust_signal.rejected', 'rate_limited', payload.data.subject);
    return rejectAndRecordSyncOperation(db, operation, payloadHash, startedAt, 'rate_limited', 'trust signal sync actor is rate limited');
  }

  const response = await createTrustSignal(db, incident.incidentId, payload.data, membership);
  return acceptSyncOperation(db, operation, payloadHash, startedAt, response.trustSignal.trustSignalId, { ...payload.data, trustState: response.trustState });
}

async function handleDisputeSyncOperation(db: D1Database, operation: PendingSignedOperation, startedAt: number): Promise<SyncPushOperationResult> {
  const payloadHash = await hashJson({ operation });
  const existing = await resolveExistingSyncOperation(db, operation, payloadHash, startedAt);
  if (existing) {
    return existing;
  }

  const payload = DisputeCreateRequestSchema.safeParse(operation.payload);
  if (!payload.success) {
    return rejectAndRecordSyncOperation(db, operation, payloadHash, startedAt, 'invalid_payload', 'dispute sync payload is invalid');
  }

  const incident = await findIncident(db, operation.incidentId);
  if (!incident) {
    return rejectAndRecordSyncOperation(db, operation, payloadHash, startedAt, 'not_found', 'incident was not found');
  }

  if (payload.data.subject.incidentId !== incident.incidentId) {
    return rejectAndRecordSyncOperation(db, operation, payloadHash, startedAt, 'scope_mismatch', 'dispute subject does not match operation incident', {
      opId: operation.opId,
      entityId: operation.entityId,
      entityType: operation.entityType,
      code: 'scope_mismatch',
      message: 'dispute subject does not match operation incident',
    });
  }

  const membership = await findIncidentMembershipForChannel(db, incident.incidentId, payload.data.channel, payload.data.externalId);
  if (!membership) {
    return rejectAndRecordSyncOperation(db, operation, payloadHash, startedAt, 'permission_denied', 'actor is not an incident member');
  }

  const limit = await checkRateLimit(db, {
    scope: 'dispute.create',
    key: `${incident.incidentId}:${payload.data.channel}:${payload.data.externalId}:dispute.create`,
    limit: 20,
    windowSeconds: 60,
    incidentId: incident.incidentId,
    channel: payload.data.channel,
    action: 'dispute.create',
  });
  if (!limit.allowed) {
    await recordTrustRejectedAudit(db, incident.incidentId, membership, payload.data.channel, payload.data.externalId, 'dispute.rejected', 'rate_limited', payload.data.subject);
    return rejectAndRecordSyncOperation(db, operation, payloadHash, startedAt, 'rate_limited', 'dispute sync actor is rate limited');
  }

  const response = await createDispute(db, incident.incidentId, payload.data, membership);
  return acceptSyncOperation(db, operation, payloadHash, startedAt, response.dispute.disputeId, { ...payload.data, trustState: response.trustState });
}

async function rejectAndRecordSyncOperation(
  db: D1Database,
  operation: PendingSignedOperation,
  payloadHash: string,
  startedAt: number,
  code: ContractErrorCode,
  message: string,
  conflict?: SyncConflict,
): Promise<SyncPushOperationResult> {
  await recordSyncOperation(db, operation, payloadHash, 'rejected', code, message);
  return rejectOperation(operation, startedAt, code, conflict);
}

async function resolveExistingSyncOperation(
  db: D1Database,
  operation: PendingSignedOperation,
  payloadHash: string,
  startedAt: number,
): Promise<SyncPushOperationResult | null> {
  const existingOperation = await db
    .prepare(
      `SELECT payload_hash AS payloadHash, status, result_entity_id AS resultEntityId,
              server_version AS serverVersion, server_updated_at AS serverUpdatedAt,
              conflict_code AS conflictCode, conflict_message AS conflictMessage
       FROM sync_operations
       WHERE op_id = ?`,
    )
    .bind(operation.opId)
    .first<ExistingSyncOperationRow>();

  if (!existingOperation) {
    return null;
  }

  const result = existingOperation.payloadHash === payloadHash && existingOperation.status === 'accepted' ? 'accepted' : 'rejected';
  const errorCode = result === 'accepted' ? null : 'operation_conflict';
  logOperationEvent({
    channel: 'mobile',
    opType: operation.opType,
    opId: operation.opId,
    entityId: operation.entityId,
    result,
    errorCode,
    latencyMs: Date.now() - startedAt,
  });
  return result === 'accepted'
    ? {
        opId: operation.opId,
        status: 'accepted',
        entityId: existingOperation.resultEntityId ?? operation.entityId,
        ...(existingOperation.serverVersion ? { serverVersion: existingOperation.serverVersion } : {}),
        ...(existingOperation.serverUpdatedAt ? { serverUpdatedAt: existingOperation.serverUpdatedAt } : {}),
      }
    : {
        opId: operation.opId,
        status: 'rejected',
        code: 'operation_conflict',
        conflict: {
          opId: operation.opId,
          entityId: operation.entityId,
          entityType: operation.entityType,
          code: 'operation_conflict',
          message: 'opId already exists with a different payload hash',
        },
      };
}

function rejectOperation(operation: PendingSignedOperation, startedAt: number, code: ContractErrorCode, conflict?: SyncConflict): SyncPushOperationResult {
  logOperationEvent({
    channel: 'mobile',
    opType: operation.opType,
    opId: operation.opId,
    entityId: operation.entityId,
    result: 'rejected',
    errorCode: code,
    latencyMs: Date.now() - startedAt,
  });
  return { opId: operation.opId, status: 'rejected', code, ...(conflict ? { conflict } : {}) };
}

function encodeSyncCursor(cursor: SyncCursor): string {
  return btoa(JSON.stringify(SyncCursorSchema.parse(cursor)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function decodeSyncCursor(encodedCursor: string | null): { success: true; cursor: SyncCursor | null } | { success: false; message: string } {
  if (!encodedCursor) {
    return { success: true, cursor: null };
  }

  try {
    const padded = encodedCursor.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encodedCursor.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded)) as unknown;
    const parsed = SyncCursorSchema.safeParse(decoded);

    if (!parsed.success) {
      return { success: false, message: 'cursor payload is invalid' };
    }

    return { success: true, cursor: parsed.data };
  } catch {
    return { success: false, message: 'cursor is not a valid sync cursor' };
  }
}

async function listSyncChanges(db: D1Database, incidentId: string, cellId: string, afterSequence: number, limit: number): Promise<SyncChangeLogRow[]> {
  const { results } = await db
    .prepare(
      `SELECT sequence, op_id AS opId, incident_id AS incidentId, cell_id AS cellId, entity_id AS entityId,
              entity_type AS entityType, op_type AS opType, operation_json AS operationJson,
              server_version AS serverVersion, server_updated_at AS serverUpdatedAt
       FROM sync_change_log
       WHERE incident_id = ? AND cell_id = ? AND sequence > ?
       ORDER BY sequence ASC
       LIMIT ?`,
    )
    .bind(incidentId, cellId, afterSequence, limit)
    .all<SyncChangeLogRow>();

  return results;
}

async function getSyncScopeStats(db: D1Database, incidentId: string, cellId: string): Promise<SyncScopeStats> {
  const row = await db
    .prepare(
      `SELECT COALESCE(MAX(sequence), 0) AS maxSequence, MAX(server_updated_at) AS latestServerUpdatedAt
       FROM sync_change_log
       WHERE incident_id = ? AND cell_id = ?`,
    )
    .bind(incidentId, cellId)
    .first<SyncScopeStats>();

  return row ?? { maxSequence: 0, latestServerUpdatedAt: null };
}

async function listSyncConflicts(db: D1Database, incidentId: string, cellId: string): Promise<SyncConflict[]> {
  const { results } = await db
    .prepare(
      `SELECT op_id AS opId, entity_id AS entityId, entity_type AS entityType, conflict_code AS code,
              conflict_message AS message, server_version AS serverVersion, server_updated_at AS serverUpdatedAt
       FROM sync_operations
       WHERE incident_id = ? AND cell_id = ? AND status = 'rejected' AND conflict_code IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    .bind(incidentId, cellId)
    .all<SyncConflict>();

  return results.map((conflict) => ({
    opId: conflict.opId,
    entityId: conflict.entityId,
    entityType: conflict.entityType,
    code: conflict.code,
    ...(conflict.message ? { message: conflict.message } : {}),
    ...(conflict.serverVersion ? { serverVersion: conflict.serverVersion } : {}),
    ...(conflict.serverUpdatedAt ? { serverUpdatedAt: conflict.serverUpdatedAt } : {}),
  }));
}

function buildSyncFreshness(stats: SyncScopeStats, cursorLag: number, hasConflicts: boolean): SyncFreshness {
  const nowMs = Date.now();
  const lastSyncedAt = stats.latestServerUpdatedAt;
  const lastSyncedMs = lastSyncedAt ? Date.parse(lastSyncedAt) : Number.NaN;
  const ageMs = Number.isFinite(lastSyncedMs) ? nowMs - lastSyncedMs : Number.POSITIVE_INFINITY;
  const status = !lastSyncedAt
    ? 'missing'
    : ageMs > 24 * 60 * 60 * 1000
      ? 'expired'
      : ageMs > 15 * 60 * 1000 || cursorLag > 0 || hasConflicts
        ? 'stale'
        : 'fresh';
  const lastFreshAt = status === 'missing' ? null : lastSyncedAt;

  return {
    status,
    lastFreshAt,
    lastSyncedAt,
    cursorLag,
    hasConflicts,
    channels: [{ channel: 'mobile', status, lastFreshAt, lastSyncedAt, cursorLag, hasConflicts }],
  };
}

async function getIncidentSyncFreshness(db: D1Database, incidentId: string): Promise<SyncFreshness> {
  const cellIds = await listIncidentSyncCellIds(db, incidentId);
  const scopedFreshness = await Promise.all(
    (cellIds.length > 0 ? cellIds : [defaultOperationalCellId]).map((cellId) => getScopedSyncFreshness(db, incidentId, cellId)),
  );

  return aggregateSyncFreshness(scopedFreshness);
}

async function listIncidentSyncCellIds(db: D1Database, incidentId: string): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT cell_id AS cellId FROM sync_change_log WHERE incident_id = ?
       UNION
       SELECT cell_id AS cellId FROM sync_operations WHERE incident_id = ?
       ORDER BY cellId ASC`,
    )
    .bind(incidentId, incidentId)
    .all<{ cellId: string }>();

  return results.map((row) => row.cellId).filter(Boolean);
}

async function getScopedSyncFreshness(db: D1Database, incidentId: string, cellId: string): Promise<SyncFreshness> {
  const stats = await getSyncScopeStats(db, incidentId, cellId);
  const conflicts = await listSyncConflicts(db, incidentId, cellId);
  return buildSyncFreshness(stats, 0, conflicts.length > 0);
}

function aggregateSyncFreshness(scopedFreshness: SyncFreshness[]): SyncFreshness {
  const [first, ...rest] = scopedFreshness;
  const worst = rest.reduce((current, candidate) => (
    syncFreshnessRank(candidate.status) > syncFreshnessRank(current.status) ? candidate : current
  ), first);

  return {
    ...worst,
    cursorLag: scopedFreshness.reduce((sum, freshness) => sum + freshness.cursorLag, 0),
    hasConflicts: scopedFreshness.some((freshness) => freshness.hasConflicts),
    channels: scopedFreshness.flatMap((freshness) => freshness.channels),
  };
}

function syncFreshnessRank(status: SyncFreshness['status']): number {
  if (status === 'expired') return 3;
  if (status === 'stale') return 2;
  if (status === 'missing') return 1;
  return 0;
}

async function getExistingDispatchTaskForCreate(db: D1Database, incidentId: string, dispatchTaskId: string): Promise<ExistingDispatchTaskCreateRow | null> {
  const row = await db
    .prepare(dispatchTaskSelectSql('WHERE incident_id = ? AND dispatch_task_id = ?'))
    .bind(incidentId, dispatchTaskId)
    .first<ExistingDispatchTaskCreateRow>();
  return row ?? null;
}

function isConflictingDispatchTaskCreate(
  existing: ExistingDispatchTaskCreateRow,
  operation: PendingSignedOperation,
  payload: DispatchEventCreatePayload,
): boolean {
  if (existing.sourceOperationId !== operation.opId) {
    return true;
  }

  return (
    existing.incidentId !== operation.incidentId ||
    existing.cellId !== operation.cellId ||
    existing.category !== payload.category ||
    existing.quantityApprox !== payload.quantityApprox ||
    existing.fromResourceReportId !== (payload.fromResourceReportId ?? null) ||
    existing.toResourceReportId !== (payload.toResourceReportId ?? null) ||
    existing.targetWorkCenterId !== (payload.targetWorkCenterId ?? null) ||
    existing.status !== (payload.status ?? 'pending') ||
    existing.notes !== (payload.notes ?? null)
  );
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

async function acceptSyncOperation(
  db: D1Database,
  operation: PendingSignedOperation,
  payloadHash: string,
  startedAt: number,
  resultEntityId: string = operation.entityId,
  confirmedPayload: unknown = operation.payload,
): Promise<SyncPushOperationResult> {
  const metadata = await recordSyncOperation(db, operation, payloadHash, 'accepted', null, null, resultEntityId, confirmedPayload);
  logOperationEvent({
    channel: 'mobile',
    opType: operation.opType,
    opId: operation.opId,
    entityId: operation.entityId,
    result: 'accepted',
    errorCode: null,
    latencyMs: Date.now() - startedAt,
  });
  return {
    opId: operation.opId,
    status: 'accepted',
    entityId: resultEntityId,
    serverVersion: metadata.serverVersion,
    serverUpdatedAt: metadata.serverUpdatedAt,
  };
}

async function recordSyncOperation(
  db: D1Database,
  operation: PendingSignedOperation,
  payloadHash: string,
  status: 'accepted' | 'rejected',
  conflictCode: ContractErrorCode | null = null,
  conflictMessage: string | null = null,
  resultEntityId: string = operation.entityId,
  confirmedPayload: unknown = operation.payload,
): Promise<{ serverVersion: number; serverUpdatedAt: string }> {
  const serverUpdatedAt = new Date().toISOString();
  let serverVersion = 0;

  if (status === 'accepted') {
    const change = await db
      .prepare(
        `INSERT INTO sync_change_log (
           incident_id, cell_id, op_id, entity_id, entity_type, op_type, operation_json, server_updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        operation.incidentId,
        operation.cellId,
        operation.opId,
        resultEntityId,
        operation.entityType,
        operation.opType,
        JSON.stringify({ ...operation, entityId: resultEntityId, payload: confirmedPayload, syncState: 'confirmed' }),
        serverUpdatedAt,
      )
      .run();
    serverVersion = Number(change.meta.last_row_id);
    await db.prepare('UPDATE sync_change_log SET server_version = ? WHERE sequence = ?').bind(serverVersion, serverVersion).run();
  }

  await db
    .prepare(
      `INSERT INTO sync_operations (
         op_id, incident_id, cell_id, entity_id, entity_type, op_type, version, payload_hash, payload_json,
         status, result_entity_id, server_version, server_updated_at, conflict_code, conflict_message
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      operation.opId,
      operation.incidentId,
      operation.cellId,
      operation.entityId,
      operation.entityType,
      operation.opType,
      operation.version,
      payloadHash,
      JSON.stringify(operation),
      status,
      resultEntityId,
      serverVersion || null,
      status === 'accepted' ? serverUpdatedAt : null,
      conflictCode,
      conflictMessage,
    )
    .run();

  return { serverVersion, serverUpdatedAt };
}

async function findIncidentMembershipForChannel(
  db: D1Database,
  incidentId: string,
  channel: Channel,
  externalId: string,
): Promise<IncidentMembershipLookup | null> {
  return db
    .prepare(
      `SELECT ci.channel_identity_id AS channelIdentityId, im.incident_membership_id AS incidentMembershipId, im.role
       FROM channel_identities ci
       JOIN incident_memberships im ON im.channel_identity_id = ci.channel_identity_id
       WHERE im.incident_id = ? AND ci.channel = ? AND ci.external_id = ?
       ORDER BY im.created_at ASC
       LIMIT 1`,
    )
    .bind(incidentId, channel, externalId)
    .first<IncidentMembershipLookup>();
}

async function findIncidentMembershipWithPermissions(
  db: D1Database,
  incidentId: string,
  channel: Channel,
  externalId: string,
): Promise<IncidentMembershipWithPermissions | null> {
  const row = await db
    .prepare(
      `SELECT ci.channel_identity_id AS channelIdentityId, im.incident_membership_id AS incidentMembershipId, im.role, im.permissions_json AS permissionsJson
       FROM channel_identities ci
       JOIN incident_memberships im ON im.channel_identity_id = ci.channel_identity_id
       WHERE im.incident_id = ? AND ci.channel = ? AND ci.external_id = ?
       ORDER BY im.created_at ASC
       LIMIT 1`,
    )
    .bind(incidentId, channel, externalId)
    .first<IncidentMembershipLookup & { permissionsJson: string }>();

  if (!row) {
    return null;
  }

  return {
    channelIdentityId: row.channelIdentityId,
    incidentMembershipId: row.incidentMembershipId,
    role: row.role,
    permissions: parsePermissionSnapshot(row.permissionsJson),
  };
}

function parsePermissionSnapshot(value: string): PermissionSnapshot {
  try {
    const parsed = JSON.parse(value) as Partial<PermissionSnapshot>;
    return {
      canReadIncident: parsed.canReadIncident === true,
      canJoinIncident: parsed.canJoinIncident === true,
      canManageIncident: parsed.canManageIncident === true,
      canManageLogistics: parsed.canManageLogistics === true,
      canManageMedical: parsed.canManageMedical === true,
    };
  } catch {
    return { canReadIncident: false, canJoinIncident: false, canManageIncident: false, canManageLogistics: false, canManageMedical: false };
  }
}

async function issuePrivateWebLink(
  db: D1Database,
  incident: IncidentSummary,
  request: PrivateWebLinkIssueRequest,
  membership: IncidentMembershipLookup,
): Promise<PrivateWebLinkIssueResponse> {
  const effectiveRequest = applyPrivateWebLinkIssuePolicy(request);
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + effectiveRequest.ttlSeconds * 1000).toISOString();
  const token = generateSecureToken();
  const tokenHash = await hashString(token);
  const linkId = `pwl_${slug(incident.incidentId)}_${crypto.randomUUID()}`;
  const auditEventId = `audit_private_link_issued_${slug(linkId)}`;

  await db.prepare(
    `INSERT INTO private_web_links (
      link_id, incident_id, channel_identity_id, incident_membership_id, scope, token_hash, correlation_id,
      expires_at, max_uses, created_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    linkId,
    incident.incidentId,
    membership.channelIdentityId,
    membership.incidentMembershipId,
    effectiveRequest.scope,
    tokenHash,
    effectiveRequest.correlationId,
    expiresAt,
    effectiveRequest.maxUses,
    nowIso,
    JSON.stringify({
      returnState: effectiveRequest.returnState ?? null,
      displayName: effectiveRequest.displayName ?? null,
      ...(effectiveRequest.metadata ? { metadata: effectiveRequest.metadata } : {}),
    }),
  ).run();

  await db.prepare(
    `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    auditEventId,
    incident.incidentId,
    membership.channelIdentityId,
    membership.incidentMembershipId,
    'private_web_link.issued',
    JSON.stringify({
      linkId,
      scope: effectiveRequest.scope,
      correlationId: effectiveRequest.correlationId,
      returnState: effectiveRequest.returnState ?? null,
      expiresAt,
      maxUses: effectiveRequest.maxUses,
    }),
  ).run();

  return PrivateWebLinkIssueResponseSchema.parse({
    linkId,
    token,
    scope: effectiveRequest.scope,
    incidentId: incident.incidentId,
    correlationId: effectiveRequest.correlationId,
    ...(effectiveRequest.returnState ? { returnState: effectiveRequest.returnState } : {}),
    expiresAt,
    maxUses: effectiveRequest.maxUses,
    audit: { auditEventId },
  });
}

function applyPrivateWebLinkIssuePolicy(request: PrivateWebLinkIssueRequest): PrivateWebLinkIssueRequest {
  if (request.scope !== 'family_reunification.search') {
    return request;
  }

  return { ...request, ttlSeconds: Math.min(request.ttlSeconds, familyReunificationSearchLinkTtlSeconds), maxUses: familyReunificationSearchLinkMaxUses };
}

async function validatePrivateWebLink(
  db: D1Database,
  request: Request,
  payload: PrivateWebLinkValidateRequest,
  action: 'validate' | 'consume' | 'family_reunification.search',
): Promise<PrivateWebLinkValidationSuccess | PrivateWebLinkValidationFailure> {
  const tokenHash = await hashString(payload.token);
  const fingerprintHash = await hashString(payload.fingerprint);
  const rateLimited = await isPrivateWebLinkRateLimited(db, fingerprintHash, tokenHash);
  if (rateLimited) {
    await safeRecordOperationalAudit(db, {
      eventType: 'rate_limit.checked',
      category: 'rate_limit',
      result: 'rejected',
      scope: 'private_link.validate',
      action,
      subjectRef: fingerprintHash,
      errorCode: 'rate_limited',
    });
    await auditPrivateWebLinkAttempt(
      db,
      await createAttemptInputFromRequest(request, {
        action,
        tokenHash,
        fingerprint: payload.fingerprint,
        result: 'rejected',
        errorCode: 'rate_limited',
        scope: payload.scope,
        correlationId: payload.correlationId,
      }),
    );
    return { success: false, error: 'rate_limited' };
  }

  const link = await findPrivateWebLinkByTokenHash(db, tokenHash);
  const nowIso = new Date().toISOString();
  const error = getPrivateWebLinkValidationError(link, payload, nowIso);
  if (error) {
    await auditPrivateWebLinkAttempt(
      db,
      await createAttemptInputFromRequest(request, {
        action,
        tokenHash,
        fingerprint: payload.fingerprint,
        result: 'rejected',
        errorCode: error,
        link,
        scope: payload.scope,
        correlationId: payload.correlationId,
      }),
    );
    return { success: false, error };
  }

  const activeLink = link;
  if (!activeLink) {
    return { success: false, error: 'permission_denied' };
  }

  const auditEventId = await auditPrivateWebLinkAttempt(
    db,
    await createAttemptInputFromRequest(request, {
      action,
      tokenHash,
      fingerprint: payload.fingerprint,
      result: 'accepted',
      errorCode: null,
      link: activeLink,
      scope: payload.scope,
      correlationId: payload.correlationId,
    }),
  );

  return { success: true, link: activeLink, auditEventId };
}

async function consumePrivateWebLink(
  db: D1Database,
  request: Request,
  payload: PrivateWebLinkConsumeRequest,
): Promise<{ success: true; linkId: string; auditEventId: string } | PrivateWebLinkValidationFailure> {
  const validation = await validatePrivateWebLink(db, request, payload, 'consume');
  if (!validation.success) {
    return validation;
  }

  const debit = await debitPrivateWebLinkUse(db, request, payload, validation, 'consume');

  if (!debit.success) {
    return debit;
  }

  return { success: true, linkId: validation.link.linkId, auditEventId: validation.auditEventId };
}

async function debitPrivateWebLinkUse(
  db: D1Database,
  request: Request,
  payload: PrivateWebLinkValidateRequest,
  validation: PrivateWebLinkValidationSuccess,
  action: 'consume' | 'family_reunification.search',
): Promise<{ success: true } | PrivateWebLinkValidationFailure> {
  const nowIso = new Date().toISOString();
  const update = await db.prepare(
    `UPDATE private_web_links
     SET use_count = use_count + 1,
       consumed_at = CASE WHEN use_count + 1 >= max_uses THEN ? ELSE consumed_at END
     WHERE link_id = ?
       AND revoked_at IS NULL
       AND consumed_at IS NULL
       AND expires_at > ?
       AND use_count < max_uses`,
    )
    .bind(nowIso, validation.link.linkId, nowIso)
    .run();

  if (update.meta.changes === 0) {
    const tokenHash = await hashString(payload.token);
    await auditPrivateWebLinkAttempt(
      db,
      await createAttemptInputFromRequest(request, {
        action,
        tokenHash,
        fingerprint: payload.fingerprint,
        result: 'rejected',
        errorCode: 'link_expired',
        link: validation.link,
        scope: payload.scope,
        correlationId: payload.correlationId,
      }),
    );
    return { success: false, error: 'link_expired' };
  }

  return { success: true };
}

async function findPrivateWebLinkByTokenHash(db: D1Database, tokenHash: string): Promise<PrivateWebLinkRow | null> {
  return db
    .prepare(
      `SELECT link_id AS linkId, incident_id AS incidentId, channel_identity_id AS channelIdentityId,
      incident_membership_id AS incidentMembershipId, scope, token_hash AS tokenHash, correlation_id AS correlationId,
      expires_at AS expiresAt, consumed_at AS consumedAt, max_uses AS maxUses, use_count AS useCount,
      created_at AS createdAt, revoked_at AS revokedAt, metadata_json AS metadataJson
     FROM private_web_links
     WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .first<PrivateWebLinkRow>();
}

function getPrivateWebLinkValidationError(link: PrivateWebLinkRow | null, payload: PrivateWebLinkValidateRequest, nowIso: string): ContractErrorCode | null {
  if (!link) {
    return 'permission_denied';
  }

  if (link.scope !== payload.scope) {
    return 'invalid_link_scope';
  }

  if (link.correlationId !== payload.correlationId) {
    return 'link_correlation_mismatch';
  }

  if (link.revokedAt || link.consumedAt || link.expiresAt <= nowIso || link.useCount >= link.maxUses) {
    return 'link_expired';
  }

  return null;
}

async function isPrivateWebLinkRateLimited(db: D1Database, fingerprintHash: string, tokenHash: string): Promise<boolean> {
  const tokenHashPrefix = tokenHash.slice(0, 16);
  const fingerprintAttempts = await db
    .prepare(
      `SELECT COUNT(*) AS count
     FROM private_web_link_attempts
     WHERE fingerprint_hash = ? AND result = 'rejected' AND created_at >= datetime('now', '-15 minutes')`,
    )
    .bind(fingerprintHash)
    .first<{ count: number }>();
  const tokenAttempts = await db
    .prepare(
      `SELECT COUNT(*) AS count
     FROM private_web_link_attempts
     WHERE token_hash_prefix = ? AND result = 'rejected' AND created_at >= datetime('now', '-15 minutes')`,
    )
    .bind(tokenHashPrefix)
    .first<{ count: number }>();

  return (fingerprintAttempts?.count ?? 0) >= 5 || (tokenAttempts?.count ?? 0) >= 5;
}

function privateWebLinkErrorStatus(error: ContractErrorCode): 400 | 403 | 410 | 429 {
  if (error === 'permission_denied' || error === 'security_challenge_required' || error === 'turnstile_failed') {
    return 403;
  }

  if (error === 'rate_limited') {
    return 429;
  }

  if (error === 'link_expired') {
    return 410;
  }

  return 400;
}

function generateSecureToken(): string {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return Array.from(tokenBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createAttemptInputFromRequest(
  request: Request,
  input: {
    action: string;
    tokenHash: string;
    fingerprint: string;
    result: 'accepted' | 'rejected';
    errorCode: ContractErrorCode | null;
    link?: PrivateWebLinkRow | null;
    scope?: WebLinkScope;
    correlationId?: string;
  },
): Promise<PrivateWebLinkAttemptInput> {
  return {
    action: input.action,
    linkId: input.link?.linkId ?? null,
    incidentId: input.link?.incidentId ?? null,
    scope: input.link?.scope ?? input.scope ?? null,
    correlationId: input.link?.correlationId ?? input.correlationId ?? null,
    fingerprintHash: await hashString(input.fingerprint),
    tokenHashPrefix: input.tokenHash.slice(0, 16),
    result: input.result,
    errorCode: input.errorCode,
    ipHash: await hashOptionalHeader(request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')),
    userAgentHash: await hashOptionalHeader(request.headers.get('user-agent')),
  };
}

function createRejectedAttemptInput(c: { req: { raw: Request } }, body: unknown, action: string, errorCode: ContractErrorCode) {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const fingerprint = typeof raw.fingerprint === 'string' ? raw.fingerprint : 'missing-fingerprint';
  const token = typeof raw.token === 'string' ? raw.token : 'missing-token';
  const scope = typeof raw.scope === 'string' && isWebLinkScope(raw.scope) ? raw.scope : null;
  const correlationId = typeof raw.correlationId === 'string' ? raw.correlationId : null;

  return createAttemptInputFromRequest(c.req.raw, {
    action,
    tokenHash: '',
    fingerprint,
    result: 'rejected',
    errorCode,
    scope: scope ?? undefined,
    correlationId: correlationId ?? undefined,
  }).then(async (input) => ({ ...input, tokenHashPrefix: typeof raw.token === 'string' ? (await hashString(token)).slice(0, 16) : null }));
}

async function auditPrivateWebLinkAttempt(db: D1Database, inputOrPromise: PrivateWebLinkAttemptInput | Promise<PrivateWebLinkAttemptInput>): Promise<string> {
  const input = await inputOrPromise;
  const attemptId = `attempt_${crypto.randomUUID()}`;
  await db
    .prepare(
      `INSERT INTO private_web_link_attempts (
      attempt_id, link_id, incident_id, scope, correlation_id, fingerprint_hash, token_hash_prefix,
      result, error_code, ip_hash, user_agent_hash, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      attemptId,
      input.linkId,
      input.incidentId,
      input.scope,
      input.correlationId,
      input.fingerprintHash,
      input.tokenHashPrefix,
      input.result,
      input.errorCode,
      input.ipHash,
      input.userAgentHash,
      JSON.stringify({ action: input.action }),
    )
    .run();
  await safeRecordOperationalAudit(db, {
    eventType: 'private_link.attempted',
    category: 'security',
    result: input.result,
    incidentId: input.incidentId,
    scope: input.scope,
    action: input.action,
    subjectRef: input.fingerprintHash,
    errorCode: input.errorCode,
  });
  return attemptId;
}

async function hashOptionalHeader(value: string | null): Promise<string | null> {
  return value ? hashString(value) : null;
}

function isWebLinkScope(value: string): value is WebLinkScope {
  return value === 'incident.join' || value === 'work_center.detail' || value === 'family_reunification.search' || value === 'operational_update.detail';
}



function defaultTrustSignalSourceKind(signalType: TrustSignalCreateRequest['signalType']): TrustSignal['sourceKind'] {
  if (signalType === 'self_declaration') return 'self';
  if (signalType === 'context_corroboration') return 'system_context';
  if (signalType === 'reputation_reference' || signalType === 'negative_report') return 'peer';
  return 'field_actor';
}

async function createTrustSignal(
  db: D1Database,
  incidentId: string,
  request: TrustSignalCreateRequest,
  membership: IncidentMembershipLookup,
): Promise<{ trustSignal: TrustSignal; trustState: TrustState; audit: { auditEventId: string }; idempotent: boolean }> {
  const createdAt = request.occurredAt ?? new Date().toISOString();
  const sourceKind = request.sourceKind ?? defaultTrustSignalSourceKind(request.signalType);
  const trustSignalId = `ts_${slug(incidentId)}_${slug(request.subject.entityType)}_${slug(request.subject.entityId)}_${slug(request.channel)}_${slug(request.externalId)}_${slug(request.signalType)}_${slug(request.reason ?? 'none')}`;
  const eventType: TrustAuditEventType = request.signalType === 'negative_report' ? 'trust_signal.degraded' : 'trust_signal.accepted';
  const auditEventId = `audit_${eventType.replace(/\./g, '_')}_${trustSignalId}`;
  const trustSignal = TrustSignalCreateResponseSchema.shape.trustSignal.parse({
    trustSignalId,
    incidentId,
    subject: request.subject,
    signalType: request.signalType,
    sourceKind,
    sourceChannel: request.channel,
    sourceExternalId: request.externalId,
    ...(request.reason ? { reason: request.reason } : {}),
    confidence: request.confidence ?? (request.signalType === 'self_declaration' ? 0.4 : 0.7),
    createdAt,
    ...(request.evidenceRef ? { evidenceRef: request.evidenceRef } : {}),
    ...(request.metadata ? { metadata: request.metadata } : {}),
  });

  const insert = await db.prepare(
    `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    auditEventId,
    incidentId,
    membership.channelIdentityId,
    membership.incidentMembershipId,
    eventType,
    JSON.stringify({ trustSignal }),
  ).run();

  await safeRecordOperationalAudit(db, {
    eventType: 'operational.audit.recorded',
    category: 'audit',
    result: 'accepted',
    incidentId,
    channel: request.channel,
    scope: 'trust_signal',
    action: request.signalType === 'negative_report' ? 'degraded' : 'accepted',
    subjectRef: `${request.subject.entityType}:${request.subject.entityId}`,
  });

  if (insert.meta.changes > 0) {
    const publicTrustSignalRef = await publicOperationalRef('trust_signal', trustSignal.trustSignalId);
    const publicSubjectRef = await publicOperationalRef(request.subject.entityType, request.subject.entityId);
    await upsertOperationalUpdate(db, {
      updateId: `upd_${publicTrustSignalRef}`,
      incidentId,
      cellId: defaultOperationalCellId,
      type: request.signalType === 'negative_report' ? 'dispute' : 'trust_signal',
      urgency: request.signalType === 'negative_report' ? 'high' : 'medium',
      title: request.signalType === 'negative_report' ? 'Trust signal needs review' : 'Trust signal received',
      summary: request.signalType === 'negative_report' ? 'A negative trust signal was recorded for an operational subject.' : 'A trust signal was recorded for an operational subject.',
      source: { kind: 'trust_signal', entityId: publicTrustSignalRef },
      subject: { ...request.subject, entityId: publicSubjectRef },
      createdAt,
      updatedAt: createdAt,
      metadata: { signalType: request.signalType },
    });
  }

  return { trustSignal, trustState: await getTrustState(db, incidentId, request.subject), audit: { auditEventId }, idempotent: insert.meta.changes === 0 };
}

async function createDispute(
  db: D1Database,
  incidentId: string,
  request: DisputeCreateRequest,
  membership: IncidentMembershipLookup,
): Promise<{ dispute: Dispute; trustState: TrustState; audit: { auditEventId: string }; idempotent: boolean }> {
  const createdAt = request.occurredAt ?? new Date().toISOString();
  const disputeId = `disp_${slug(incidentId)}_${slug(request.subject.entityType)}_${slug(request.subject.entityId)}_${slug(request.channel)}_${slug(request.externalId)}_${slug(request.reason)}`;
  const auditEventId = `audit_dispute_created_${disputeId}`;
  const dispute = DisputeCreateResponseSchema.shape.dispute.parse({
    disputeId,
    incidentId,
    subject: request.subject,
    reason: request.reason,
    sourceChannel: request.channel,
    sourceExternalId: request.externalId,
    ...(request.description ? { description: request.description } : {}),
    createdAt,
    ...(request.metadata ? { metadata: request.metadata } : {}),
  });

  const insert = await db.prepare(
    `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    auditEventId,
    incidentId,
    membership.channelIdentityId,
    membership.incidentMembershipId,
    'dispute.created',
    JSON.stringify({ dispute }),
  ).run();

  await safeRecordOperationalAudit(db, {
    eventType: 'operational.audit.recorded',
    category: 'audit',
    result: 'accepted',
    incidentId,
    channel: request.channel,
    scope: 'dispute',
    action: 'created',
    subjectRef: `${request.subject.entityType}:${request.subject.entityId}`,
  });

  if (insert.meta.changes > 0) {
    const publicDisputeRef = await publicOperationalRef('dispute', dispute.disputeId);
    const publicSubjectRef = await publicOperationalRef(request.subject.entityType, request.subject.entityId);
    await upsertOperationalUpdate(db, {
      updateId: `upd_${publicDisputeRef}`,
      incidentId,
      cellId: defaultOperationalCellId,
      type: 'dispute',
      urgency: 'high',
      title: 'Dispute requires review',
      summary: 'A dispute was recorded for an operational subject.',
      source: { kind: 'dispute', entityId: publicDisputeRef },
      subject: { ...request.subject, entityId: publicSubjectRef },
      createdAt,
      updatedAt: createdAt,
      metadata: { reason: request.reason },
    });
  }

  return { dispute, trustState: await getTrustState(db, incidentId, request.subject), audit: { auditEventId }, idempotent: insert.meta.changes === 0 };
}

async function recordTrustRejectedAudit(
  db: D1Database,
  incidentId: string,
  membership: IncidentMembershipLookup,
  channel: Channel,
  externalId: string,
  eventType: TrustAuditEventType,
  errorCode: ContractErrorCode,
  subject: TrustSubject,
): Promise<void> {
  await db.prepare(
    `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    `audit_${eventType.replace(/\./g, '_')}_${slug(incidentId)}_${slug(channel)}_${slug(externalId)}_${slug(errorCode)}_${crypto.randomUUID()}`,
    incidentId,
    membership.channelIdentityId,
    membership.incidentMembershipId,
    eventType,
    JSON.stringify({ subject, channel, externalId, errorCode }),
  ).run();
}

async function getTrustState(db: D1Database, incidentId: string, subject: TrustSubject): Promise<TrustState> {
  const rows = await listTrustAuditEvents(db, incidentId);
  const signals: TrustSignal[] = [];
  const disputes: Dispute[] = [];

  for (const row of rows) {
    const parsed = parseTrustAuditPayload(row.payloadJson);
    if (parsed.trustSignal && isSameTrustSubject(parsed.trustSignal.subject, subject)) {
      signals.push(parsed.trustSignal);
    }
    if (parsed.dispute && isSameTrustSubject(parsed.dispute.subject, subject)) {
      disputes.push(parsed.dispute);
    }
  }

  return deriveCanonicalTrustState({ incidentId, subject, signals, disputes });
}

async function listTrustAuditEvents(db: D1Database, incidentId: string): Promise<TrustAuditEventRow[]> {
  const { results } = await db.prepare(
    `SELECT event_type AS eventType, payload_json AS payloadJson, created_at AS createdAt
     FROM audit_events
     WHERE incident_id = ? AND event_type IN ('trust_signal.accepted', 'trust_signal.degraded', 'dispute.created')
     ORDER BY created_at ASC`,
  ).bind(incidentId).all<TrustAuditEventRow>();
  return results;
}

function parseTrustAuditPayload(payloadJson: string): { trustSignal?: TrustSignal; dispute?: Dispute } {
  try {
    const payload = JSON.parse(payloadJson) as { trustSignal?: unknown; dispute?: unknown };
    const signal = TrustSignalCreateResponseSchema.shape.trustSignal.safeParse(payload.trustSignal);
    if (signal.success) {
      return { trustSignal: signal.data };
    }
    const dispute = DisputeCreateResponseSchema.shape.dispute.safeParse(payload.dispute);
    if (dispute.success) {
      return { dispute: dispute.data };
    }
  } catch {
    return {};
  }
  return {};
}

function parseOperationalUpdateLimit(rawLimit: string | undefined): { valid: true; value: number } | { valid: false } {
  if (rawLimit === undefined) {
    return { valid: true, value: 25 };
  }

  if (!/^\d+$/.test(rawLimit)) {
    return { valid: false };
  }

  const value = Number(rawLimit);
  return Number.isInteger(value) && value >= 1 && value <= 50 ? { valid: true, value } : { valid: false };
}

function encodeOperationalUpdateCursor(cursor: OperationalUpdateCursor): string {
  return btoa(JSON.stringify(cursor))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

function decodeOperationalUpdateCursor(encodedCursor: string | null): { success: true; cursor: OperationalUpdateCursor | null } | { success: false; message: string } {
  if (!encodedCursor) {
    return { success: true, cursor: null };
  }

  try {
    const padded = encodedCursor.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encodedCursor.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded)) as Partial<OperationalUpdateCursor>;
    if (
      typeof decoded.incidentId !== 'string'
      || typeof decoded.cellId !== 'string'
      || typeof decoded.updatedAt !== 'string'
      || typeof decoded.updateId !== 'string'
      || typeof decoded.issuedAt !== 'string'
    ) {
      return { success: false, message: 'cursor payload is invalid' };
    }

    return { success: true, cursor: decoded as OperationalUpdateCursor };
  } catch {
    return { success: false, message: 'cursor is not a valid update cursor' };
  }
}

async function listOperationalUpdates(
  db: D1Database,
  incidentId: string,
  cellId: string,
  encodedCursor: string | null,
  limit: number,
  actor: OperationalUpdateActor,
): Promise<{ success: true; body: { updates: OperationalUpdate[]; cursor: string | null; hasMore: boolean } } | { success: false; error: ContractErrorCode; message: string }> {
  const decodedCursor = decodeOperationalUpdateCursor(encodedCursor);
  if (!decodedCursor.success) {
    return { success: false, error: 'stale_cursor', message: decodedCursor.message };
  }
  if (decodedCursor.cursor && (decodedCursor.cursor.incidentId !== incidentId || decodedCursor.cursor.cellId !== cellId)) {
    return { success: false, error: 'scope_mismatch', message: 'cursor scope does not match request scope' };
  }

  const cursor = decodedCursor.cursor;
  const actorHash = await hashString(`${actor.channel}:${actor.externalId}`);
  const audienceAndDeliverySql = `AND EXISTS (
      SELECT 1
      FROM operational_update_audiences aud
      WHERE aud.update_id = operational_updates.update_id
        AND aud.incident_id = ?
        AND aud.cell_id = ?
        AND (aud.channel IS NULL OR aud.channel = ?)
        AND (aud.role IS NULL OR aud.role = ?)
    )
    AND EXISTS (
      SELECT 1
      FROM operational_update_deliveries del
      WHERE del.update_id = operational_updates.update_id
        AND del.incident_id = ?
        AND del.channel = ?
        AND (del.target_hash IS NULL OR del.target_hash = ?)
    )`;
  const query = cursor
    ? `${operationalUpdateSelectSql()} WHERE incident_id = ? AND cell_id = ? ${audienceAndDeliverySql} AND (updated_at < ? OR (updated_at = ? AND update_id < ?)) ORDER BY updated_at DESC, update_id DESC LIMIT ?`
    : `${operationalUpdateSelectSql()} WHERE incident_id = ? AND cell_id = ? ${audienceAndDeliverySql} ORDER BY updated_at DESC, update_id DESC LIMIT ?`;
  const bound = cursor
    ? db.prepare(query).bind(
        incidentId,
        cellId,
        incidentId,
        cellId,
        actor.channel,
        actor.membership.role,
        incidentId,
        actor.channel,
        actorHash,
        cursor.updatedAt,
        cursor.updatedAt,
        cursor.updateId,
        limit + 1,
      )
    : db.prepare(query).bind(incidentId, cellId, incidentId, cellId, actor.channel, actor.membership.role, incidentId, actor.channel, actorHash, limit + 1);
  const { results } = await bound.all<OperationalUpdateRow>();
  const page = results.slice(0, limit);
  const last = page.at(-1);
  const updates = await Promise.all(page.map(async (row) => attachOperationalUpdateDelivery(db, rowToOperationalUpdate(row), actor)));

  return {
    success: true,
    body: {
      updates,
      cursor: last ? encodeOperationalUpdateCursor({ incidentId, cellId, updatedAt: last.updatedAt, updateId: last.updateId, issuedAt: new Date().toISOString() }) : encodedCursor,
      hasMore: results.length > limit,
    },
  };
}

async function getOperationalUpdate(db: D1Database, incidentId: string, updateId: string, actor?: OperationalUpdateActor | OperationalUpdateActionRequest): Promise<OperationalUpdate | null> {
  const row = await db.prepare(`${operationalUpdateSelectSql()} WHERE incident_id = ? AND update_id = ?`).bind(incidentId, updateId).first<OperationalUpdateRow>();
  const update = row ? rowToOperationalUpdate(row) : null;
  if (!update || !actor) {
    return update;
  }

  const resolvedActor = 'membership' in actor ? actor : await resolveOperationalUpdateActor(db, incidentId, actor.channel, actor.externalId);
  if ('success' in resolvedActor && !resolvedActor.success) {
    return update;
  }

  return attachOperationalUpdateDelivery(db, update, 'success' in resolvedActor ? resolvedActor.actor : resolvedActor);
}

async function attachOperationalUpdateDelivery(db: D1Database, update: OperationalUpdate, actor: OperationalUpdateActor): Promise<OperationalUpdate> {
  const actorHash = await hashString(`${actor.channel}:${actor.externalId}`);
  const delivery = await db.prepare(
    `SELECT channel, status, delivered_at AS deliveredAt, read_at AS readAt, acked_at AS ackedAt, attempt_count AS attemptCount
     FROM operational_update_deliveries
     WHERE update_id = ?
       AND incident_id = ?
       AND channel = ?
       AND (target_hash IS NULL OR target_hash = ?)
     ORDER BY target_hash DESC
     LIMIT 1`,
  ).bind(update.updateId, update.incidentId, actor.channel, actorHash).first<{
    channel: Channel;
    status: NonNullable<OperationalUpdate['delivery']>['status'];
    deliveredAt: string | null;
    readAt: string | null;
    ackedAt: string | null;
    attemptCount: number;
  }>();

  if (!delivery) {
    return update;
  }

  return {
    ...update,
    delivery: {
      channel: delivery.channel,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      ...(delivery.deliveredAt ? { deliveredAt: delivery.deliveredAt } : {}),
      ...(delivery.readAt ? { readAt: delivery.readAt } : {}),
      ...(delivery.ackedAt ? { ackedAt: delivery.ackedAt } : {}),
    },
  };
}

async function isOperationalUpdateTargetedToActor(db: D1Database, update: OperationalUpdate, actor: OperationalUpdateActor): Promise<boolean> {
  const actorHash = await hashString(`${actor.channel}:${actor.externalId}`);
  const audience = await db.prepare(
    `SELECT 1
     FROM operational_update_audiences
     WHERE update_id = ?
       AND incident_id = ?
       AND cell_id = ?
       AND (channel IS NULL OR channel = ?)
       AND (role IS NULL OR role = ?)
     LIMIT 1`,
  ).bind(update.updateId, update.incidentId, update.cellId, actor.channel, actor.membership.role).first();
  if (!audience) {
    return false;
  }

  const delivery = await db.prepare(
    `SELECT 1
     FROM operational_update_deliveries
     WHERE update_id = ?
       AND incident_id = ?
       AND channel = ?
       AND (target_hash IS NULL OR target_hash = ?)
     LIMIT 1`,
  ).bind(update.updateId, update.incidentId, actor.channel, actorHash).first();

  return Boolean(delivery);
}

async function resolveOperationalUpdateActor(
  db: D1Database,
  incidentId: string,
  channelValue: string | undefined,
  externalId: string | undefined,
): Promise<{ success: true; actor: OperationalUpdateActor } | { success: false; status: 400 | 403; error: ContractErrorCode }> {
  if (!channelValue || !externalId) {
    return { success: false, status: 400, error: 'invalid_payload' };
  }

  if (!isChannel(channelValue)) {
    return { success: false, status: 400, error: 'invalid_payload' };
  }

  const membership = await findIncidentMembershipWithPermissions(db, incidentId, channelValue, externalId);
  if (!membership?.permissions.canReadIncident) {
    return { success: false, status: 403, error: 'permission_denied' };
  }

  return { success: true, actor: { channel: channelValue, externalId, membership } };
}

function isChannel(value: string): value is Channel {
  return channels.includes(value as Channel);
}

function operationalUpdateSelectSql(): string {
  return `SELECT update_id AS updateId, incident_id AS incidentId, cell_id AS cellId, update_type AS updateType,
    urgency, title, summary, body, source_kind AS sourceKind, source_entity_id AS sourceEntityId,
    subject_entity_type AS subjectEntityType, subject_entity_id AS subjectEntityId, subject_display_ref AS subjectDisplayRef,
    metadata_json AS metadataJson, created_at AS createdAt, updated_at AS updatedAt, expires_at AS expiresAt
    FROM operational_updates`;
}

function rowToOperationalUpdate(row: OperationalUpdateRow): OperationalUpdate {
  const subject = row.subjectEntityType && row.subjectEntityId
    ? {
        entityType: row.subjectEntityType,
        entityId: row.subjectEntityId,
        incidentId: row.incidentId,
        ...(row.subjectDisplayRef ? { displayRef: row.subjectDisplayRef } : {}),
      }
    : undefined;
  return {
    updateId: row.updateId,
    incidentId: row.incidentId,
    cellId: row.cellId,
    type: row.updateType,
    urgency: row.urgency,
    title: row.title,
    summary: row.summary,
    ...(row.body ? { body: row.body } : {}),
    source: { kind: row.sourceKind, ...(row.sourceEntityId ? { entityId: row.sourceEntityId } : {}) },
    ...(subject ? { subject } : {}),
    actions: defaultOperationalUpdateActions(row.updateType),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}),
    ...liftReasonCode(parseJsonObject(row.metadataJson)),
  };
}

// El reasonCode se persiste dentro de metadata_json (evita una columna nueva) pero se
// expone como campo de primer nivel del contrato; aquí se separa de la metadata pública.
function liftReasonCode(metadata: Record<string, unknown>): { reasonCode?: OperationalUpdateReasonCode; metadata: Record<string, unknown> } {
  const { reasonCode, ...rest } = metadata;
  const parsed = OperationalUpdateReasonCodeSchema.safeParse(reasonCode);
  return parsed.success ? { reasonCode: parsed.data, metadata: rest } : { metadata: rest };
}

function defaultOperationalUpdateActions(type: OperationalUpdateType): OperationalUpdate['actions'] {
  const base = [
    { type: 'read', label: 'Mark as read', messageCode: 'updates.action.read' },
    { type: 'ack', label: 'Acknowledge', messageCode: 'updates.action.ack' },
    { type: 'open', label: 'Open detail', messageCode: 'updates.action.open' },
    { type: 'link', label: 'Create link', messageCode: 'updates.action.link' },
  ] satisfies OperationalUpdate['actions'];
  if (type === 'system_notice') {
    return base;
  }
  return [
    ...base,
    { type: 'corroborate', label: 'Corroborate', messageCode: 'updates.action.corroborate' },
    { type: 'dispute', label: 'Dispute', messageCode: 'updates.action.dispute' },
  ];
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function publicOperationalRef(prefix: string, value: string): Promise<string> {
  const digest = await hashString(value);
  return `${slug(prefix)}_${digest.slice(0, 20)}`;
}

// Slice 21.1 — cuando `targeting` trae actores concretos, la update se entrega SOLO a esos
// actores (audiencia + delivery con `target_hash` por actor, sin filas NULL de broadcast).
// Sin `targeting`, se mantiene el broadcast por celda existente (SOS, fallback sin match).
type OperationalUpdateTargeting = { targets: OperationalUpdateTarget[] };
type OperationalUpdateTarget = { channel: Channel; targetHash: string };

async function upsertOperationalUpdate(db: D1Database, input: OperationalUpdateSeed, targeting?: OperationalUpdateTargeting): Promise<void> {
  const metadata = { ...(input.metadata ?? {}), ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}) };
  await db.prepare(
    `INSERT INTO operational_updates (
       update_id, incident_id, cell_id, update_type, urgency, title, summary, body, source_kind, source_entity_id,
       subject_entity_type, subject_entity_id, subject_display_ref, metadata_json, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(update_id) DO UPDATE SET
       urgency = excluded.urgency,
       title = excluded.title,
       summary = excluded.summary,
       body = excluded.body,
       metadata_json = excluded.metadata_json,
       updated_at = excluded.updated_at`,
  ).bind(
    input.updateId,
    input.incidentId,
    input.cellId,
    input.type,
    input.urgency,
    input.title,
    input.summary,
    input.body ?? null,
    input.source.kind,
    input.source.entityId ?? null,
    input.subject?.entityType ?? null,
    input.subject?.entityId ?? null,
    input.subject?.displayRef ?? null,
    JSON.stringify(metadata),
    input.createdAt,
    input.updatedAt,
  ).run();

  const directedTargets = dedupeTargets(targeting?.targets ?? []);
  if (directedTargets.length > 0) {
    for (const target of directedTargets) {
      const targetSlug = target.targetHash.slice(0, 16);
      await db.prepare(
        `INSERT OR IGNORE INTO operational_update_audiences (audience_id, update_id, incident_id, cell_id, channel, role)
         VALUES (?, ?, ?, ?, ?, NULL)`,
      ).bind(`aud_${slug(input.updateId)}_${target.channel}_${targetSlug}`, input.updateId, input.incidentId, input.cellId, target.channel).run();
      await db.prepare(
        `INSERT OR IGNORE INTO operational_update_deliveries (delivery_id, update_id, incident_id, channel, status, target_hash, attempt_count)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
      ).bind(`del_${slug(input.updateId)}_${target.channel}_${targetSlug}`, input.updateId, input.incidentId, target.channel, 'pending', target.targetHash).run();
    }
    return;
  }

  for (const channel of channels) {
    await db.prepare(
      `INSERT OR IGNORE INTO operational_update_audiences (audience_id, update_id, incident_id, cell_id, channel, role)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    ).bind(`aud_${slug(input.updateId)}_${channel}`, input.updateId, input.incidentId, input.cellId, channel).run();
    await db.prepare(
      `INSERT OR IGNORE INTO operational_update_deliveries (delivery_id, update_id, incident_id, channel, status, target_hash, attempt_count)
       VALUES (?, ?, ?, ?, ?, NULL, 0)`,
    ).bind(`del_${slug(input.updateId)}_${channel}`, input.updateId, input.incidentId, channel, 'pending').run();
  }
}

function dedupeTargets(targets: OperationalUpdateTarget[]): OperationalUpdateTarget[] {
  const seen = new Set<string>();
  const unique: OperationalUpdateTarget[] = [];
  for (const target of targets) {
    const key = `${target.channel}:${target.targetHash}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(target);
    }
  }
  return unique;
}

async function recordOperationalUpdateAction(
  db: D1Database,
  update: OperationalUpdate,
  actionType: OperationalUpdateActionType,
  request: OperationalUpdateActionRequest,
): Promise<OperationalUpdateActionReceipt> {
  const actorHash = await hashString(`${request.channel}:${request.externalId}`);
  const idempotencyKey = request.idempotencyKey ?? `${actionType}:${update.updateId}`;
  const actionId = `oua_${slug(update.updateId)}_${slug(actionType)}_${actorHash.slice(0, 16)}_${slug(idempotencyKey)}`;
  const createdAt = request.occurredAt ?? new Date().toISOString();
  const insert = await db.prepare(
    `INSERT OR IGNORE INTO operational_update_actions (
       action_id, update_id, incident_id, action_type, channel, actor_hash, idempotency_key, status, payload_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    actionId,
    update.updateId,
    update.incidentId,
    actionType,
    request.channel,
    actorHash,
    idempotencyKey,
    'accepted',
    JSON.stringify({ note: request.note ?? null }),
    createdAt,
  ).run();

  if (actionType === 'read' || actionType === 'ack' || actionType === 'open') {
    const field = actionType === 'ack' ? 'acked_at' : 'read_at';
    const status = actionType === 'ack' ? 'acked' : 'read';
    const deliveryId = `del_${slug(update.updateId)}_${slug(request.channel)}_${actorHash.slice(0, 16)}`;
    await db.prepare(
      `INSERT INTO operational_update_deliveries (
         delivery_id, update_id, incident_id, channel, status, target_hash, ${field}, attempt_count, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(update_id, channel, target_hash) DO UPDATE SET
         status = excluded.status,
         ${field} = excluded.${field},
         updated_at = excluded.updated_at`,
    )
      .bind(deliveryId, update.updateId, update.incidentId, request.channel, status, actorHash, createdAt, createdAt)
      .run();
  }

  return { actionId, updateId: update.updateId, actionType, status: 'accepted', idempotent: insert.meta.changes === 0, createdAt };
}

async function handleOperationalUpdateBasicAction(
  db: D1Database,
  incidentId: string,
  updateId: string,
  actionType: 'ack' | 'read' | 'open',
  body: unknown,
): Promise<Response> {
  const incident = await findIncident(db, incidentId);
  if (!incident) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const update = await getOperationalUpdate(db, incident.incidentId, updateId);
  if (!update) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const parsed = OperationalUpdateActionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }

  const actor = await resolveOperationalUpdateActor(db, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!actor.success) {
    return Response.json({ error: actor.error }, { status: actor.status });
  }
  if (!await isOperationalUpdateTargetedToActor(db, update, actor.actor)) {
    return Response.json({ error: 'permission_denied' }, { status: 403 });
  }

  const action = await recordOperationalUpdateAction(db, update, actionType, parsed.data);
  return Response.json(OperationalUpdateActionResponseSchema.parse({ update: await getOperationalUpdate(db, incident.incidentId, update.updateId, actor.actor) ?? update, action }));
}


async function handleOperationalUpdateCorroborateAction(
  db: D1Database,
  incidentId: string,
  updateId: string,
  body: unknown,
): Promise<Response> {
  const incident = await findIncident(db, incidentId);
  if (!incident) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const update = await getOperationalUpdate(db, incident.incidentId, updateId);
  if (!update) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (!update.subject) {
    return Response.json({ error: 'invalid_payload', issues: [{ message: 'update has no trust subject' }] }, { status: 400 });
  }

  const parsed = OperationalUpdateCorroborateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }

  const actor = await resolveOperationalUpdateActor(db, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!actor.success) {
    return Response.json({ error: actor.error }, { status: actor.status });
  }
  if (!await isOperationalUpdateTargetedToActor(db, update, actor.actor)) {
    return Response.json({ error: 'permission_denied' }, { status: 403 });
  }

  const trust = await createTrustSignal(db, incident.incidentId, {
    channel: parsed.data.channel,
    externalId: parsed.data.externalId,
    displayName: parsed.data.displayName,
    subject: update.subject,
    signalType: 'context_corroboration',
    sourceKind: 'field_actor',
    reason: parsed.data.note ?? `Corroborated operational update ${update.updateId}`,
    confidence: parsed.data.confidence ?? 0.7,
    occurredAt: parsed.data.occurredAt,
    metadata: { updateId: update.updateId },
  }, actor.actor.membership);
  const action = await recordOperationalUpdateAction(db, update, 'corroborate', parsed.data);

  return Response.json(OperationalUpdateActionResponseSchema.parse({ update: await getOperationalUpdate(db, incident.incidentId, update.updateId, actor.actor) ?? update, action, trustState: trust.trustState, audit: trust.audit }));
}

async function handleOperationalUpdateDisputeAction(
  db: D1Database,
  incidentId: string,
  updateId: string,
  body: unknown,
): Promise<Response> {
  const incident = await findIncident(db, incidentId);
  if (!incident) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const update = await getOperationalUpdate(db, incident.incidentId, updateId);
  if (!update) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (!update.subject) {
    return Response.json({ error: 'invalid_payload', issues: [{ message: 'update has no trust subject' }] }, { status: 400 });
  }

  const parsed = OperationalUpdateDisputeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_payload', issues: parsed.error.issues }, { status: 400 });
  }

  const actor = await resolveOperationalUpdateActor(db, incident.incidentId, parsed.data.channel, parsed.data.externalId);
  if (!actor.success) {
    return Response.json({ error: actor.error }, { status: actor.status });
  }
  if (!await isOperationalUpdateTargetedToActor(db, update, actor.actor)) {
    return Response.json({ error: 'permission_denied' }, { status: 403 });
  }

  const dispute = await createDispute(db, incident.incidentId, {
    channel: parsed.data.channel,
    externalId: parsed.data.externalId,
    displayName: parsed.data.displayName,
    subject: update.subject,
    reason: parsed.data.reason,
    description: parsed.data.note,
    occurredAt: parsed.data.occurredAt,
    metadata: { updateId: update.updateId },
  }, actor.actor.membership);
  const action = await recordOperationalUpdateAction(db, update, 'dispute', parsed.data);

  return Response.json(OperationalUpdateActionResponseSchema.parse({ update: await getOperationalUpdate(db, incident.incidentId, update.updateId, actor.actor) ?? update, action, trustState: dispute.trustState, audit: dispute.audit }));
}

function isSameTrustSubject(left: TrustSubject, right: TrustSubject): boolean {
  return left.incidentId === right.incidentId && left.entityType === right.entityType && left.entityId === right.entityId;
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

  return WorkCenterCreateResponseSchema.parse({ workCenter: detail, audit: { auditEventId }, idempotent: insert.meta.changes === 0 });
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

  return { ...(await rowToWorkCenterBase(db, row)), latestSignals: results };
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
  const reporterTargetHash = await hashString(`${request.channel}:${request.externalId}`);
  await insertResourceReport(db, resourceReportId, incident.incidentId, `connected-${request.channel}`, request.payload, request.channel, null, null, nowIso, reporterTargetHash);
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
      'resource_report.created',
      JSON.stringify({ resourceReportId }),
    )
    .run();
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
  await insertResourceReport(
    db,
    operation.entityId,
    operation.incidentId,
    operation.cellId,
    payload,
    channel,
    operation.opId,
    operation.actorKeyId,
    payload.reportedAt ?? operation.createdAtDevice,
  );
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
  reporterTargetHash: string | null = null,
): Promise<void> {
  const state = deriveResourceReportState({ updatedAt: timestamp, reportKind: payload.reportKind, urgency: payload.urgency, constraints: payload.constraints });
  const insert = await db.prepare(
    `INSERT OR IGNORE INTO resource_reports (
       resource_report_id, incident_id, cell_id, work_center_id, category, quantity_approx, urgency, constraints_json,
       report_kind, freshness, confidence, risk, source_channel, source_operation_id, actor_key_id, reporter_target_hash, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    reporterTargetHash,
    timestamp,
    timestamp,
  ).run();

  if (insert.meta.changes > 0) {
    const kind = payload.reportKind === 'needed' ? 'resource_need' : 'resource_offer';
    const publicResourceRef = await publicOperationalRef('resource_report', resourceReportId);
    // Slice 21.1 — resolver contrapartes compatibles (oferta↔demanda) y dirigir la update
    // solo a sus reportantes. Sin contrapartes con identidad conocida, se degrada a
    // broadcast por celda (feed) en vez de push dirigido.
    const match = await resolveResourceMatchTargeting(db, incidentId, resourceReportId, payload.reportKind);
    await upsertOperationalUpdate(
      db,
      {
        updateId: `upd_${publicResourceRef}`,
        incidentId,
        cellId,
        type: kind,
        urgency: payload.urgency,
        title: payload.reportKind === 'needed' ? 'Resource need reported' : 'Resource offer reported',
        summary: `${payload.reportKind === 'needed' ? 'Need' : 'Offer'} reported for ${payload.category}.`,
        source: { kind: 'resource_report', entityId: publicResourceRef },
        subject: { entityType: 'resource_report', entityId: publicResourceRef, incidentId, displayRef: payload.category },
        reasonCode: match.reasonCode,
        createdAt: timestamp,
        updatedAt: timestamp,
        metadata: { reportKind: payload.reportKind, urgency: payload.urgency },
      },
      match.targets.length > 0 ? { targets: match.targets } : undefined,
    );
  }
}

// Reutiliza el matcher de dominio (categoría + celda/centro) para hallar las contrapartes de
// un nuevo reporte y devuelve a quién dirigir la update (por `target_hash` del reportante) y
// el reasonCode honesto. Solo contrapartes con identidad connected conocida son direccionables.
async function resolveResourceMatchTargeting(
  db: D1Database,
  incidentId: string,
  newResourceReportId: string,
  reportKind: ResourceReportPayload['reportKind'],
): Promise<{ reasonCode: OperationalUpdateReasonCode; targets: OperationalUpdateTarget[] }> {
  const reports = await listResourceReports(db, incidentId);
  const matches = matchResourceReports(reports);
  const counterpartyIds = reportKind === 'needed'
    ? matches.filter((m) => m.need.resourceReportId === newResourceReportId).map((m) => m.surplus.resourceReportId)
    : matches.filter((m) => m.surplus.resourceReportId === newResourceReportId).map((m) => m.need.resourceReportId);

  if (counterpartyIds.length === 0) {
    return { reasonCode: 'resource.report.cell_broadcast', targets: [] };
  }

  const targets = await selectResourceReportTargets(db, incidentId, counterpartyIds);
  if (targets.length === 0) {
    // Hubo match, pero las contrapartes no tienen identidad direccionable (p.ej. reportes
    // materializados por sync mobile sin externalId). No hacemos broadcast: la update queda
    // sin audiencia dirigida y visible solo por el feed general de celda.
    return { reasonCode: 'resource.report.cell_broadcast', targets: [] };
  }

  const reasonCode: OperationalUpdateReasonCode = reportKind === 'needed'
    ? 'resource.match.need_for_open_offer'
    : 'resource.match.offer_for_open_need';
  return { reasonCode, targets };
}

async function selectResourceReportTargets(db: D1Database, incidentId: string, resourceReportIds: string[]): Promise<OperationalUpdateTarget[]> {
  const uniqueIds = [...new Set(resourceReportIds)];
  if (uniqueIds.length === 0) {
    return [];
  }
  const placeholders = uniqueIds.map(() => '?').join(', ');
  const { results } = await db.prepare(
    `SELECT source_channel AS channel, reporter_target_hash AS targetHash
     FROM resource_reports
     WHERE incident_id = ? AND resource_report_id IN (${placeholders})
       AND reporter_target_hash IS NOT NULL AND source_channel IS NOT NULL`,
  ).bind(incidentId, ...uniqueIds).all<{ channel: Channel; targetHash: string }>();
  return results.map((row) => ({ channel: row.channel, targetHash: row.targetHash }));
}

async function listResourceReports(db: D1Database, incidentId: string): Promise<ResourceReportSummary[]> {
  const { results } = await db.prepare(resourceReportSelectSql('WHERE incident_id = ? ORDER BY updated_at DESC')).bind(incidentId).all<ResourceReportRow>();
  return results.map(rowToResourceReportSummary);
}

async function getResourceReportDetail(db: D1Database, incidentId: string, resourceReportId: string): Promise<ResourceReportDetail | null> {
  const row = await db.prepare(resourceReportSelectSql('WHERE incident_id = ? AND resource_report_id = ?')).bind(incidentId, resourceReportId).first<ResourceReportRow>();
  return row ? rowToResourceReportDetail(row) : null;
}

export async function recommendTelegramResourceNeeds(
  db: D1Database,
  input: TelegramNeedRecommendationInput,
): Promise<TelegramNeedRecommendation[]> {
  const reportRows = await listNeededResourceReportRecommendationRows(db, input.incidentId ?? null);
  const workCenterRows = await listWorkCenterInitialNeedRecommendationRows(db, input.incidentId ?? null, reportRows);
  const rows: ResourceNeedRecommendationRow[] = [...reportRows, ...workCenterRows];
  const rowByReportId = new Map(rows.map((row) => [row.resourceReportId, row]));
  const recommendations = recommendResourceNeeds({
    resourceLabel: input.resourceLabel,
    resourceType: input.resourceType,
    incidentId: input.incidentId ?? null,
    needs: rows.map(rowToResourceReportSummary),
  });

  return recommendations.slice(0, input.limit ?? 5).map((recommendation) => {
    const row = rowByReportId.get(recommendation.need.resourceReportId);
    return rowToTelegramNeedRecommendation(recommendation, row ?? null);
  });
}

async function listNeededResourceReportRecommendationRows(
  db: D1Database,
  incidentId: string | null,
): Promise<ResourceReportRecommendationRow[]> {
  const whereClause = incidentId ? 'WHERE rr.report_kind = ? AND rr.incident_id = ?' : 'WHERE rr.report_kind = ?';
  const statement = db.prepare(
    `SELECT rr.resource_report_id AS resourceReportId, rr.incident_id AS incidentId, rr.cell_id AS cellId,
      rr.work_center_id AS workCenterId, rr.category, rr.quantity_approx AS quantityApprox, rr.urgency,
      rr.constraints_json AS constraintsJson, rr.report_kind AS reportKind, rr.freshness, rr.confidence, rr.risk,
      rr.source_channel AS sourceChannel, rr.source_operation_id AS sourceOperationId, rr.actor_key_id AS actorKeyId,
      rr.created_at AS createdAt, rr.updated_at AS updatedAt, incidents.name AS incidentName,
      incidents.status AS incidentStatus, incidents.starts_at AS incidentStartsAt, incidents.location_name AS incidentLocationName,
      wc.name AS workCenterName, wc.latitude AS workCenterLatitude, wc.longitude AS workCenterLongitude
     FROM resource_reports rr
     LEFT JOIN incidents ON incidents.incident_id = rr.incident_id
     LEFT JOIN work_centers wc ON wc.work_center_id = rr.work_center_id
     ${whereClause}`
  );
  const bound = incidentId ? statement.bind('needed', incidentId) : statement.bind('needed');
  const { results } = await bound.all<ResourceReportRecommendationRow>();
  return results;
}

async function listWorkCenterInitialNeedRecommendationRows(
  db: D1Database,
  incidentId: string | null,
  reportRows: ResourceReportRecommendationRow[],
): Promise<WorkCenterInitialNeedRecommendationRow[]> {
  const duplicateKeys = new Set(
    reportRows
      .filter((row) => row.workCenterId)
      .map((row) => `${row.workCenterId}:${normalizeResourceCategory(row.category)}`),
  );
  const whereClause = incidentId
    ? `WHERE wc.status = ? AND wc.initial_need IS NOT NULL AND TRIM(wc.initial_need) != '' AND wc.incident_id = ?`
    : `WHERE wc.status = ? AND wc.initial_need IS NOT NULL AND TRIM(wc.initial_need) != ''`;
  const statement = db.prepare(
    `SELECT wc.work_center_id AS workCenterId, wc.incident_id AS incidentId, wc.cell_id AS cellId, wc.name AS workCenterName,
      wc.initial_need AS initialNeed, wc.priority AS workCenterPriority, wc.freshness, wc.confidence, wc.risk,
      wc.latitude AS workCenterLatitude, wc.longitude AS workCenterLongitude, wc.source_channel AS sourceChannel,
      wc.created_at AS createdAt, wc.updated_at AS updatedAt, incidents.name AS incidentName,
      incidents.status AS incidentStatus, incidents.starts_at AS incidentStartsAt, incidents.location_name AS incidentLocationName
     FROM work_centers wc
     LEFT JOIN incidents ON incidents.incident_id = wc.incident_id
     ${whereClause}
     ORDER BY wc.updated_at DESC, wc.work_center_id ASC`,
  );
  const bound = incidentId ? statement.bind('active', incidentId) : statement.bind('active');
  const { results } = await bound.all<{
    workCenterId: string;
    incidentId: string;
    cellId: string;
    workCenterName: string;
    initialNeed: string;
    workCenterPriority: WorkCenterPriority;
    freshness: ResourceReportSummary['freshness'];
    confidence: ResourceReportSummary['confidence'];
    risk: ResourceReportSummary['risk'];
    workCenterLatitude: number | null;
    workCenterLongitude: number | null;
    sourceChannel: Channel | null;
    createdAt: string;
    updatedAt: string;
    incidentName: string | null;
    incidentStatus: IncidentSummary['status'] | null;
    incidentStartsAt: string | null;
    incidentLocationName: string | null;
  }>();

  return results.flatMap((row): WorkCenterInitialNeedRecommendationRow[] => {
    const parsedNeed = parseWorkCenterInitialNeed(row.initialNeed);
    const duplicateKey = `${row.workCenterId}:${normalizeResourceCategory(parsedNeed.category)}`;

    if (!parsedNeed.category || duplicateKeys.has(duplicateKey)) {
      return [];
    }

    return [{
      resourceReportId: `wc_need_${row.workCenterId}_${slug(parsedNeed.category)}`,
      incidentId: row.incidentId,
      cellId: row.cellId,
      workCenterId: row.workCenterId,
      category: parsedNeed.category,
      quantityApprox: parsedNeed.quantityApprox,
      urgency: row.workCenterPriority,
      constraintsJson: '[]',
      reportKind: 'needed',
      freshness: row.freshness,
      confidence: row.confidence,
      risk: row.risk,
      sourceChannel: row.sourceChannel,
      sourceOperationId: null,
      actorKeyId: null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      incidentName: row.incidentName,
      incidentStatus: row.incidentStatus,
      incidentStartsAt: row.incidentStartsAt,
      incidentLocationName: row.incidentLocationName,
      workCenterName: row.workCenterName,
      workCenterLatitude: row.workCenterLatitude,
      workCenterLongitude: row.workCenterLongitude,
      initialNeed: row.initialNeed,
      workCenterPriority: row.workCenterPriority,
    }];
  });
}

function parseWorkCenterInitialNeed(initialNeed: string): { category: string; quantityApprox: string } {
  const category = inferInitialNeedCategory(initialNeed);
  return {
    category,
    quantityApprox: extractInitialNeedQuantity(initialNeed, category) ?? initialNeed.trim(),
  };
}

function inferInitialNeedCategory(initialNeed: string): string {
  const normalized = normalizeInitialNeedText(initialNeed);
  const categoryTerms: Record<string, string[]> = {
    medicine: ['medicamentos', 'medicamento', 'medicinas', 'medicina', 'farmacos', 'farmaco', 'medications', 'medication', 'medicines', 'medicine'],
    water: ['agua potable', 'agua', 'water'],
    food: ['alimentos', 'alimento', 'comida', 'food'],
    blankets: ['mantas', 'manta', 'blankets', 'blanket'],
    fuel: ['combustible', 'fuel'],
    transport: ['transporte', 'transport'],
    shelter: ['refugio', 'shelter'],
    equipment: ['equipamiento', 'equipo', 'equipment'],
  };

  for (const terms of Object.values(categoryTerms)) {
    const matchedTerm = terms.find((term) => normalized.includes(term));
    if (matchedTerm) {
      return matchedTerm;
    }
  }

  return normalizeResourceCategory(initialNeed);
}

function extractInitialNeedQuantity(initialNeed: string, category: string): string | null {
  const normalizedNeed = normalizeInitialNeedText(initialNeed);
  const normalizedCategory = normalizeInitialNeedText(category);
  const match = normalizedNeed.match(/\b\d+[\w\s.,-]{0,40}/);

  if (!match) {
    return null;
  }

  const quantity = match[0]
    .replace(new RegExp(`\\b${normalizedCategory}\\b`, 'i'), '')
    .replace(/\b(de|of)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return quantity || null;
}

function normalizeInitialNeedText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function rowToTelegramNeedRecommendation(
  recommendation: ResourceNeedRecommendation,
  row: ResourceNeedRecommendationRow | null,
): TelegramNeedRecommendation {
  return {
    incidentId: recommendation.need.incidentId,
    ...(row?.incidentName ? { incidentName: row.incidentName } : {}),
    ...(row?.incidentStatus ? { incidentStatus: row.incidentStatus } : {}),
    ...(row?.incidentStartsAt ? { incidentStartsAt: row.incidentStartsAt } : {}),
    ...(row?.incidentLocationName ? { incidentLocationName: row.incidentLocationName } : {}),
    ...(recommendation.need.workCenterId ? { workCenterId: recommendation.need.workCenterId } : {}),
    ...(row?.workCenterName ? { workCenterName: row.workCenterName } : {}),
    ...(row?.workCenterLatitude !== null && row?.workCenterLatitude !== undefined && row?.workCenterLongitude !== null && row?.workCenterLongitude !== undefined
      ? { workCenterLocation: { latitude: row.workCenterLatitude, longitude: row.workCenterLongitude } }
      : {}),
    category: recommendation.need.category,
    quantityApprox: recommendation.need.quantityApprox,
    urgency: recommendation.need.urgency,
    score: recommendation.score,
    reasons: recommendation.reasons,
  };
}

function resourceReportSelectSql(whereClause: string): string {
  return `SELECT resource_report_id AS resourceReportId, incident_id AS incidentId, cell_id AS cellId, work_center_id AS workCenterId,
    category, quantity_approx AS quantityApprox, urgency, constraints_json AS constraintsJson, report_kind AS reportKind,
    freshness, confidence, risk, source_channel AS sourceChannel, source_operation_id AS sourceOperationId,
    actor_key_id AS actorKeyId, created_at AS createdAt, updated_at AS updatedAt
    FROM resource_reports ${whereClause}`;
}

function rowToResourceReportSummary(row: ResourceReportRow): ResourceReportSummary {
  const state = deriveResourceReportState({
    updatedAt: row.updatedAt,
    reportKind: row.reportKind,
    urgency: row.urgency,
    constraints: parseStringArray(row.constraintsJson),
  });
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
  await db
    .prepare(
      `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      auditEventId,
      incident.incidentId,
      membership.channelIdentityId,
      membership.incidentMembershipId,
      'dispatch_task.created',
      JSON.stringify({ dispatchTaskId }),
    )
    .run();
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
  await db
    .prepare(
      `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      auditEventId,
      incident.incidentId,
      membership.channelIdentityId,
      membership.incidentMembershipId,
      'dispatch_task.updated',
      JSON.stringify({ dispatchTaskId, status: request.status }),
    )
    .run();
  return { dispatchTask: updated, audit: { auditEventId } };
}

async function materializeDispatchTaskCreateOperation(
  db: D1Database,
  operation: PendingSignedOperation,
  payload: DispatchEventCreatePayload,
  channel: Channel,
): Promise<void> {
  await insertDispatchTask(
    db,
    operation.entityId,
    operation.incidentId,
    operation.cellId,
    payload,
    channel,
    operation.opId,
    operation.createdAtDevice,
    payload.status ?? 'pending',
  );
}

async function materializeDispatchTaskUpdateOperation(
  db: D1Database,
  operation: PendingSignedOperation,
  payload: DispatchEventUpdatePayload,
  channel: Channel,
): Promise<DispatchTask | null> {
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
  await db
    .prepare(
      `INSERT OR IGNORE INTO dispatch_tasks (
      dispatch_task_id, incident_id, cell_id, category, quantity_approx, from_resource_report_id, to_resource_report_id,
      target_work_center_id, status, notes, source_channel, source_operation_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      dispatchTaskId,
      incidentId,
      cellId,
      payload.category,
      payload.quantityApprox,
      payload.fromResourceReportId ?? null,
      payload.toResourceReportId ?? null,
      payload.targetWorkCenterId ?? null,
      status,
      payload.notes ?? null,
      sourceChannel,
      sourceOperationId,
      timestamp,
      timestamp,
    )
    .run();
  await insertDispatchEvent(
    db,
    `de_${slug(sourceOperationId ?? dispatchTaskId)}_created`,
    dispatchTaskId,
    incidentId,
    status,
    payload.notes ?? null,
    sourceChannel,
    sourceOperationId,
    null,
    timestamp,
  );
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
  await db
    .prepare('UPDATE dispatch_tasks SET status = ?, notes = COALESCE(?, notes), updated_at = ? WHERE incident_id = ? AND dispatch_task_id = ?')
    .bind(payload.status, payload.notes ?? null, timestamp, incidentId, payload.dispatchTaskId)
    .run();
  await insertDispatchEvent(
    db,
    `de_${slug(sourceOperationId ?? `${payload.dispatchTaskId}_${payload.status}`)}`,
    payload.dispatchTaskId,
    incidentId,
    payload.status,
    payload.notes ?? null,
    sourceChannel,
    sourceOperationId,
    actorKeyId,
    timestamp,
  );
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
  await db
    .prepare(
      `INSERT OR IGNORE INTO dispatch_events (dispatch_event_id, dispatch_task_id, incident_id, status, notes, source_channel, source_operation_id, actor_key_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(dispatchEventId, dispatchTaskId, incidentId, status, notes, sourceChannel, sourceOperationId, actorKeyId, timestamp)
    .run();
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
  const inserted = await insertSosAlert(
    db,
    sosAlertId,
    incident.incidentId,
    `connected-${request.channel}`,
    request.payload,
    request.channel,
    null,
    null,
    timestamp,
  );

  await db
    .prepare(
      `INSERT OR IGNORE INTO audit_events (audit_event_id, incident_id, channel_identity_id, incident_membership_id, event_type, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(auditEventId, incident.incidentId, membership.channelIdentityId, membership.incidentMembershipId, 'sos.created', JSON.stringify({ sosAlertId }))
    .run();

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
  const insert = await db
    .prepare(
      `INSERT OR IGNORE INTO sos_alerts (
      sos_alert_id, incident_id, cell_id, severity, message, latitude, longitude, accuracy_meters,
      status, source_channel, source_operation_id, actor_key_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
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
    )
    .run();

  await insertSosEvent(
    db,
    `sos_evt_${slug(sourceOperationId ?? sosAlertId)}_created`,
    sosAlertId,
    incidentId,
    'sos.created',
    sourceChannel,
    sourceOperationId,
    actorKeyId,
    timestamp,
    payload,
  );
  await enqueueCriticalFanoutJobs(db, sosAlertId, incidentId, 'sos.created', timestamp, payload);
  if (insert.meta.changes > 0) {
    const publicSosRef = await publicOperationalRef('sos_alert', sosAlertId);
    await upsertOperationalUpdate(db, {
      updateId: `upd_${publicSosRef}`,
      incidentId,
      cellId,
      type: 'sos_alert',
      urgency: payload.severity === 'critical' || payload.severity === 'medical' || payload.severity === 'trapped' ? 'critical' : 'high',
      title: 'SOS alert reported',
      summary: `SOS alert reported with ${payload.severity} severity.`,
      source: { kind: 'sos_alert', entityId: publicSosRef },
      subject: { entityType: 'sos_alert', entityId: publicSosRef, incidentId, displayRef: `SOS ${payload.severity}` },
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: { severity: payload.severity },
    });
  }
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
    await db
      .prepare('UPDATE sos_alerts SET status = ?, updated_at = ?, cancelled_at = ?, cancel_reason = ? WHERE incident_id = ? AND sos_alert_id = ?')
      .bind('cancelled', timestamp, timestamp, payload.reason ?? null, incidentId, sosAlertId)
      .run();
    await db
      .prepare(
        "UPDATE critical_fanout_jobs SET status = ?, updated_at = ? WHERE sos_alert_id = ? AND event_type = 'sos.created' AND status IN ('queued', 'pending')",
      )
      .bind('cancelled', timestamp, sosAlertId)
      .run();
  }

  await insertSosEvent(
    db,
    `sos_evt_${slug(sourceOperationId ?? `${sosAlertId}_cancelled`)}_cancelled`,
    sosAlertId,
    incidentId,
    'sos.cancelled',
    sourceChannel,
    sourceOperationId,
    actorKeyId,
    timestamp,
    payload,
  );
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

async function hashString(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
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

async function safeRecordOperationalAudit(db: D1Database, input: OperationalAuditInput): Promise<string | null> {
  try {
    return await recordOperationalAudit(db, input);
  } catch {
    console.warn(
      JSON.stringify({
        event: 'operational.audit.failed',
        category: input.category,
        result: input.result,
        channel: input.channel ?? null,
        scope: input.scope ?? null,
        action: input.action ?? null,
        errorCode: input.errorCode ?? null,
      }),
    );
    return null;
  }
}

async function recordOperationalAudit(db: D1Database, input: OperationalAuditInput): Promise<string> {
  const auditId = `op_audit_${crypto.randomUUID()}`;
  const subjectRefHash = input.subjectRef ? await hashString(input.subjectRef) : null;
  const metadata = sanitizeOperationalMetadata(input.metadata ?? {});

  await db
    .prepare(
      `INSERT INTO operational_audit_events (
      audit_id, event_type, category, result, incident_id, channel, scope, action,
      subject_ref_hash, error_code, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      auditId,
      input.eventType,
      input.category,
      input.result,
      input.incidentId ?? null,
      input.channel ?? null,
      input.scope ?? null,
      input.action ?? null,
      subjectRefHash,
      input.errorCode ?? null,
      JSON.stringify(metadata),
    )
    .run();

  logStructuredOperationalEvent({
    event: 'operational.audit.recorded',
    category: input.category,
    result: input.result,
    channel: input.channel ?? null,
    scope: input.scope ?? undefined,
    action: input.action ?? undefined,
    errorCode: input.errorCode ?? null,
  });
  return auditId;
}

async function checkRateLimit(
  db: D1Database,
  input: { scope: string; key: string; limit: number; windowSeconds: number; incidentId?: string | null; channel?: Channel | null; action?: string | null },
): Promise<RateLimitResult> {
  const nowMs = Date.now();
  const windowStartedMs = Math.floor(nowMs / (input.windowSeconds * 1000)) * input.windowSeconds * 1000;
  const windowStartedAt = new Date(windowStartedMs).toISOString();
  const resetAt = new Date(windowStartedMs + input.windowSeconds * 1000).toISOString();
  const keyHash = await hashString(`${input.scope}:${input.key}`);
  const bucketId = `rl_${input.scope.replace(/[^a-zA-Z0-9_-]/g, '_')}_${keyHash.slice(0, 32)}_${windowStartedMs}`;

  await db
    .prepare(
      `INSERT INTO rate_limit_buckets (bucket_id, scope, key_hash, window_started_at, window_seconds, count, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(scope, key_hash, window_started_at) DO NOTHING`,
    )
    .bind(bucketId, input.scope, keyHash, windowStartedAt, input.windowSeconds)
    .run();

  await db
    .prepare(
      `UPDATE rate_limit_buckets
     SET count = count + 1, updated_at = CURRENT_TIMESTAMP
     WHERE scope = ? AND key_hash = ? AND window_started_at = ?`,
    )
    .bind(input.scope, keyHash, windowStartedAt)
    .run();

  const bucket = await db
    .prepare(`SELECT count FROM rate_limit_buckets WHERE scope = ? AND key_hash = ? AND window_started_at = ?`)
    .bind(input.scope, keyHash, windowStartedAt)
    .first<{ count: number }>();
  const count = bucket?.count ?? 1;
  const allowed = count <= input.limit;

  await safeRecordOperationalAudit(db, {
    eventType: 'rate_limit.checked',
    category: 'rate_limit',
    result: allowed ? 'accepted' : 'rejected',
    incidentId: input.incidentId ?? null,
    channel: input.channel ?? null,
    scope: input.scope,
    action: input.action ?? null,
    subjectRef: input.key,
    errorCode: allowed ? null : 'rate_limited',
    metadata: { limit: input.limit, windowSeconds: input.windowSeconds, count },
  });

  if (!allowed) {
    return { allowed: false, count, remaining: 0, resetAt, error: 'rate_limited' };
  }

  return { allowed: true, count, remaining: Math.max(0, input.limit - count), resetAt };
}

async function verifyTurnstileForRequest(
  env: Env,
  request: Request,
  input: { action: string; remoteIp?: string | null; token?: string | null },
): Promise<TurnstileResult> {
  const rollout = env.TURNSTILE_ROLLOUT ?? 'off';
  const token = input.token ?? request.headers.get('cf-turnstile-response') ?? request.headers.get('x-turnstile-token');

  if (rollout === 'off' || !env.TURNSTILE_SECRET_KEY) {
    logStructuredOperationalEvent({ event: 'turnstile.checked', category: 'security', result: 'bypassed', action: input.action, scope: 'turnstile' });
    return { success: true, mode: 'disabled' };
  }

  if (!token) {
    const result = rollout === 'enforce' ? 'rejected' : 'bypassed';
    logStructuredOperationalEvent({
      event: 'security.challenge.required',
      category: 'security',
      result,
      action: input.action,
      scope: 'turnstile',
      errorCode: 'security_challenge_required',
    });
    return rollout === 'enforce' ? { success: false, mode: 'enforced', error: 'security_challenge_required' } : { success: true, mode: 'observe' };
  }

  const body = new FormData();
  body.set('secret', env.TURNSTILE_SECRET_KEY);
  body.set('response', token);
  if (input.remoteIp) {
    body.set('remoteip', input.remoteIp);
  }

  let response: Response;
  let payload: { success?: boolean };
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    payload = (await response.json().catch(() => ({}))) as { success?: boolean };
  } catch {
    logStructuredOperationalEvent({
      event: 'turnstile.checked',
      category: 'security',
      result: rollout === 'enforce' ? 'rejected' : 'bypassed',
      action: input.action,
      scope: 'turnstile',
      errorCode: 'turnstile_failed',
    });

    return rollout === 'enforce' ? { success: false, mode: 'enforced', error: 'turnstile_failed' } : { success: true, mode: 'observe' };
  }

  const ok = response.ok && payload.success === true;
  logStructuredOperationalEvent({
    event: 'turnstile.checked',
    category: 'security',
    result: ok ? 'accepted' : rollout === 'enforce' ? 'rejected' : 'bypassed',
    action: input.action,
    scope: 'turnstile',
    errorCode: ok ? null : 'turnstile_failed',
  });

  if (!ok && rollout === 'enforce') {
    return { success: false, mode: 'enforced', error: 'turnstile_failed' };
  }

  return { success: true, mode: rollout === 'enforce' ? 'enforced' : 'observe' };
}

function sanitizeOperationalMetadata(metadata: Record<string, string | number | boolean | null>): Record<string, string | number | boolean | null> {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (/token|secret|signature|fingerprint|payload|location|latitude|longitude|name|text/i.test(key)) {
      continue;
    }
    safe[key] = value;
  }
  return safe;
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
  logStructuredOperationalEvent({
    event: 'operation.processed',
    category: 'sync',
    channel: input.channel === 'mobile' ? 'mobile' : input.channel,
    opType: input.opType ?? undefined,
    result: input.result,
    errorCode: input.errorCode,
    latencyMs: input.latencyMs,
  });
}

function logStructuredOperationalEvent(input: Omit<OperationalEvent, 'sampled' | 'opType'> & { opType?: string }): void {
  const parsed = OperationalEventSchema.safeParse(input);
  const event = parsed.success ? parsed.data : OperationalEventSchema.parse({ ...input, opType: undefined });
  console.log(JSON.stringify(event));
}

function createTelegramChannelTelemetrySink(): ChannelTelemetryPort {
  return {
    emit(event) {
      const safeEvent = OperationalEventSchema.parse({
        event: event.event,
        category: event.category,
        result: event.result,
        channel: 'telegram',
        scope: event.scope,
        action: event.action,
        opType: event.opType,
        errorCode: event.errorCode ?? null,
        latencyMs: event.latencyMs,
        sampled: event.sampled,
      });
      logStructuredOperationalEvent(safeEvent);
    },
  };
}

function getTelegramChatId(update: TelegramUpdateLike): string | number | null {
  const candidate = update as {
    message?: { chat?: { id?: unknown } };
    edited_message?: { chat?: { id?: unknown } };
    callback_query?: { message?: { chat?: { id?: unknown } } };
  };
  const chatId = candidate.message?.chat?.id ?? candidate.edited_message?.chat?.id ?? candidate.callback_query?.message?.chat?.id;
  return typeof chatId === 'string' || typeof chatId === 'number' ? chatId : null;
}

async function sendTelegramWebhookResponse(env: Env, update: TelegramUpdateLike, responseText: string): Promise<void> {
  const chatId = getTelegramChatId(update);

  if (!env.TELEGRAM_BOT_TOKEN || !chatId) {
    logStructuredOperationalEvent({
      event: 'operation.processed',
      category: 'sync',
      result: 'bypassed',
      channel: 'telegram',
      scope: 'telegram.delivery',
      action: env.TELEGRAM_BOT_TOKEN ? 'sendMessage.no_chat' : 'sendMessage.not_configured',
      errorCode: null,
    });
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: responseText }),
    });

    logStructuredOperationalEvent({
      event: 'operation.processed',
      category: 'sync',
      result: response.ok ? 'accepted' : 'rejected',
      channel: 'telegram',
      scope: 'telegram.delivery',
      action: 'sendMessage',
      errorCode: null,
    });
  } catch {
    logStructuredOperationalEvent({
      event: 'operation.processed',
      category: 'sync',
      result: 'rejected',
      channel: 'telegram',
      scope: 'telegram.delivery',
      action: 'sendMessage',
      errorCode: null,
    });
  }
}

async function isTelegramWebhookSecretValid(request: Request, expectedSecret?: string): Promise<boolean> {
  if (!expectedSecret) {
    return true;
  }

  const actualSecret = request.headers.get('x-telegram-bot-api-secret-token');
  if (!actualSecret) {
    return false;
  }

  return constantTimeStringEquals(actualSecret, expectedSecret);
}

async function constantTimeStringEquals(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);
  const maxLength = Math.max(actualBytes.length, expectedBytes.length);
  let diff = actualBytes.length ^ expectedBytes.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }

  return diff === 0;
}

function createIncidentConfigResponse(incident: IncidentSummary): IncidentConfigResponse {
  return IncidentConfigResponseSchema.parse({ incident, roles, channels, permissionSnapshots });
}

async function handleTelegramConversation(
  env: Env,
  db: D1Database,
  update: TelegramUpdateLike,
  command: string | null,
  telemetry?: ChannelTelemetryPort,
): Promise<string> {
  const joinStateKey = getTelegramConversationStateKey(update);
  const workCenterStateKey = getTelegramWorkCenterConversationStateKey(update);
  const resourceStateKey = getTelegramResourceConversationStateKey(update);
  const dispatchStateKey = getTelegramDispatchConversationStateKey(update);
  const sosStateKey = getTelegramSosConversationStateKey(update);
  const familyStateKey = getTelegramFamilyReunificationConversationStateKey(update);
  const stateKeys = { joinStateKey, workCenterStateKey, resourceStateKey, dispatchStateKey, sosStateKey, familyStateKey };

  const explicitCommandResponse = await routeExplicitTelegramCommand(db, update, command, stateKeys, telemetry);
  if (explicitCommandResponse) {
    emitTelegramIntentRouterTelemetry('bypassed', 'explicit_command');
    return explicitCommandResponse;
  }

  if (command) {
    emitTelegramIntentRouterTelemetry('bypassed', 'unhandled_command');
    return handleTelegramIncidentJoinConversation(db, update, joinStateKey, telemetry);
  }

  const routedFamily = await routeExistingTelegramFlow(
    db,
    familyStateKey,
    safeParseTelegramFamilyReunificationState,
    { step: 'idle' } satisfies TelegramFamilyReunificationState,
    (state) => handleTelegramFamilyReunificationConversation(db, update, familyStateKey, state, telemetry),
  );
  if (routedFamily) {
    emitTelegramIntentRouterTelemetry('bypassed', 'active_flow');
    return routedFamily;
  }

  const routedSos = await routeExistingTelegramFlow(db, sosStateKey, safeParseTelegramSosState, { step: 'idle' } satisfies TelegramSosState, (state) =>
    handleTelegramSosConversation(db, update, sosStateKey, state, telemetry),
  );
  if (routedSos) {
    emitTelegramIntentRouterTelemetry('bypassed', 'active_flow');
    return routedSos;
  }

  const routedResource = await routeExistingTelegramFlow(
    db,
    resourceStateKey,
    safeParseTelegramResourceReportState,
    { step: 'idle' } satisfies TelegramResourceReportState,
    (state) => handleTelegramResourceConversation(db, update, resourceStateKey, state, telemetry),
  );
  if (routedResource) {
    emitTelegramIntentRouterTelemetry('bypassed', 'active_flow');
    return routedResource;
  }

  const routedDispatch = await routeExistingTelegramFlow(
    db,
    dispatchStateKey,
    safeParseTelegramDispatchTaskState,
    { step: 'idle' } satisfies TelegramDispatchTaskState,
    (state) => handleTelegramDispatchConversation(db, update, dispatchStateKey, state, telemetry),
  );
  if (routedDispatch) {
    emitTelegramIntentRouterTelemetry('bypassed', 'active_flow');
    return routedDispatch;
  }

  const routedWorkCenter = await routeExistingTelegramFlow(
    db,
    workCenterStateKey,
    safeParseTelegramWorkCenterReportState,
    { step: 'idle' } satisfies TelegramWorkCenterReportState,
    (state) => handleTelegramWorkCenterConversation(db, update, workCenterStateKey, state, telemetry),
  );
  if (routedWorkCenter) {
    emitTelegramIntentRouterTelemetry('bypassed', 'active_flow');
    return routedWorkCenter;
  }

  const routedJoin = await routeExistingTelegramFlow(
    db,
    joinStateKey,
    safeParseTelegramIncidentJoinState,
    { step: 'idle' } satisfies TelegramIncidentJoinState,
    (state) => handleTelegramIncidentJoinConversation(db, update, joinStateKey, telemetry),
  );
  if (routedJoin) {
    emitTelegramIntentRouterTelemetry('bypassed', 'active_flow');
    return routedJoin;
  }

  const classifiedResponse = await routeClassifiedTelegramIntent(env, db, update, stateKeys, telemetry);
  if (classifiedResponse) {
    return classifiedResponse;
  }

  return handleTelegramIncidentJoinConversation(db, update, joinStateKey, telemetry);
}

type TelegramConversationStateKeys = {
  joinStateKey: string | null;
  workCenterStateKey: string | null;
  resourceStateKey: string | null;
  dispatchStateKey: string | null;
  sosStateKey: string | null;
  familyStateKey: string | null;
};

type AcceptedTelegramIntent = Exclude<TelegramIntentClassification['intent'], 'unknown' | 'ambiguous'>;

type TelegramAcceptedIntentFlowContext = TelegramFlowContext<AcceptedTelegramIntent>;

async function routeExplicitTelegramCommand(
  db: D1Database,
  update: TelegramUpdateLike,
  command: string | null,
  stateKeys: TelegramConversationStateKeys,
  telemetry?: ChannelTelemetryPort,
): Promise<string | null> {
  const operationalUpdateCommand = await handleTelegramOperationalUpdateCommand(update, createTelegramOperationalUpdateApiPorts(db));
  if (operationalUpdateCommand.handled) {
    await deleteTelegramConversationStates(db, [
      stateKeys.joinStateKey,
      stateKeys.workCenterStateKey,
      stateKeys.resourceStateKey,
      stateKeys.dispatchStateKey,
      stateKeys.sosStateKey,
      stateKeys.familyStateKey,
    ]);
    return operationalUpdateCommand.responseText;
  }

  if (command === '/start') {
    await deleteTelegramConversationStates(db, [
      stateKeys.workCenterStateKey,
      stateKeys.resourceStateKey,
      stateKeys.dispatchStateKey,
      stateKeys.sosStateKey,
      stateKeys.familyStateKey,
    ]);
    return handleTelegramIncidentJoinConversation(db, update, stateKeys.joinStateKey, telemetry);
  }

  if (command === '/workcenter') {
    await deleteTelegramConversationStates(db, [stateKeys.resourceStateKey, stateKeys.dispatchStateKey, stateKeys.sosStateKey, stateKeys.familyStateKey]);
    return handleTelegramWorkCenterConversation(db, update, stateKeys.workCenterStateKey, undefined, telemetry);
  }

  if (command === '/resource') {
    await deleteTelegramConversationStates(db, [stateKeys.workCenterStateKey, stateKeys.dispatchStateKey, stateKeys.sosStateKey, stateKeys.familyStateKey]);
    return handleTelegramResourceConversation(db, update, stateKeys.resourceStateKey, undefined, telemetry);
  }

  if (command === '/dispatch') {
    await deleteTelegramConversationStates(db, [stateKeys.workCenterStateKey, stateKeys.resourceStateKey, stateKeys.sosStateKey, stateKeys.familyStateKey]);
    return handleTelegramDispatchConversation(db, update, stateKeys.dispatchStateKey, undefined, telemetry);
  }

  if (command === '/sos') {
    await deleteTelegramConversationStates(db, [stateKeys.workCenterStateKey, stateKeys.resourceStateKey, stateKeys.dispatchStateKey, stateKeys.familyStateKey]);
    return handleTelegramSosConversation(db, update, stateKeys.sosStateKey, undefined, telemetry);
  }

  if (command === '/familia' || command === '/reunificacion') {
    await deleteTelegramConversationStates(db, [
      stateKeys.joinStateKey,
      stateKeys.workCenterStateKey,
      stateKeys.resourceStateKey,
      stateKeys.dispatchStateKey,
      stateKeys.sosStateKey,
    ]);
    return handleTelegramFamilyReunificationConversation(db, update, stateKeys.familyStateKey, undefined, telemetry);
  }

  return null;
}

function createTelegramOperationalUpdateApiPorts(db: D1Database): TelegramOperationalUpdatePorts {
  return {
    async listUpdates(incidentId, cellId, input) {
      const actor = await resolveOperationalUpdateActor(db, incidentId, input?.channel, input?.externalId);
      if (!actor.success) {
        throw new Error(actor.error);
      }

      const response = await listOperationalUpdates(db, incidentId, cellId, input?.cursor ?? null, input?.limit ?? 5, actor.actor);
      if (!response.success) {
        throw new Error(response.error);
      }

      return OperationalUpdatePullResponseSchema.parse(response.body);
    },
    async ackUpdate(incidentId, updateId, request) {
      return callOperationalUpdateAction(db, incidentId, updateId, 'ack', request);
    },
    async openUpdate(incidentId, updateId, request) {
      return callOperationalUpdateAction(db, incidentId, updateId, 'open', request);
    },
    async corroborateUpdate(incidentId, updateId, request) {
      return callOperationalUpdateCorroborateAction(db, incidentId, updateId, request);
    },
    async disputeUpdate(incidentId, updateId, request) {
      return callOperationalUpdateDisputeAction(db, incidentId, updateId, request);
    },
  };
}

async function callOperationalUpdateAction(
  db: D1Database,
  incidentId: string,
  updateId: string,
  actionType: 'ack' | 'open',
  request: OperationalUpdateActionRequest,
) {
  const response = await handleOperationalUpdateBasicAction(db, incidentId, updateId, actionType, request);
  if (!response.ok) {
    throw new Error(`operational_update_${actionType}_failed`);
  }

  return OperationalUpdateActionResponseSchema.parse(await response.json());
}


async function callOperationalUpdateCorroborateAction(
  db: D1Database,
  incidentId: string,
  updateId: string,
  request: OperationalUpdateCorroborateRequest,
) {
  const response = await handleOperationalUpdateCorroborateAction(db, incidentId, updateId, request);
  if (!response.ok) {
    throw new Error('operational_update_corroborate_failed');
  }

  return OperationalUpdateActionResponseSchema.parse(await response.json());
}

async function callOperationalUpdateDisputeAction(
  db: D1Database,
  incidentId: string,
  updateId: string,
  request: OperationalUpdateDisputeRequest,
) {
  const response = await handleOperationalUpdateDisputeAction(db, incidentId, updateId, request);
  if (!response.ok) {
    throw new Error('operational_update_dispute_failed');
  }

  return OperationalUpdateActionResponseSchema.parse(await response.json());
}

async function routeClassifiedTelegramIntent(
  env: Env,
  db: D1Database,
  update: TelegramUpdateLike,
  stateKeys: TelegramConversationStateKeys,
  telemetry?: ChannelTelemetryPort,
): Promise<string | null> {
  const config = resolveTelegramIntentRouterConfig(env);
  if (!config.enabled) {
    emitTelegramIntentRouterTelemetry('bypassed', 'disabled');
    return null;
  }

  const ai = getTelegramIntentAiBinding(env);
  if (!ai) {
    emitTelegramIntentRouterTelemetry('bypassed', 'ai_unavailable');
    return null;
  }

  const text = update.message?.text?.trim() ?? '';
  if (!text) {
    emitTelegramIntentRouterTelemetry('bypassed', 'empty_message');
    return null;
  }

  const preferredLocale = resolveTelegramLocale(update);

  const classification = await classifyTelegramIntent({
    ai,
    text,
    model: config.model,
    confidenceThreshold: config.confidenceThreshold,
    context: {
      command: null,
      locale: preferredLocale,
      messageType: update.message?.chat?.type,
    },
  });

  if (!isActionableTelegramIntentClassification(classification, config.confidenceThreshold)) {
    emitTelegramIntentRouterTelemetry('rejected', `classification:${classification.intent}`, classification.confidence);
    return buildTelegramIntentClarificationResponse(preferredLocale);
  }

  emitTelegramIntentRouterTelemetry('accepted', `classification:${classification.intent}`, classification.confidence);
  return routeAcceptedTelegramIntent(db, update, classification, stateKeys, preferredLocale, text, telemetry);
}

async function routeAcceptedTelegramIntent(
  db: D1Database,
  update: TelegramUpdateLike,
  classification: TelegramIntentClassification & { intent: AcceptedTelegramIntent },
  stateKeys: TelegramConversationStateKeys,
  preferredLocale: SupportedLocale,
  originalText: string,
  telemetry?: ChannelTelemetryPort,
): Promise<string> {
  const flowContext = buildTelegramAcceptedIntentFlowContext(classification, preferredLocale, originalText);

  switch (classification.intent) {
    case 'resource':
      await deleteTelegramConversationStates(db, [stateKeys.workCenterStateKey, stateKeys.dispatchStateKey, stateKeys.sosStateKey, stateKeys.familyStateKey]);
      return handleTelegramResourceConversation(
        db,
        update,
        stateKeys.resourceStateKey,
        undefined,
        telemetry,
        flowContext.sourceIntent === 'resource' ? flowContext : undefined,
      );
    case 'workcenter':
      await deleteTelegramConversationStates(db, [stateKeys.resourceStateKey, stateKeys.dispatchStateKey, stateKeys.sosStateKey, stateKeys.familyStateKey]);
      return handleTelegramWorkCenterConversation(
        db,
        update,
        stateKeys.workCenterStateKey,
        undefined,
        telemetry,
        flowContext.sourceIntent === 'workcenter' ? flowContext : undefined,
      );
    case 'family_reunification':
      await deleteTelegramConversationStates(db, [
        stateKeys.joinStateKey,
        stateKeys.workCenterStateKey,
        stateKeys.resourceStateKey,
        stateKeys.dispatchStateKey,
        stateKeys.sosStateKey,
      ]);
      return handleTelegramFamilyReunificationConversation(
        db,
        update,
        stateKeys.familyStateKey,
        undefined,
        telemetry,
        flowContext.sourceIntent === 'family_reunification' ? flowContext : undefined,
      );
    case 'sos':
      await deleteTelegramConversationStates(db, [stateKeys.workCenterStateKey, stateKeys.resourceStateKey, stateKeys.dispatchStateKey, stateKeys.familyStateKey]);
      return handleTelegramSosConversation(db, update, stateKeys.sosStateKey, undefined, telemetry, flowContext.sourceIntent === 'sos' ? flowContext : undefined);
    case 'dispatch':
      await deleteTelegramConversationStates(db, [stateKeys.workCenterStateKey, stateKeys.resourceStateKey, stateKeys.sosStateKey, stateKeys.familyStateKey]);
      return handleTelegramDispatchConversation(
        db,
        update,
        stateKeys.dispatchStateKey,
        undefined,
        telemetry,
        flowContext.sourceIntent === 'dispatch' ? flowContext : undefined,
      );
    case 'incident_join':
      await deleteTelegramConversationStates(db, [
        stateKeys.workCenterStateKey,
        stateKeys.resourceStateKey,
        stateKeys.dispatchStateKey,
        stateKeys.sosStateKey,
        stateKeys.familyStateKey,
      ]);
      return handleTelegramIncidentJoinConversation(
        db,
        update,
        stateKeys.joinStateKey,
        telemetry,
        flowContext.sourceIntent === 'incident_join' ? flowContext : undefined,
      );
  }
}

function isActionableTelegramIntentClassification(
  classification: TelegramIntentClassification,
  confidenceThreshold: number,
): classification is TelegramIntentClassification & { intent: AcceptedTelegramIntent } {
  return classification.intent !== 'unknown' && classification.intent !== 'ambiguous' && classification.confidence >= confidenceThreshold;
}

function buildTelegramAcceptedIntentFlowContext(
  classification: TelegramIntentClassification & { intent: AcceptedTelegramIntent },
  locale: SupportedLocale,
  originalText = '',
): TelegramAcceptedIntentFlowContext {
  switch (classification.intent) {
    case 'resource': {
      const facts = parseTelegramResourceIntentFacts(classification);
      return { sourceIntent: 'resource', preferredLocale: locale, facts, prefill: facts ?? {}, confidence: classification.confidence };
    }
    case 'workcenter': {
      const facts = parseTelegramWorkCenterIntentFacts(classification);
      return {
        sourceIntent: 'workcenter',
        preferredLocale: locale,
        facts,
        prefill: facts ? buildTelegramWorkCenterIntentPrefill(facts) : {},
        confidence: classification.confidence,
      };
    }
    case 'family_reunification': {
      const facts = parseTelegramFamilyReunificationIntentFacts(classification);
      return { sourceIntent: 'family_reunification', preferredLocale: locale, facts, prefill: facts ?? {}, confidence: classification.confidence };
    }
    case 'sos': {
      const facts = parseTelegramSosIntentFacts(classification) ?? deriveTelegramSosIntentFactsFromText(originalText);
      return { sourceIntent: 'sos', preferredLocale: locale, facts, prefill: facts ?? {}, confidence: classification.confidence };
    }
    case 'dispatch': {
      const facts = parseTelegramDispatchIntentFacts(classification);
      return { sourceIntent: 'dispatch', preferredLocale: locale, facts, prefill: facts ?? {}, confidence: classification.confidence };
    }
    case 'incident_join': {
      const facts = parseTelegramIncidentJoinIntentFacts(classification);
      return { sourceIntent: 'incident_join', preferredLocale: locale, facts, prefill: facts ?? {}, confidence: classification.confidence };
    }
  }
}

function parseTelegramResourceIntentFacts(
  classification: TelegramIntentClassification,
): TelegramResourceIntentFacts | null {
  if (classification.intent !== 'resource') return null;
  const parsed = TelegramResourceIntentFactsSchema.safeParse(classification.extractedFacts);
  return parsed.success ? parsed.data : null;
}

function parseTelegramWorkCenterIntentFacts(
  classification: TelegramIntentClassification,
): TelegramWorkCenterIntentFacts | null {
  if (classification.intent !== 'workcenter') return null;
  const parsed = TelegramWorkCenterIntentFactsSchema.safeParse(classification.extractedFacts);
  return parsed.success ? parsed.data : null;
}

function buildTelegramWorkCenterIntentPrefill(facts: TelegramWorkCenterIntentFacts): Partial<TelegramWorkCenterIntentFacts> {
  const prefill: Partial<TelegramWorkCenterIntentFacts> = {};

  if (facts.name) prefill.name = facts.name;
  if (facts.locationHint) prefill.locationHint = facts.locationHint;
  if (facts.priority) prefill.priority = facts.priority;
  if (facts.initialNeed) prefill.initialNeed = facts.initialNeed;
  if (facts.surplus) prefill.surplus = facts.surplus;

  return prefill;
}

function parseTelegramFamilyReunificationIntentFacts(
  classification: TelegramIntentClassification,
): TelegramFamilyReunificationIntentFacts | null {
  if (classification.intent !== 'family_reunification') return null;
  const parsed = TelegramFamilyReunificationIntentFactsSchema.safeParse(classification.extractedFacts);
  return parsed.success ? parsed.data : null;
}

function parseTelegramSosIntentFacts(classification: TelegramIntentClassification): TelegramSosIntentFacts | null {
  if (classification.intent !== 'sos') return null;
  const parsed = TelegramSosIntentFactsSchema.safeParse(classification.extractedFacts);
  return parsed.success && hasMeaningfulTelegramSosIntentFacts(parsed.data) ? parsed.data : null;
}

function hasMeaningfulTelegramSosIntentFacts(facts: TelegramSosIntentFacts): boolean {
  return facts.severity !== 'other' || Boolean(facts.locationHint || facts.medicalNeed || facts.peopleCount || facts.hazardHint);
}

function deriveTelegramSosIntentFactsFromText(text: string): TelegramSosIntentFacts | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  const facts: Partial<TelegramSosIntentFacts> = {};
  if (/\b(m[eé]dic|ambulancia|herid|injur|medical)\w*/i.test(normalized)) facts.severity = 'medical';
  else if (/\b(atrapad|trapped)\w*/i.test(normalized)) facts.severity = 'trapped';
  else if (/\b(seguridad|security|violencia|violence)\w*/i.test(normalized)) facts.severity = 'security';
  else if (/\b(urgente|emergencia|peligro|danger|urgent|emergency)\b/i.test(normalized)) facts.severity = 'critical';

  const locationHint = extractTelegramSosLocationHint(text);
  if (locationHint) facts.locationHint = locationHint;

  const peopleCount = extractTelegramSosPeopleCount(normalized);
  if (peopleCount !== undefined) facts.peopleCount = peopleCount;

  const hazardHint = extractTelegramSosHazardHint(normalized);
  if (hazardHint) facts.hazardHint = hazardHint;

  if (facts.severity === 'medical' && /\bayuda m[eé]dica urgente\b/i.test(text)) {
    facts.medicalNeed = 'ayuda médica urgente';
  } else if (facts.severity === 'medical') {
    facts.medicalNeed = normalized.includes('medical help') ? 'medical help' : 'ayuda médica';
  }

  const parsed = TelegramSosIntentFactsSchema.safeParse(facts);
  return parsed.success && hasMeaningfulTelegramSosIntentFacts(parsed.data) ? parsed.data : null;
}

function extractTelegramSosLocationHint(text: string): string | undefined {
  const match = text.match(/\b(?:en|at)\s+(?:el|la|los|las|the)?\s*([^.,;]+?)(?=\s+(?:hay|somos|con|with)\b|[.,;]|$)/i);
  const candidate = match?.[1]?.trim();
  if (!candidate || candidate.length > 160) return undefined;
  if (/^\/|https?:|@|\+?\d{6,}/.test(candidate)) return undefined;
  return candidate;
}

function extractTelegramSosPeopleCount(text: string): number | undefined {
  const digitMatch = text.match(/\b([1-9]\d{0,3})\s+(?:persona|personas|people|affected|afectad)/i);
  if (digitMatch) return Number(digitMatch[1]);

  const words: Record<string, number> = {
    una: 1,
    uno: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const wordMatch = text.match(/\b(una|uno|dos|tres|cuatro|cinco|six|seven|eight|nine|ten)\s+(?:persona|personas|people|affected|afectad)/i);
  return wordMatch ? words[wordMatch[1].toLowerCase()] : undefined;
}

function extractTelegramSosHazardHint(text: string): string | undefined {
  if (/\bhumo|smoke\b/i.test(text)) return 'humo';
  if (/\bfuego|fire\b/i.test(text)) return 'fuego';
  if (/\binundaci[oó]n|flood/i.test(text)) return 'inundación';
  if (/\bcolapso|collapse/i.test(text)) return 'colapso';
  return undefined;
}

function parseTelegramDispatchIntentFacts(
  classification: TelegramIntentClassification,
): TelegramDispatchIntentFacts | null {
  if (classification.intent !== 'dispatch') return null;
  const parsed = TelegramDispatchIntentFactsSchema.safeParse(classification.extractedFacts);
  return parsed.success ? parsed.data : null;
}

function parseTelegramIncidentJoinIntentFacts(
  classification: TelegramIntentClassification,
): TelegramIncidentJoinIntentFacts | null {
  if (classification.intent !== 'incident_join') return null;
  const parsed = TelegramIncidentJoinIntentFactsSchema.safeParse(classification.extractedFacts);
  return parsed.success ? parsed.data : null;
}

function getTelegramIntentAiBinding(env: Env): TelegramIntentAiBinding | null {
  const ai = (env as Env & { AI?: TelegramIntentAiBinding }).AI;
  return ai && typeof ai.run === 'function' ? ai : null;
}

function emitTelegramIntentRouterTelemetry(result: 'accepted' | 'rejected' | 'bypassed', action: string, confidence?: number): void {
  logStructuredOperationalEvent({
    event: 'operation.processed',
    category: 'sync',
    result,
    channel: 'telegram',
    scope: 'telegram.intent_router',
    action: confidence === undefined ? action : `${action}:confidence_${bucketTelegramIntentConfidence(confidence)}`,
    errorCode: null,
  });
}

function bucketTelegramIntentConfidence(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.75) return 'medium';
  return 'low';
}

function buildTelegramIntentClarificationResponse(locale: SupportedLocale): string {
  if (locale === 'es') {
    return 'No estoy seguro de qué operación necesitas. Responde con /resource, /workcenter, /reunificacion, /sos, /dispatch o /start.';
  }

  return 'I’m not sure which operation you need. Reply with /resource, /workcenter, /reunificacion, /sos, /dispatch, or /start.';
}

async function handleTelegramIncidentJoinConversation(
  db: D1Database,
  update: TelegramUpdateLike,
  stateKey: string | null,
  telemetry?: ChannelTelemetryPort,
  flowContext?: Extract<TelegramAcceptedIntentFlowContext, { sourceIntent: 'incident_join' }>,
): Promise<string> {
  const currentState = stateKey
    ? await loadTelegramConversationState(db, stateKey, safeParseTelegramIncidentJoinState, { step: 'idle' } satisfies TelegramIncidentJoinState)
    : ({ step: 'idle' } satisfies TelegramIncidentJoinState);
  const ports = createTelegramIncidentJoinPorts(db, telemetry);
  const result = await handleTelegramIncidentJoinFlow(currentState, update, ports, flowContext);

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
  telemetry?: ChannelTelemetryPort,
  flowContext?: Extract<TelegramAcceptedIntentFlowContext, { sourceIntent: 'workcenter' }>,
): Promise<string> {
  const currentState =
    loadedState ??
    (stateKey
      ? await loadTelegramConversationState(db, stateKey, safeParseTelegramWorkCenterReportState, { step: 'idle' } satisfies TelegramWorkCenterReportState)
      : ({ step: 'idle' } satisfies TelegramWorkCenterReportState));
  const ports = createTelegramWorkCenterReportPorts(db, telemetry);
  const result = await handleTelegramWorkCenterReportFlow(currentState, update, ports, flowContext);

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
  telemetry?: ChannelTelemetryPort,
  flowContext?: Extract<TelegramAcceptedIntentFlowContext, { sourceIntent: 'resource' }>,
): Promise<string> {
  const currentState =
    loadedState ??
    (stateKey
      ? await loadTelegramConversationState(db, stateKey, safeParseTelegramResourceReportState, { step: 'idle' } satisfies TelegramResourceReportState)
      : ({ step: 'idle' } satisfies TelegramResourceReportState));
  const ports = createTelegramResourceReportPorts(db, telemetry);
  const result = await handleTelegramResourceReportFlow(currentState, update, ports, flowContext);

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
  telemetry?: ChannelTelemetryPort,
  flowContext?: Extract<TelegramAcceptedIntentFlowContext, { sourceIntent: 'dispatch' }>,
): Promise<string> {
  const currentState =
    loadedState ??
    (stateKey
      ? await loadTelegramConversationState(db, stateKey, safeParseTelegramDispatchTaskState, { step: 'idle' } satisfies TelegramDispatchTaskState)
      : ({ step: 'idle' } satisfies TelegramDispatchTaskState));
  const ports = createTelegramDispatchTaskPorts(db, telemetry);
  const result = await handleTelegramDispatchTaskFlow(currentState, update, ports, flowContext);

  if (stateKey) {
    if (isTerminalLikeTelegramDispatchResult(result.state, result.responseText)) {
      await deleteTelegramConversationState(db, stateKey);
    } else {
      await persistTelegramConversationState(db, stateKey, result.state);
    }
  }

  return result.responseText;
}

async function handleTelegramFamilyReunificationConversation(
  db: D1Database,
  update: TelegramUpdateLike,
  stateKey: string | null,
  loadedState?: TelegramFamilyReunificationState,
  telemetry?: ChannelTelemetryPort,
  flowContext?: Extract<TelegramAcceptedIntentFlowContext, { sourceIntent: 'family_reunification' }>,
): Promise<string> {
  const currentState =
    loadedState ??
    (stateKey
      ? await loadTelegramConversationState(db, stateKey, safeParseTelegramFamilyReunificationState, {
          step: 'idle',
        } satisfies TelegramFamilyReunificationState)
      : ({ step: 'idle' } satisfies TelegramFamilyReunificationState));
  const ports = createTelegramFamilyReunificationPorts(db, update, telemetry);
  const result = await handleTelegramFamilyReunificationFlow(currentState, update, ports, flowContext);

  if (stateKey) {
    if (isTerminalTelegramFamilyReunificationState(result.state)) {
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
  telemetry?: ChannelTelemetryPort,
  flowContext?: Extract<TelegramAcceptedIntentFlowContext, { sourceIntent: 'sos' }>,
): Promise<string> {
  const currentState =
    loadedState ??
    (stateKey
      ? await loadTelegramConversationState(db, stateKey, safeParseTelegramSosState, { step: 'idle' } satisfies TelegramSosState)
      : ({ step: 'idle' } satisfies TelegramSosState));
  const ports = createTelegramSosPorts(db, telemetry);
  const result = await handleTelegramSosFlow(currentState, update, ports, flowContext);

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

function createTelegramIncidentJoinPorts(db: D1Database, telemetry?: ChannelTelemetryPort): TelegramIncidentJoinPorts {
  return {
    telemetry,
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

function createTelegramWorkCenterReportPorts(db: D1Database, telemetry?: ChannelTelemetryPort): TelegramWorkCenterReportPorts {
  return {
    telemetry,
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
    async getChannelFreshness(incidentId) {
      const incident = await findIncident(db, incidentId);
      if (!incident) {
        throw Object.assign(new Error('not_found'), { error: 'not_found' });
      }

      return getIncidentSyncFreshness(db, incident.incidentId);
    },
  };
}

function createTelegramResourceReportPorts(db: D1Database, telemetry?: ChannelTelemetryPort): TelegramResourceReportPorts {
  return {
    telemetry,
    async listIncidents() {
      return IncidentListResponseSchema.parse({ incidents: await listIncidents(db) });
    },
    async listResourceNeedRecommendations(input) {
      const recommendations = await recommendTelegramResourceNeeds(db, {
        resourceLabel: input.category,
        resourceType: input.category,
        limit: 5,
      });

      return {
        recommendations: recommendations.map((recommendation) => ({
          incident: {
            incidentId: recommendation.incidentId,
            name: recommendation.incidentName ?? recommendation.incidentId,
            status: recommendation.incidentStatus ?? 'active',
            startsAt: recommendation.incidentStartsAt ?? new Date(0).toISOString(),
            locationName: recommendation.incidentLocationName ?? recommendation.incidentName ?? recommendation.incidentId,
          },
          ...(recommendation.workCenterId ? { workCenterId: recommendation.workCenterId } : {}),
          ...(recommendation.workCenterName ? { workCenterName: recommendation.workCenterName } : {}),
          category: recommendation.category,
          quantityApprox: recommendation.quantityApprox,
          urgency: recommendation.urgency,
          score: recommendation.score,
          reasons: recommendation.reasons,
        })),
      };
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

function createTelegramFamilyReunificationPorts(
  db: D1Database,
  update: TelegramUpdateLike,
  telemetry?: ChannelTelemetryPort,
): TelegramFamilyReunificationPorts {
  return {
    telemetry,
    async listIncidents() {
      return IncidentListResponseSchema.parse({ incidents: await listIncidents(db) });
    },
    async createPrivateLink(incidentId, request) {
      const incident = await findIncident(db, incidentId);
      if (!incident) {
        throw Object.assign(new Error('not_found'), { error: 'not_found' });
      }

      const externalId = getTelegramExternalId(update);
      if (!externalId) {
        throw Object.assign(new Error('permission_denied'), { error: 'permission_denied' });
      }

      const membership = await findIncidentMembershipWithPermissions(db, incident.incidentId, 'telegram', externalId);
      if (!membership?.permissions.canReadIncident) {
        throw Object.assign(new Error('permission_denied'), { error: 'permission_denied' });
      }

      const correlationSuffix = crypto.randomUUID();
      const safeRequest = PrivateWebLinkIssueRequestSchema.parse({
        scope: 'family_reunification.search',
        channel: 'telegram',
        externalId,
        displayName: getTelegramDisplayName(update),
        correlationId: `telegram-family-${slug(incident.incidentId)}-${correlationSuffix}`,
        returnState: request.returnState ?? 'web:family-reunification:search',
        ttlSeconds: Math.min(request.ttlSeconds || 600, 900),
        maxUses: 1,
        metadata: { issuedBy: 'telegram-family-reunification-flow' },
      });

      return issuePrivateWebLink(db, incident, safeRequest, membership);
    },
    formatPrivateLinkUrl(response) {
      const params = new URLSearchParams({ token: response.token, correlationId: response.correlationId });
      return `/family-reunification?${params.toString()}`;
    },
  };
}

function createTelegramSosPorts(db: D1Database, telemetry?: ChannelTelemetryPort): TelegramSosPorts {
  return {
    telemetry,
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

function createTelegramDispatchTaskPorts(db: D1Database, telemetry?: ChannelTelemetryPort): TelegramDispatchTaskPorts {
  return {
    telemetry,
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

function getTelegramFamilyReunificationConversationStateKey(update: TelegramUpdateLike): string | null {
  return getTelegramNamespacedConversationStateKey(update, 'family-reunification');
}

function getTelegramNamespacedConversationStateKey(
  update: TelegramUpdateLike,
  flow: 'workcenter' | 'resource' | 'dispatch' | 'sos' | 'family-reunification',
): string | null {
  const baseKey = getTelegramConversationBaseStateKey(update);
  return baseKey ? `flow:${flow}:${baseKey}` : null;
}

function getTelegramExternalId(update: TelegramUpdateLike): string | null {
  const fromId = update.message?.from?.id;
  return fromId == null ? null : String(fromId);
}

function getTelegramDisplayName(update: TelegramUpdateLike): string | undefined {
  const firstName = update.message?.from?.first_name?.trim();
  return firstName || undefined;
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
  request: { channel: Channel; externalId: string; role: IncidentRole; displayName?: string; preferredLocale?: SupportedLocale },
): Promise<IncidentJoinResponse> {
  const channelIdentityId = `chid_${slug(request.channel)}_${slug(request.externalId)}`;
  const permissions: PermissionSnapshot = permissionSnapshots[request.role];
  const incidentMembershipId = `mship_${slug(incident.incidentId)}_${channelIdentityId}_${request.role}`;
  const auditEventId = `audit_join_${slug(incident.incidentId)}_${channelIdentityId}_${request.role}`;

  await db
    .prepare(
      `INSERT OR IGNORE INTO channel_identities (channel_identity_id, channel, external_id, display_name, preferred_locale)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(channelIdentityId, request.channel, request.externalId, request.displayName ?? null, request.preferredLocale ?? null)
    .run();

  if (request.preferredLocale !== undefined) {
    await db.prepare('UPDATE channel_identities SET preferred_locale = ? WHERE channel_identity_id = ?').bind(request.preferredLocale, channelIdentityId).run();
  }

  const channelIdentity = await db
    .prepare(
      `SELECT channel_identity_id AS channelIdentityId, channel, external_id AS externalId, display_name AS displayName, preferred_locale AS preferredLocale
       FROM channel_identities
       WHERE channel_identity_id = ?`,
    )
    .bind(channelIdentityId)
    .first<{ channelIdentityId: string; channel: Channel; externalId: string; displayName: string | null; preferredLocale: string | null }>();

  const preferredLocale = resolveSupportedLocale(channelIdentity?.preferredLocale ?? request.preferredLocale);

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
      ...(channelIdentity?.displayName ? { displayName: channelIdentity.displayName } : {}),
      preferredLocale,
    },
    membership: { incidentMembershipId, incidentId: incident.incidentId, channelIdentityId, role: request.role, permissions },
    audit: { auditEventId },
    idempotent,
  };
}

function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export default app;

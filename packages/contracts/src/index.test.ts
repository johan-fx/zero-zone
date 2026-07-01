import { describe, expect, it } from 'vitest';

import {
  ContractErrorCodeSchema,
  ChannelSchema,
  SupportedLocaleSchema,
  FamilyReunificationSearchRequestSchema,
  FamilyReunificationSearchResponseSchema,
  HealthResponseSchema,
  IncidentConfigResponseSchema,
  IncidentJoinRequestSchema,
  IncidentJoinResponseSchema,
  IncidentListResponseSchema,
  IncidentRoleSchema,
  OperationInputSchema,
  OperationalEventSchema,
  OperationRejectedSchema,
  DispatchEventCreatePayloadSchema,
  DispatchEventUpdatePayloadSchema,
  DispatchTaskConnectedCreateRequestSchema,
  DispatchTaskConnectedUpdateRequestSchema,
  DispatchTaskListResponseSchema,
  DispatchTaskResponseSchema,
  DispatchTaskStatusSchema,
  PendingSignedOperationSchema,
  PrivateWebLinkConsumeRequestSchema,
  PrivateWebLinkConsumeResponseSchema,
  PrivateWebLinkIssueRequestSchema,
  PrivateWebLinkIssueResponseSchema,
  PrivateWebLinkValidateRequestSchema,
  PrivateWebLinkValidateResponseSchema,
  ResourceReportConnectedCreateRequestSchema,
  ResourceReportCreateResponseSchema,
  ResourceReportDetailResponseSchema,
  ResourceReportListResponseSchema,
  ResourceReportMatchResponseSchema,
  ResourceReportPayloadSchema,
  SignedOperationSchema,
  SosAlertCreateResponseSchema,
  SosAlertStatusResponseSchema,
  SosCancelPayloadSchema,
  SosConnectedCreateRequestSchema,
  SosCreatePayloadSchema,
  SosFanoutStatusSchema,
  SyncConflictSchema,
  SyncCursorSchema,
  SyncFreshnessSchema,
  SyncPullResponseSchema,
  SyncPushRequestSchema,
  SyncPushResponseSchema,
  TelegramIntentClassificationSchema,
  TelegramIntentSchema,
  WebLinkRequestSchema,
  WebLinkSessionSchema,
  WorkCenterConnectedCreateRequestSchema,
  WorkCenterCreatePayloadSchema,
  WorkCenterCreateResponseSchema,
  WorkCenterDetailResponseSchema,
  WorkCenterListResponseSchema,
  WorkCenterSignalTypeSchema,
  channels,
  supportedLocales,
  defaultSupportedLocale,
  fallbackSupportedLocale,
  resolveSupportedLocale,
  contractErrorCodes,
  contractErrorSemantics,
  incidentRoles,
  operationFamilies,
  operationalEventTypes,
  operationTypeFamilies,
  operationTypes,
  syncStates,
  syncFreshnessStatuses,
  webLinkScopes,
  workCenterActivationStates,
  workCenterConfidenceLevels,
  workCenterFreshnessLevels,
  workCenterRiskLevels,
  dispatchTaskStatuses,
  resourceReportKinds,
  resourceReportUrgencies,
  sosAlertStatuses,
  sosFanoutJobStatuses,
  sosSeverities,
  telegramIntents,
  workCenterStatuses,
} from './index';

const signedOperationFixture = {
  version: 1,
  actorKeyId: 'actor-key-1',
  deviceId: 'device-1',
  incidentId: 'incident-1',
  cellId: 'cell-a',
  entityId: 'incident-1',
  opType: 'incident.create',
  payload: { title: 'Local drill' },
  hlc: '2026-06-29T00:00:00.000Z-0001',
  createdAtDevice: '2026-06-29T00:00:00.000Z',
  opId: 'op-1',
  entityType: 'incident',
  signature: 'signature-1',
  syncState: 'pending',
} as const;

const reconciledOperationTypes = [
  'incident.create',
  'work_center.create',
  'presence.check_in',
  'presence.pause',
  'presence.check_out',
  'resource_report.create',
  'dispatch_event.create',
  'dispatch_event.update',
  'sos.create',
  'sos.cancel',
] as const;

describe('contracts package', () => {
  it('exposes the reconciled mobile-first operation vocabulary and families', () => {
    expect(operationTypes).toEqual(reconciledOperationTypes);
    expect(operationFamilies).toEqual(['incident', 'work_center', 'presence', 'resource_report', 'dispatch_event', 'sos']);
    expect(syncStates).toEqual(['pending', 'sent', 'confirmed', 'conflict', 'rejected']);
    expect(operationTypeFamilies).toEqual({
      'incident.create': 'incident',
      'work_center.create': 'work_center',
      'presence.check_in': 'presence',
      'presence.pause': 'presence',
      'presence.check_out': 'presence',
      'resource_report.create': 'resource_report',
      'dispatch_event.create': 'dispatch_event',
      'dispatch_event.update': 'dispatch_event',
      'sos.create': 'sos',
      'sos.cancel': 'sos',
    });
  });

  it('validates shared operation input and signed operation fixtures', () => {
    const input = OperationInputSchema.parse({
      actorKeyId: 'actor-key-1',
      deviceId: 'device-1',
      incidentId: 'incident-1',
      cellId: 'cell-a',
      entityId: 'incident-1',
      opType: 'incident.create',
      payload: { title: 'Local drill' },
      hlc: '2026-06-29T00:00:00.000Z-0001',
      createdAtDevice: '2026-06-29T00:00:00.000Z',
    });
    const operation = SignedOperationSchema.parse(signedOperationFixture);

    expect(input.version).toBeUndefined();
    expect(operation.version).toBe(1);
    expect(SyncPushRequestSchema.parse({ operations: [operation] }).operations).toHaveLength(1);
  });

  it('keeps signed operations general but restricts sync push requests to pending operations', () => {
    const sentOperation = { ...signedOperationFixture, syncState: 'sent' };

    expect(SignedOperationSchema.parse(sentOperation).syncState).toBe('sent');
    expect(PendingSignedOperationSchema.safeParse(sentOperation).success).toBe(false);
    expect(SyncPushRequestSchema.safeParse({ operations: [sentOperation] }).success).toBe(false);
    expect(SyncPushRequestSchema.parse({ operations: [signedOperationFixture] }).operations[0]?.syncState).toBe('pending');
  });

  it('rejects unsupported operation names and non-JSON payloads as invalid payloads', () => {
    expect(SignedOperationSchema.safeParse({ ...signedOperationFixture, opType: 'sos.raise' }).success).toBe(false);
    expect(SignedOperationSchema.safeParse({ ...signedOperationFixture, payload: { title: undefined } }).success).toBe(false);
    expect(OperationRejectedSchema.parse({ status: 'rejected', code: 'invalid_payload', opId: 'op-1' })).toEqual({
      status: 'rejected',
      code: 'invalid_payload',
      opId: 'op-1',
    });
  });

  it('rejects invalid signatures and mismatched operation families', () => {
    expect(SignedOperationSchema.safeParse({ ...signedOperationFixture, signature: '' }).success).toBe(false);
    expect(SignedOperationSchema.safeParse({ ...signedOperationFixture, entityType: 'sos' }).success).toBe(false);
    expect(OperationRejectedSchema.parse({ status: 'rejected', code: 'invalid_signature', opId: 'op-1' }).code).toBe('invalid_signature');
  });

  it('validates sync push responses with accepted and rejected operation results', () => {
    const serverUpdatedAt = '2026-07-01T09:30:00.000Z';

    expect(
      SyncPushResponseSchema.parse({
        results: [
          { opId: 'op-1', status: 'accepted', entityId: 'entity-1', serverVersion: 1, serverUpdatedAt },
          {
            opId: 'op-2',
            status: 'rejected',
            code: 'operation_conflict',
            conflict: { opId: 'op-2', entityId: 'entity-2', code: 'operation_conflict', message: 'payload hash mismatch' },
          },
        ],
        cursor: 'cursor-1',
      }),
    ).toEqual({
      results: [
        { opId: 'op-1', status: 'accepted', entityId: 'entity-1', serverVersion: 1, serverUpdatedAt },
        {
          opId: 'op-2',
          status: 'rejected',
          code: 'operation_conflict',
          conflict: { opId: 'op-2', entityId: 'entity-2', code: 'operation_conflict', message: 'payload hash mismatch' },
        },
      ],
      cursor: 'cursor-1',
    });
  });

  it('validates strict sync pull, cursor, conflict, and freshness contracts', () => {
    const serverUpdatedAt = '2026-07-01T09:30:00.000Z';
    const cursor = SyncCursorSchema.parse({
      incidentId: 'incident-1',
      cellId: 'cell-a',
      sequence: 7,
      issuedAt: serverUpdatedAt,
    });
    expect(cursor.sequence).toBe(7);
    expect(SyncCursorSchema.safeParse({ ...cursor, extra: true }).success).toBe(false);

    const conflict = SyncConflictSchema.parse({
      opId: 'op-2',
      entityId: 'center-2',
      entityType: 'work_center',
      code: 'operation_conflict',
      serverVersion: 7,
      serverUpdatedAt,
    });
    expect(conflict.code).toBe('operation_conflict');
    expect(SyncConflictSchema.safeParse({ ...conflict, visualResolution: 'client decides' }).success).toBe(false);

    const freshness = SyncFreshnessSchema.parse({
      status: 'stale',
      lastFreshAt: serverUpdatedAt,
      lastSyncedAt: serverUpdatedAt,
      cursorLag: 2,
      hasConflicts: true,
      channels: [
        {
          channel: 'mobile',
          status: 'stale',
          lastFreshAt: serverUpdatedAt,
          lastSyncedAt: serverUpdatedAt,
          cursorLag: 2,
          hasConflicts: true,
        },
      ],
    });
    expect(freshness.cursorLag).toBe(2);

    const pull = SyncPullResponseSchema.parse({
      operations: [
        {
          sequence: 7,
          serverVersion: 7,
          serverUpdatedAt,
          operation: { ...signedOperationFixture, syncState: 'confirmed' },
        },
      ],
      cursor: 'cursor-token',
      hasMore: false,
      freshness,
      conflicts: [conflict],
    });
    expect(pull.operations[0]?.operation.syncState).toBe('confirmed');
    expect(SyncPullResponseSchema.safeParse({ ...pull, debug: true }).success).toBe(false);
    expect(syncFreshnessStatuses).toEqual(['fresh', 'stale', 'expired', 'missing']);
  });

  it('validates supported locale contracts without accepting arbitrary locale tags', () => {
    expect(supportedLocales).toEqual(['es', 'en']);
    expect(defaultSupportedLocale).toBe('es');
    expect(fallbackSupportedLocale).toBe('en');
    expect(SupportedLocaleSchema.parse('es')).toBe('es');
    expect(SupportedLocaleSchema.parse('en')).toBe('en');
    expect(SupportedLocaleSchema.safeParse('fr').success).toBe(false);
    expect(SupportedLocaleSchema.safeParse('es-ES').success).toBe(false);
    expect(resolveSupportedLocale('en')).toBe('en');
    expect(resolveSupportedLocale('fr')).toBe('es');
    expect(resolveSupportedLocale(undefined, fallbackSupportedLocale)).toBe('en');
  });

  it('validates channel identity and join locale as canonical supported codes', () => {
    const join = IncidentJoinRequestSchema.parse({ channel: 'telegram', externalId: 'telegram-user-1', role: 'volunteer', preferredLocale: 'en' });
    expect(join.preferredLocale).toBe('en');
    expect(IncidentJoinRequestSchema.safeParse({ ...join, preferredLocale: 'fr' }).success).toBe(false);

    const response = IncidentJoinResponseSchema.parse({
      incident: { incidentId: 'incident-1', name: 'Drill', status: 'active', startsAt: '2026-07-01T00:00:00.000Z', locationName: 'North zone' },
      channelIdentity: { channelIdentityId: 'chid-1', channel: 'telegram', externalId: 'telegram-user-1', preferredLocale: 'es' },
      membership: {
        incidentMembershipId: 'mship-1',
        incidentId: 'incident-1',
        channelIdentityId: 'chid-1',
        role: 'volunteer',
        permissions: { canReadIncident: true, canJoinIncident: true, canManageIncident: false, canManageLogistics: false, canManageMedical: false },
      },
      audit: { auditEventId: 'audit-1' },
      idempotent: false,
    });
    expect(response.channelIdentity.preferredLocale).toBe('es');
    expect(IncidentJoinResponseSchema.safeParse({ ...response, channelIdentity: { ...response.channelIdentity, preferredLocale: 'de' } }).success).toBe(false);
  });

  it('exposes stable contract error codes', () => {
    expect(contractErrorCodes).toEqual([
      'invalid_payload',
      'invalid_operation_version',
      'invalid_signature',
      'unauthorized_operation',
      'permission_denied',
      'scope_mismatch',
      'stale_cursor',
      'duplicate_operation',
      'operation_conflict',
      'not_found',
      'unsupported_operation_type',
      'link_expired',
      'invalid_link_scope',
      'link_correlation_mismatch',
      'rate_limited',
      'turnstile_failed',
      'security_challenge_required',
    ]);
    expect(ContractErrorCodeSchema.parse('unsupported_operation_type')).toBe('unsupported_operation_type');
    expect(ContractErrorCodeSchema.parse('scope_mismatch')).toBe('scope_mismatch');
    expect(ContractErrorCodeSchema.parse('rate_limited')).toBe('rate_limited');
    expect(ContractErrorCodeSchema.parse('turnstile_failed')).toBe('turnstile_failed');
    expect(ContractErrorCodeSchema.parse('security_challenge_required')).toBe('security_challenge_required');
    expect(Object.keys(contractErrorSemantics)).toEqual([...contractErrorCodes]);
    expect(contractErrorSemantics.link_expired.visibleMappingKey.telegram).toBe('telegram.error.link_expired');
    expect(contractErrorSemantics.invalid_operation_version.visibleMappingKey.web).toBe('web.error.invalid_operation_version');
  });

  it('validates minimized operational event taxonomy for backend observability', () => {
    expect(operationalEventTypes).toEqual([
      'operational.audit.recorded',
      'operation.processed',
      'private_link.attempted',
      'rate_limit.checked',
      'turnstile.checked',
      'security.challenge.required',
    ]);

    const event = OperationalEventSchema.parse({
      event: 'operation.processed',
      category: 'sync',
      result: 'rejected',
      channel: 'mobile',
      opType: 'sos.create',
      errorCode: 'rate_limited',
      latencyMs: 12,
    });
    expect(event.sampled).toBe(true);
    expect(OperationalEventSchema.safeParse({ ...event, token: 'secret-token' }).success).toBe(false);
    expect(OperationalEventSchema.safeParse({ ...event, fingerprint: 'raw-browser-fingerprint' }).success).toBe(false);
    expect(OperationalEventSchema.safeParse({ ...event, latitude: 41.38, longitude: 2.17 }).success).toBe(false);
  });

  it('validates strict private web link contracts for family reunification', () => {
    const issueRequest = PrivateWebLinkIssueRequestSchema.parse({
      scope: 'family_reunification.search',
      channel: 'web-ui',
      externalId: 'web-user-1001',
      correlationId: 'corr-family-1',
      returnState: 'web:family-reunification:search',
      ttlSeconds: 600,
      maxUses: 1,
      metadata: { source: 'telegram-private-link' },
    });
    expect(issueRequest.scope).toBe('family_reunification.search');
    expect(PrivateWebLinkIssueRequestSchema.safeParse({ ...issueRequest, unexpected: true }).success).toBe(false);
    expect(PrivateWebLinkIssueRequestSchema.safeParse({ ...issueRequest, scope: 'admin.raw' }).success).toBe(false);

    expect(
      PrivateWebLinkIssueResponseSchema.parse({
        linkId: 'pwl_1',
        token: 'opaque-private-token',
        scope: 'family_reunification.search',
        incidentId: 'incident-zc-demo',
        correlationId: 'corr-family-1',
        returnState: 'web:family-reunification:search',
        expiresAt: '2026-07-01T09:00:00.000Z',
        maxUses: 1,
        audit: { auditEventId: 'audit_private_link_issued_1' },
      }).maxUses,
    ).toBe(1);

    const validateRequest = {
      token: 'opaque-private-token',
      scope: 'family_reunification.search',
      correlationId: 'corr-family-1',
      fingerprint: 'browser-fingerprint-fixture',
    } as const;
    expect(PrivateWebLinkValidateRequestSchema.parse(validateRequest).fingerprint).toBe(validateRequest.fingerprint);
    expect(PrivateWebLinkValidateRequestSchema.safeParse({ ...validateRequest, photo: 'not allowed' }).success).toBe(false);
    expect(
      PrivateWebLinkValidateResponseSchema.parse({
        valid: true,
        linkId: 'pwl_1',
        scope: 'family_reunification.search',
        incidentId: 'incident-zc-demo',
        correlationId: 'corr-family-1',
        expiresAt: '2026-07-01T09:00:00.000Z',
        remainingUses: 1,
        nextAction: 'in_person_verification',
        audit: { auditEventId: 'audit_private_link_validated_1' },
      }).nextAction,
    ).toBe('in_person_verification');

    expect(
      PrivateWebLinkConsumeRequestSchema.parse({
        ...validateRequest,
        referralReason: 'family_reunification_in_person_verification',
      }).referralReason,
    ).toBe('family_reunification_in_person_verification');
    expect(
      PrivateWebLinkConsumeResponseSchema.parse({
        accepted: true,
        linkId: 'pwl_1',
        referral: {
          type: 'in_person_verification',
          reasonCode: 'family_reunification_in_person_verification',
          messageCode: 'family_reunification.referral.in_person_verification',
          message: 'family_reunification.referral.in_person_verification',
        },
        audit: { auditEventId: 'audit_private_link_consumed_1' },
      }).referral.type,
    ).toBe('in_person_verification');
  });

  it('keeps family reunification search responses minimized and strict', () => {
    const request = FamilyReunificationSearchRequestSchema.parse({
      token: 'opaque-private-token',
      correlationId: 'corr-family-1',
      fingerprint: 'browser-fingerprint-fixture',
      query: {
        ageBand: 'child',
        relationHint: 'parent looking for child',
        lastKnownAreaLabel: 'north gate area',
      },
    });
    expect(request.query.ageBand).toBe('child');

    const response = FamilyReunificationSearchResponseSchema.parse({
      matches: [{
        matchId: 'match_stub_1',
        status: 'possible_match',
        reasonCode: 'family_reunification.match.family_desk_compare_details',
        ageBand: 'child',
        lastKnownAreaLabel: 'north gate area',
        verificationRequired: true,
      }],
      referral: {
        type: 'in_person_verification',
        reasonCode: 'family_reunification_in_person_verification',
        messageCode: 'family_reunification.referral.in_person_verification',
        message: 'family_reunification.referral.in_person_verification',
      },
      audit: { auditEventId: 'audit_family_search_1' },
    });

    expect(response.matches[0]?.reasonCode).toBe('family_reunification.match.family_desk_compare_details');
    expect(response.referral.reasonCode).toBe('family_reunification_in_person_verification');
    expect(response.referral.messageCode).toBe('family_reunification.referral.in_person_verification');
    expect(JSON.stringify(response)).not.toMatch(/photo|latitude|longitude|fullName|exactLocation/i);
    expect(JSON.stringify(response)).not.toMatch(/family desk|visit the family reunification desk/i);
    expect(FamilyReunificationSearchResponseSchema.safeParse({
      ...response,
      matches: [{ ...response.matches[0], fullName: 'Sensitive Minor Name' }],
    }).success).toBe(false);
  });

  it('validates canonical work center contracts and stable derived-state enums', () => {
    expect(workCenterStatuses).toEqual(['reported', 'active', 'inactive', 'archived']);
    expect(workCenterActivationStates).toEqual(['pending_corroboration', 'active', 'needs_review']);
    expect(workCenterFreshnessLevels).toEqual(['fresh', 'stale', 'expired']);
    expect(workCenterConfidenceLevels).toEqual(['low', 'medium', 'high']);
    expect(workCenterRiskLevels).toEqual(['low', 'medium', 'high']);
    expect(WorkCenterSignalTypeSchema.parse('creator_report')).toBe('creator_report');

    const payload = WorkCenterCreatePayloadSchema.parse({
      name: 'North triage point',
      centerType: 'Medical post',
      description: 'Triage and water distribution near the north gate.',
      priority: 'high',
      initialNeed: 'Water',
      surplus: 'none reported',
      location: { latitude: 41.38, longitude: 2.17 },
      reportedAt: '2026-06-30T10:00:00.000Z',
    });

    expect(payload.priority).toBe('high');
    expect(WorkCenterCreatePayloadSchema.parse({ name: 'Minimal center' }).priority).toBe('medium');
    expect(WorkCenterCreatePayloadSchema.safeParse({ name: '', location: { latitude: 120, longitude: 2 } }).success).toBe(false);
    expect(
      WorkCenterConnectedCreateRequestSchema.parse({
        channel: 'telegram',
        externalId: 'telegram-user-1',
        payload,
      }).payload.name,
    ).toBe('North triage point');
  });

  it('validates work center list, detail and create response contracts', () => {
    const summary = {
      workCenterId: 'center-1',
      incidentId: 'incident-1',
      cellId: 'cell-a',
      name: 'North triage point',
      centerType: 'Medical post',
      priority: 'high',
      location: { latitude: 41.38, longitude: 2.17 },
      status: 'reported',
      activationState: 'pending_corroboration',
      freshness: 'fresh',
      confidence: 'low',
      risk: 'medium',
      signalCount: 1,
      corroboratingSignalCount: 1,
      sourceChannel: 'telegram',
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
    } as const;

    const detail = {
      ...summary,
      description: 'Triage and water distribution near the north gate.',
      initialNeed: 'Water',
      surplus: 'none reported',
      latestSignals: [
        {
          signalId: 'sig-1',
          signalType: 'creator_report',
          sourceChannel: 'telegram',
          sourceId: 'telegram-user-1',
          createdAt: '2026-06-30T10:00:00.000Z',
        },
      ],
    } as const;

    expect(WorkCenterListResponseSchema.parse({ workCenters: [summary] }).workCenters[0]?.workCenterId).toBe('center-1');
    expect(WorkCenterDetailResponseSchema.parse({ workCenter: detail }).workCenter.latestSignals[0]?.signalType).toBe('creator_report');
    expect(WorkCenterCreateResponseSchema.parse({ workCenter: detail, audit: { auditEventId: 'audit-1' }, idempotent: false }).idempotent).toBe(false);
  });

  it('validates stable web link scopes and request/session contracts', () => {
    expect(webLinkScopes).toEqual(['incident.join', 'work_center.detail', 'family_reunification.search']);

    const request = WebLinkRequestSchema.parse({
      scope: 'work_center.detail',
      incidentId: 'incident-1',
      entityId: 'center-1',
      channelIdentityId: 'telegram-user-1',
      correlationId: 'corr-1',
      returnState: 'telegram:conversation:work-center',
      ttlSeconds: 600,
      singleUse: true,
      auditContext: {
        channel: 'telegram',
        command: '/centro',
        messageId: 42,
      },
    });

    expect(request.scope).toBe('work_center.detail');
    const { ttlSeconds: _ttlSeconds, ...sessionRequest } = request;
    expect(WebLinkSessionSchema.parse({ ...sessionRequest, token: 'opaque-token-1', expiresAt: '2026-06-30T12:00:00.000Z' }).token).toBe(
      'opaque-token-1',
    );
  });

  it('rejects invalid web link scopes, ttl, correlation and audit context values', () => {
    const validRequest = {
      scope: 'incident.join',
      incidentId: 'incident-1',
      channelIdentityId: 'telegram-user-1',
      correlationId: 'corr-1',
      ttlSeconds: 300,
      singleUse: true,
      auditContext: { channel: 'telegram', command: '/start' },
    };

    expect(WebLinkRequestSchema.safeParse({ ...validRequest, scope: 'admin.raw' }).success).toBe(false);
    expect(WebLinkRequestSchema.safeParse({ ...validRequest, ttlSeconds: 0 }).success).toBe(false);
    expect(WebLinkRequestSchema.safeParse({ ...validRequest, correlationId: '' }).success).toBe(false);
    expect(WebLinkRequestSchema.safeParse({ ...validRequest, auditContext: { command: undefined } }).success).toBe(false);
  });



  it('validates incident list, config and join contracts for Slice 2 channels and roles', () => {
    expect(channels).toEqual(['telegram', 'mobile', 'web-ui']);
    expect(incidentRoles).toEqual(['volunteer', 'coordinator', 'logistics', 'medical']);
    expect(ChannelSchema.parse('telegram')).toBe('telegram');
    expect(IncidentRoleSchema.parse('medical')).toBe('medical');

    const incident = {
      incidentId: 'incident-zc-demo',
      name: 'Zona Cero Demo Incident',
      status: 'active',
      startsAt: '2026-06-30T09:00:00.000Z',
      locationName: 'Operations Base',
    } as const;

    const permissions = {
      canReadIncident: true,
      canJoinIncident: true,
      canManageIncident: false,
      canManageLogistics: false,
      canManageMedical: true,
    };

    expect(IncidentListResponseSchema.parse({ incidents: [incident] }).incidents).toHaveLength(1);
    expect(
      IncidentConfigResponseSchema.parse({
        incident,
        roles: ['volunteer', 'coordinator', 'logistics', 'medical'],
        channels: ['telegram', 'mobile', 'web-ui'],
        permissionSnapshots: {
          volunteer: { ...permissions, canManageMedical: false },
          coordinator: { ...permissions, canManageIncident: true, canManageLogistics: true, canManageMedical: true },
          logistics: { ...permissions, canManageLogistics: true, canManageMedical: false },
          medical: permissions,
        },
      }).channels,
    ).toEqual(['telegram', 'mobile', 'web-ui']);

    expect(IncidentJoinRequestSchema.parse({ channel: 'mobile', externalId: 'device-1', role: 'medical' }).role).toBe('medical');
    expect(
      IncidentJoinResponseSchema.parse({
        incident,
        channelIdentity: { channelIdentityId: 'chid-mobile-1', channel: 'mobile', externalId: 'device-1' },
        membership: {
          incidentMembershipId: 'mship-1',
          incidentId: incident.incidentId,
          channelIdentityId: 'chid-mobile-1',
          role: 'medical',
          permissions,
        },
        audit: { auditEventId: 'audit-1' },
        idempotent: false,
      }).audit.auditEventId,
    ).toBe('audit-1');
  });

  it('rejects invalid incident join role and channel contracts', () => {
    expect(IncidentJoinRequestSchema.safeParse({ channel: 'sms', externalId: 'x', role: 'volunteer' }).success).toBe(false);
    expect(IncidentJoinRequestSchema.safeParse({ channel: 'telegram', externalId: 'x', role: 'admin' }).success).toBe(false);
    expect(IncidentListResponseSchema.safeParse({ incidents: [{ incidentId: '', name: '', status: 'draft' }] }).success).toBe(false);
  });

  it('keeps health response stable for web and e2e smoke tests', () => {
    expect(HealthResponseSchema.parse({ service: 'zona-cero-api', ok: true, version: '0.0.0' })).toEqual({
      service: 'zona-cero-api',
      ok: true,
      version: '0.0.0',
    });
  });

  it('validates Telegram intent classification output as classifier-only contract data', () => {
    expect(telegramIntents).toEqual([
      'resource',
      'workcenter',
      'family_reunification',
      'sos',
      'dispatch',
      'incident_join',
      'unknown',
      'ambiguous',
    ]);
    expect(TelegramIntentSchema.parse('family_reunification')).toBe('family_reunification');

    const classification = TelegramIntentClassificationSchema.parse({
      intent: 'resource',
      confidence: 0.82,
      reason: 'Mentions potable water availability.',
      extractedFacts: {
        category: 'water',
        quantityApprox: '20 boxes',
        location: { label: 'north gate' },
      },
    });

    expect(classification.intent).toBe('resource');
    expect(TelegramIntentClassificationSchema.safeParse({ ...classification, confidence: 1.1 }).success).toBe(false);
    expect(TelegramIntentClassificationSchema.safeParse({ ...classification, intent: 'admin' }).success).toBe(false);
    expect(TelegramIntentClassificationSchema.safeParse({ ...classification, executeCommand: '/resource' }).success).toBe(false);
    expect(TelegramIntentClassificationSchema.safeParse({ ...classification, extractedFacts: { category: undefined } }).success).toBe(false);
  });

  it('validates canonical resource report contracts', () => {
    expect(resourceReportKinds).toEqual(['needed', 'surplus']);
    expect(resourceReportUrgencies).toEqual(['low', 'medium', 'high', 'critical']);

    const payload = ResourceReportPayloadSchema.parse({
      category: 'water',
      quantityApprox: '20 boxes',
      urgency: 'high',
      constraints: ['sealed bottles'],
      reportKind: 'needed',
      workCenterId: 'center-north-triage',
    });
    expect(payload.reportKind).toBe('needed');
    expect(ResourceReportPayloadSchema.safeParse({ ...payload, unknown: true }).success).toBe(false);

    const summary = {
      resourceReportId: 'rr-1',
      incidentId: 'incident-zc-demo',
      cellId: 'cell-a',
      workCenterId: 'center-north-triage',
      category: 'water',
      quantityApprox: '20 boxes',
      urgency: 'high',
      constraints: ['sealed bottles'],
      reportKind: 'needed',
      freshness: 'fresh',
      confidence: 'medium',
      risk: 'medium',
      sourceChannel: 'telegram',
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
    } as const;
    const detail = { ...summary, sourceOperationId: 'op-rr-1', actorKeyId: 'actor-1' } as const;

    expect(ResourceReportListResponseSchema.parse({ resourceReports: [summary] }).resourceReports[0]?.category).toBe('water');
    expect(ResourceReportDetailResponseSchema.parse({ resourceReport: detail }).resourceReport.actorKeyId).toBe('actor-1');
    expect(ResourceReportCreateResponseSchema.parse({ resourceReport: detail, audit: { auditEventId: 'audit-1' }, idempotent: false }).idempotent).toBe(false);
    expect(ResourceReportConnectedCreateRequestSchema.parse({ channel: 'telegram', externalId: 'user-1', payload }).payload.category).toBe('water');
    expect(ResourceReportMatchResponseSchema.parse({ matches: [{ need: summary, surplus: { ...summary, resourceReportId: 'rr-2', reportKind: 'surplus' }, score: 0.8, reasons: ['same_cell'] }] }).matches).toHaveLength(1);
  });

  it('validates dispatch task and event contracts', () => {
    expect(dispatchTaskStatuses).toEqual(['pending', 'accepted', 'en_route', 'delivered', 'cancelled']);
    expect(DispatchTaskStatusSchema.parse('en_route')).toBe('en_route');
    const createPayload = DispatchEventCreatePayloadSchema.parse({ category: 'water', quantityApprox: '20 boxes', targetWorkCenterId: 'center-1' });
    expect(createPayload.status).toBeUndefined();
    expect(DispatchEventUpdatePayloadSchema.parse({ dispatchTaskId: 'dt-1', status: 'delivered' }).status).toBe('delivered');

    const task = {
      dispatchTaskId: 'dt-1',
      incidentId: 'incident-zc-demo',
      cellId: 'cell-a',
      category: 'water',
      quantityApprox: '20 boxes',
      status: 'pending',
      sourceChannel: 'web-ui',
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
    } as const;

    expect(DispatchTaskListResponseSchema.parse({ dispatchTasks: [task] }).dispatchTasks[0]?.dispatchTaskId).toBe('dt-1');
    expect(DispatchTaskResponseSchema.parse({ dispatchTask: task }).dispatchTask.status).toBe('pending');
    expect(DispatchTaskConnectedCreateRequestSchema.parse({ channel: 'web-ui', externalId: 'web-1', payload: createPayload }).payload.category).toBe('water');
    expect(DispatchTaskConnectedUpdateRequestSchema.parse({ channel: 'web-ui', externalId: 'web-1', status: 'accepted' }).status).toBe('accepted');
  });

  it('validates canonical SOS alert contracts without promising rescue delivery', () => {
    expect(sosSeverities).toEqual(['critical', 'medical', 'security', 'trapped', 'other']);
    expect(sosAlertStatuses).toEqual(['open', 'cancelled']);
    expect(sosFanoutJobStatuses).toEqual(['queued', 'pending', 'failed', 'cancelled']);

    const createPayload = SosCreatePayloadSchema.parse({
      severity: 'critical',
      message: 'Need immediate evacuation support',
      location: { latitude: 41.38, longitude: 2.17, accuracyMeters: 15 },
      reportedAt: '2026-06-30T10:00:00.000Z',
    });
    expect(SosCreatePayloadSchema.parse({}).severity).toBe('critical');
    expect(SosCreatePayloadSchema.safeParse({ severity: 'handled' }).success).toBe(false);
    expect(SosCancelPayloadSchema.parse({ reason: 'false alarm', cancelledAt: '2026-06-30T10:05:00.000Z' }).reason).toBe('false alarm');

    const alert = {
      sosAlertId: 'sos-1',
      incidentId: 'incident-zc-demo',
      cellId: 'cell-a',
      severity: createPayload.severity,
      message: createPayload.message,
      location: createPayload.location,
      status: 'open',
      sourceChannel: 'mobile',
      sourceOperationId: 'op-sos-create-1',
      actorKeyId: 'actor-1',
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z',
    } as const;
    const fanout = SosFanoutStatusSchema.parse({ total: 3, queued: 3, pending: 0, failed: 0, cancelled: 0 });

    expect(SosAlertStatusResponseSchema.parse({ sosAlerts: [alert], fanout }).sosAlerts[0]?.status).toBe('open');
    expect(SosAlertCreateResponseSchema.parse({ sosAlert: alert, fanout, idempotent: false }).fanout.queued).toBe(3);
    expect(SosConnectedCreateRequestSchema.parse({ channel: 'telegram', externalId: 'user-1', payload: createPayload }).payload.severity).toBe('critical');
  });

});

import { describe, expect, it } from 'vitest';

import {
  ContractErrorCodeSchema,
  HealthResponseSchema,
  OperationInputSchema,
  OperationRejectedSchema,
  PendingSignedOperationSchema,
  SignedOperationSchema,
  SyncPushRequestSchema,
  SyncPushResponseSchema,
  WebLinkRequestSchema,
  WebLinkSessionSchema,
  contractErrorCodes,
  contractErrorSemantics,
  operationFamilies,
  operationTypeFamilies,
  operationTypes,
  syncStates,
  webLinkScopes,
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
    expect(
      SyncPushResponseSchema.parse({
        results: [
          { opId: 'op-1', status: 'accepted' },
          { opId: 'op-2', status: 'rejected', code: 'duplicate_operation' },
        ],
        cursor: 'cursor-1',
      }),
    ).toEqual({
      results: [
        { opId: 'op-1', status: 'accepted' },
        { opId: 'op-2', status: 'rejected', code: 'duplicate_operation' },
      ],
      cursor: 'cursor-1',
    });
  });

  it('exposes stable contract error codes', () => {
    expect(contractErrorCodes).toEqual([
      'invalid_payload',
      'invalid_signature',
      'unauthorized_operation',
      'stale_cursor',
      'duplicate_operation',
      'unsupported_operation_type',
      'link_expired',
      'invalid_link_scope',
      'link_correlation_mismatch',
    ]);
    expect(ContractErrorCodeSchema.parse('unsupported_operation_type')).toBe('unsupported_operation_type');
    expect(Object.keys(contractErrorSemantics)).toEqual([...contractErrorCodes]);
    expect(contractErrorSemantics.link_expired.visibleMappingKey.telegram).toBe('telegram.error.link_expired');
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
    expect(WebLinkSessionSchema.parse({ ...request, token: 'opaque-token-1', expiresAt: '2026-06-30T12:00:00.000Z' }).token).toBe(
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

  it('keeps health response stable for web and e2e smoke tests', () => {
    expect(HealthResponseSchema.parse({ service: 'zona-cero-api', ok: true, version: '0.0.0' })).toEqual({
      service: 'zona-cero-api',
      ok: true,
      version: '0.0.0',
    });
  });
});

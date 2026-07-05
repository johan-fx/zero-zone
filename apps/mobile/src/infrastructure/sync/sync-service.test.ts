/// <reference types="jest" />

import type { SignedOperation, SyncPullResponse, SyncPushResponse } from '@zona-cero/contracts';
import { createInMemoryLocalOperationDatabase, type SyncOperationLocalDocument } from '@/infrastructure/local-db/local-db';
import { createSignedOperation, FakeOperationSigner } from '@/infrastructure/security';
import { appendSignedOperationAndMaterialize } from '@/infrastructure/oplog/outbox-service';
import { createScopedOperationSyncService } from './sync-service';

async function seedOperation(overrides: Partial<SyncOperationLocalDocument> = {}) {
  const database = createInMemoryLocalOperationDatabase();
  const result = await appendSignedOperationAndMaterialize({
    database,
    signer: new FakeOperationSigner('sync-service-tests'),
    input: {
      actorKeyId: 'actor-key-1',
      deviceId: 'device-1',
      incidentId: 'incident-1',
      cellId: 'cell-a',
      entityId: 'center-local-1',
      opType: 'work_center.create',
      payload: { name: 'Local center' },
      hlc: '2026-06-29T09:00:00.000Z-0001-device-1',
      createdAtDevice: '2026-06-29T09:00:00.000Z',
    },
  });

  if (Object.keys(overrides).length > 0) {
    await database.syncOps.upsert({ ...result.operation, ...overrides });
  }

  return { database, operation: { ...result.operation, ...overrides } as SyncOperationLocalDocument };
}

function emptyPullResponse(overrides: Partial<SyncPullResponse> = {}): SyncPullResponse {
  return {
    operations: [],
    cursor: 'cursor-next',
    hasMore: false,
    freshness: {
      status: 'fresh',
      lastFreshAt: '2026-06-29T09:01:00.000Z',
      lastSyncedAt: '2026-06-29T09:01:00.000Z',
      cursorLag: 0,
      hasConflicts: false,
      channels: [],
    },
    conflicts: [],
    ...overrides,
  };
}

describe('scoped operation sync service', () => {
  it('marks accepted operations confirmed and rematerializes with server metadata without duplicates', async () => {
    const { database, operation } = await seedOperation();
    const push = jest.fn<Promise<SyncPushResponse>, any>().mockResolvedValue({
      results: [{ opId: operation.opId, status: 'accepted', entityId: 'center-server-1', serverVersion: 7, serverUpdatedAt: '2026-06-29T09:02:00.000Z' }],
    });
    const pull = jest.fn<Promise<SyncPullResponse>, any>().mockResolvedValue(emptyPullResponse());
    const service = createScopedOperationSyncService({ database, client: { push, pull }, clock: () => '2026-06-29T09:01:00.000Z' });

    const result = await service.sync({ incidentId: 'incident-1', cellId: 'cell-a' });

    expect(result).toMatchObject({ pushed: 1, confirmed: 1, conflicts: 0, rejected: 0 });
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ incidentId: 'incident-1', cellId: 'cell-a', operations: [operation] }));
    expect(await database.syncOps.findByIncident('incident-1')).toEqual([
      expect.objectContaining({ opId: operation.opId, entityId: 'center-server-1', syncState: 'confirmed', serverVersion: 7, serverUpdatedAt: '2026-06-29T09:02:00.000Z' }),
    ]);
    expect(await database.views.workCenters.findByIncident('incident-1')).toEqual([
      expect.objectContaining({ centerId: 'center-server-1', name: 'Local center', syncState: 'confirmed' }),
    ]);
  });

  it('clears retry metadata when a previously retrying operation is accepted', async () => {
    const { database, operation } = await seedOperation({
      syncState: 'pending',
      retryCount: 2,
      lastSyncAttemptAt: '2026-06-29T09:04:00.000Z',
      nextRetryAt: '2026-06-29T09:05:00.000Z',
      syncErrorCode: 'network_error',
      syncErrorMessage: 'Gateway timeout',
    });
    const service = createScopedOperationSyncService({
      database,
      client: {
        push: jest.fn<Promise<SyncPushResponse>, any>().mockResolvedValue({
          results: [{ opId: operation.opId, status: 'accepted', entityId: 'center-server-1', serverVersion: 8, serverUpdatedAt: '2026-06-29T09:06:00.000Z' }],
        }),
        pull: jest.fn<Promise<SyncPullResponse>, any>().mockResolvedValue(emptyPullResponse()),
      },
      clock: () => '2026-06-29T09:05:30.000Z',
    });

    await service.sync({ incidentId: 'incident-1', cellId: 'cell-a' });

    const [confirmedOperation] = await database.syncOps.findByIncident('incident-1');
    expect(confirmedOperation).toEqual(expect.objectContaining({ opId: operation.opId, syncState: 'confirmed', entityId: 'center-server-1' }));
    expect(confirmedOperation).not.toHaveProperty('retryCount');
    expect(confirmedOperation).not.toHaveProperty('lastSyncAttemptAt');
    expect(confirmedOperation).not.toHaveProperty('nextRetryAt');
    expect(confirmedOperation).not.toHaveProperty('syncErrorCode');
    expect(confirmedOperation).not.toHaveProperty('syncErrorMessage');
  });

  it('records structured push conflicts in operation and UI-visible sync issues', async () => {
    const { database, operation } = await seedOperation();
    const push = jest.fn<Promise<SyncPushResponse>, any>().mockResolvedValue({
      results: [
        {
          opId: operation.opId,
          status: 'rejected',
          code: 'operation_conflict',
          message: 'Server version is newer',
          conflict: {
            opId: operation.opId,
            entityId: operation.entityId,
            entityType: 'work_center',
            code: 'operation_conflict',
            message: 'Server version is newer',
            serverVersion: 9,
            serverUpdatedAt: '2026-06-29T09:03:00.000Z',
          },
        },
      ],
    });
    const service = createScopedOperationSyncService({ database, client: { push, pull: jest.fn().mockResolvedValue(emptyPullResponse()) }, clock: () => '2026-06-29T09:01:00.000Z' });

    const result = await service.sync({ incidentId: 'incident-1', cellId: 'cell-a' });

    expect(result).toMatchObject({ conflicts: 1, rejected: 0 });
    expect(await database.syncOps.findByIncident('incident-1')).toEqual([expect.objectContaining({ opId: operation.opId, syncState: 'conflict', syncErrorCode: 'operation_conflict' })]);
    expect(await database.views.syncIssues.findByIncident('incident-1')).toEqual([
      expect.objectContaining({ state: 'conflict', code: 'operation_conflict', entityId: operation.entityId, serverVersion: 9 }),
    ]);
  });

  it('returns failed pushes to pending with retry metadata instead of losing local state', async () => {
    const { database, operation } = await seedOperation();
    const service = createScopedOperationSyncService({
      database,
      client: { push: jest.fn().mockRejectedValue(new Error('network down')), pull: jest.fn() },
      clock: () => '2026-06-29T09:01:00.000Z',
      retryDelayMs: 1_000,
    });

    await expect(service.sync({ incidentId: 'incident-1', cellId: 'cell-a' })).rejects.toThrow('network down');

    expect(await database.syncOps.findByIncident('incident-1')).toEqual([
      expect.objectContaining({ opId: operation.opId, syncState: 'pending', retryCount: 1, nextRetryAt: '2026-06-29T09:01:01.000Z', syncErrorCode: 'network_error' }),
    ]);
    expect(await database.views.workCenters.findByIncident('incident-1')).toEqual([expect.objectContaining({ centerId: 'center-local-1', syncState: 'pending' })]);
  });

  it('pulls confirmed remote operations idempotently and surfaces server conflicts', async () => {
    const { database, operation } = await seedOperation({ syncState: 'confirmed' });
    const pullOperation = { ...operation, syncState: 'confirmed' as const };
    const service = createScopedOperationSyncService({
      database,
      client: {
        push: jest.fn(),
        pull: jest.fn().mockResolvedValue(
          emptyPullResponse({
            operations: [
              { sequence: 1, serverVersion: 3, serverUpdatedAt: '2026-06-29T09:04:00.000Z', operation: pullOperation },
              { sequence: 2, serverVersion: 3, serverUpdatedAt: '2026-06-29T09:04:00.000Z', operation: pullOperation },
            ],
            conflicts: [{ entityId: 'center-2', entityType: 'work_center', code: 'operation_conflict', message: 'Manual review required', serverVersion: 4 }],
          }),
        ),
      },
      clock: () => '2026-06-29T09:05:00.000Z',
    });

    const result = await service.sync({ incidentId: 'incident-1', cellId: 'cell-a' });

    expect(result).toMatchObject({ pulled: 2, conflicts: 1 });
    expect(await database.views.workCenters.findByIncident('incident-1')).toHaveLength(1);
    expect(await database.views.syncIssues.findByIncident('incident-1')).toEqual([expect.objectContaining({ state: 'conflict', entityId: 'center-2', code: 'operation_conflict' })]);
  });

  it('rematerializes pulled dispatch events without persisting Telegram candidate facts or free ids', async () => {
    const database = createInMemoryLocalOperationDatabase();
    const operation = await createSignedOperation(
      {
        actorKeyId: 'actor-key-1',
        deviceId: 'device-1',
        incidentId: 'incident-1',
        cellId: 'cell-a',
        entityId: 'dispatch-server-1',
        opType: 'dispatch_event.create',
        payload: {
          category: 'Water',
          quantityApprox: '12 boxes',
          dispatchTaskId: 'llm-free-task-id',
          statusCandidate: 'accepted',
          status: 'done',
          facts: { statusCandidate: 'accepted' },
        },
        hlc: '2026-06-29T09:04:00.000Z-dispatch-server-1-device-1',
        createdAtDevice: '2026-06-29T09:04:00.000Z',
      },
      new FakeOperationSigner('sync-service-tests'),
    );
    const service = createScopedOperationSyncService({
      database,
      client: {
        push: jest.fn(),
        pull: jest.fn().mockResolvedValue(
          emptyPullResponse({
            operations: [{ sequence: 1, serverVersion: 3, serverUpdatedAt: '2026-06-29T09:04:30.000Z', operation }],
          }),
        ),
      },
      clock: () => '2026-06-29T09:05:00.000Z',
    });

    const result = await service.sync({ incidentId: 'incident-1', cellId: 'cell-a' });
    const dispatchEvents = await database.views.dispatchEvents.findByIncident('incident-1');

    expect(result).toMatchObject({ pulled: 1 });
    expect(dispatchEvents).toEqual([
      expect.objectContaining({
        dispatchEventId: 'dispatch-server-1',
        dispatchTaskId: 'dispatch-server-1',
        status: 'pending',
      }),
    ]);
    expect(dispatchEvents[0]).not.toHaveProperty('statusCandidate');
    expect(dispatchEvents[0]).not.toHaveProperty('facts');
    expect(JSON.stringify(dispatchEvents[0])).not.toContain('llm-free-task-id');
  });

  it('pushes trust signal operations and rematerializes fallback trust state without local scoring', async () => {
    const database = createInMemoryLocalOperationDatabase();
    const centerSeed = await appendSignedOperationAndMaterialize({
      database,
      signer: new FakeOperationSigner('sync-service-trust-tests'),
      input: {
        actorKeyId: 'actor-key-1',
        deviceId: 'device-1',
        incidentId: 'incident-1',
        cellId: 'cell-a',
        entityId: 'center-1',
        opType: 'work_center.create',
        payload: { name: 'Trust reviewed center' },
        hlc: '2026-06-29T09:03:00.000Z-center-1-device-1',
        createdAtDevice: '2026-06-29T09:03:00.000Z',
      },
    });
    const trustOperation = await createSignedOperation(
      {
        actorKeyId: 'actor-key-1',
        deviceId: 'device-1',
        incidentId: 'incident-1',
        cellId: 'cell-a',
        entityId: 'trust-signal-local-1',
        opType: 'trust_signal.create',
        payload: {
          channel: 'mobile',
          externalId: 'actor-key-1',
          subject: { entityType: 'work_center', entityId: 'center-1', incidentId: 'incident-1' },
          signalType: 'field_attestation',
          sourceKind: 'field_actor',
        },
        hlc: '2026-06-29T09:04:00.000Z-trust-signal-local-1-device-1',
        createdAtDevice: '2026-06-29T09:04:00.000Z',
      },
      new FakeOperationSigner('sync-service-trust-tests'),
    );
    await database.syncOps.upsert(trustOperation);
    const push = jest.fn<Promise<SyncPushResponse>, any>().mockResolvedValue({
      results: [
        { opId: centerSeed.operation.opId, status: 'accepted', serverVersion: 2, serverUpdatedAt: '2026-06-29T09:04:00.000Z' },
        { opId: trustOperation.opId, status: 'accepted', serverVersion: 3, serverUpdatedAt: '2026-06-29T09:04:30.000Z' },
      ],
    });
    const service = createScopedOperationSyncService({
      database,
      client: { push, pull: jest.fn().mockResolvedValue(emptyPullResponse()) },
      clock: () => '2026-06-29T09:05:00.000Z',
    });

    const result = await service.sync({ incidentId: 'incident-1', cellId: 'cell-a' });

    expect(result).toMatchObject({ pushed: 2, confirmed: 2 });
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ operations: [centerSeed.operation, trustOperation] }));
    expect(await database.views.workCenters.findByIncident('incident-1')).toEqual([
      expect.objectContaining({
        centerId: 'center-1',
        trustStatus: 'pending_corroboration',
        trustSignalCount: 1,
        trustDisputeCount: 0,
      }),
    ]);
  });

  it('pulls canonical trust state and projects it onto resource views', async () => {
    const database = createInMemoryLocalOperationDatabase();
    const resource = await createSignedOperation(
      {
        actorKeyId: 'actor-key-1',
        deviceId: 'device-1',
        incidentId: 'incident-1',
        cellId: 'cell-a',
        entityId: 'report-server-1',
        opType: 'resource_report.create',
        payload: { category: 'Water', quantityApprox: '24 boxes', urgency: 'high', constraints: [], reportKind: 'needed' },
        hlc: '2026-06-29T09:04:00.000Z-report-server-1-device-1',
        createdAtDevice: '2026-06-29T09:04:00.000Z',
      },
      new FakeOperationSigner('sync-service-trust-tests'),
    );
    const trustSignal = await createSignedOperation(
      {
        actorKeyId: 'actor-key-1',
        deviceId: 'device-1',
        incidentId: 'incident-1',
        cellId: 'cell-a',
        entityId: 'trust-signal-server-1',
        opType: 'trust_signal.create',
        payload: {
          channel: 'mobile',
          externalId: 'actor-key-1',
          subject: { entityType: 'resource_report', entityId: 'report-server-1', incidentId: 'incident-1' },
          signalType: 'context_corroboration',
          sourceKind: 'system_context',
          trustState: {
            incidentId: 'incident-1',
            subject: { entityType: 'resource_report', entityId: 'report-server-1', incidentId: 'incident-1' },
            status: 'trusted_by_context',
            visibility: 'elevated',
            priorityWeight: 0.8,
            score: 0.8,
            explanation: ['status:trusted_by_context'],
            signalCount: 2,
            disputeCount: 0,
            updatedAt: '2026-06-29T09:05:00.000Z',
          },
        },
        hlc: '2026-06-29T09:05:00.000Z-trust-signal-server-1-device-1',
        createdAtDevice: '2026-06-29T09:05:00.000Z',
      },
      new FakeOperationSigner('sync-service-trust-tests'),
    );
    const service = createScopedOperationSyncService({
      database,
      client: {
        push: jest.fn(),
        pull: jest.fn().mockResolvedValue(
          emptyPullResponse({
            operations: [
              { sequence: 1, serverVersion: 3, serverUpdatedAt: '2026-06-29T09:04:30.000Z', operation: resource },
              { sequence: 2, serverVersion: 4, serverUpdatedAt: '2026-06-29T09:05:30.000Z', operation: trustSignal },
            ],
          }),
        ),
      },
      clock: () => '2026-06-29T09:06:00.000Z',
    });

    await service.sync({ incidentId: 'incident-1', cellId: 'cell-a' });

    expect(await database.views.resourceReports.findByIncident('incident-1')).toEqual([
      expect.objectContaining({
        reportId: 'report-server-1',
        trustStatus: 'trusted_by_context',
        trustSignalCount: 2,
        trustDisputeCount: 0,
      }),
    ]);
  });

  it('emits aggregate sync observability metrics without raw error messages', async () => {
    const { database, operation } = await seedOperation();
    const events: unknown[] = [];
    const service = createScopedOperationSyncService({
      database,
      client: {
        push: jest.fn<Promise<SyncPushResponse>, any>().mockResolvedValue({
          results: [{ opId: operation.opId, status: 'accepted', entityId: 'center-server-1', serverVersion: 7, serverUpdatedAt: '2026-06-29T09:02:00.000Z' }],
        }),
        pull: jest.fn<Promise<SyncPullResponse>, any>().mockResolvedValue(emptyPullResponse()),
      },
      clock: () => '2026-06-29T09:01:00.000Z',
      nowMs: jest.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_125),
      observabilitySink: { record: (event) => { events.push(event); } },
    });

    await service.sync({ incidentId: 'incident-1', cellId: 'cell-a' });

    expect(events).toEqual([
      expect.objectContaining({
        event: 'operation.processed',
        category: 'sync',
        result: 'accepted',
        channel: 'mobile',
        scope: 'mobile.sync',
        action: 'sync.completed',
        pushed: 1,
        pulled: 0,
        confirmed: 1,
        conflicts: 0,
        rejected: 0,
        durationMs: 125,
        failureKind: 'none',
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain('Local center');
    expect(JSON.stringify(events)).not.toContain('incident-1');
    expect(JSON.stringify(events)).not.toContain('cell-a');
  });

  it('does not block retry handling when the observability sink fails', async () => {
    const { database, operation } = await seedOperation();
    const service = createScopedOperationSyncService({
      database,
      client: { push: jest.fn().mockRejectedValue(new Error('raw gateway message with token abc123')), pull: jest.fn() },
      clock: () => '2026-06-29T09:01:00.000Z',
      nowMs: jest.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_050),
      retryDelayMs: 1_000,
      observabilitySink: { record: () => { throw new Error('telemetry unavailable'); } },
    });

    await expect(service.sync({ incidentId: 'incident-1', cellId: 'cell-a' })).rejects.toThrow('raw gateway message with token abc123');
    expect(await database.syncOps.findByIncident('incident-1')).toEqual([
      expect.objectContaining({ opId: operation.opId, syncState: 'pending', retryCount: 1, syncErrorCode: 'network_error' }),
    ]);
  });

});

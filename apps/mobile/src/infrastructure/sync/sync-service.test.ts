/// <reference types="jest" />

import type { SignedOperation, SyncPullResponse, SyncPushResponse } from '@zona-cero/contracts';
import { createInMemoryLocalOperationDatabase, type SyncOperationLocalDocument } from '@/infrastructure/local-db/local-db';
import { FakeOperationSigner } from '@/infrastructure/security';
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
});

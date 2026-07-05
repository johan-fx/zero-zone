/// <reference types="jest" />

import type { OperationalUpdate } from '@zona-cero/contracts';
import { createInMemoryLocalOperationDatabase } from '@/infrastructure/local-db/local-db';
import { createHttpOperationalUpdatesClient, createOperationalUpdatesService, type OperationalUpdatesClient } from './operational-updates-service';

const updateFixture: OperationalUpdate = {
  updateId: 'update-1',
  incidentId: 'incident-1',
  cellId: 'cell-a',
  type: 'resource_need',
  urgency: 'high',
  title: 'Water needed',
  summary: 'North point needs sealed water.',
  source: { kind: 'resource_report', entityId: 'resource-1' },
  reasonCode: 'resource.match.offer_for_open_need',
  subject: { entityType: 'resource_report', entityId: 'resource-1', incidentId: 'incident-1' },
  actions: [
    { type: 'read', label: 'Mark as read' },
    { type: 'ack', label: 'Acknowledge' },
    { type: 'open', label: 'Open detail' },
    { type: 'corroborate', label: 'Corroborate' },
    { type: 'dispute', label: 'Dispute' },
  ],
  createdAt: '2026-06-29T09:00:00.000Z',
  updatedAt: '2026-06-29T09:01:00.000Z',
};

function createJsonResponse(body: unknown, init: { status?: number } = {}): Response {
  return {
    ok: !init.status || init.status < 400,
    status: init.status ?? 200,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('mobile operational updates service', () => {
  it('pulls dedicated operational updates into local views without creating trust decisions', async () => {
    const database = createInMemoryLocalOperationDatabase();
    const client: OperationalUpdatesClient = {
      list: jest.fn().mockResolvedValue({ updates: [updateFixture], cursor: 'cursor-next', hasMore: false }),
      sendAction: jest.fn(),
    };
    const service = createOperationalUpdatesService({ database, client, actorExternalId: 'actor-key-1', clock: () => '2026-06-29T09:02:00.000Z' });

    const result = await service.syncUpdates({ incidentId: 'incident-1', cellId: 'cell-a', limit: 20 });

    expect(result).toMatchObject({ pulled: 1, unread: 1, expired: 0, cursor: 'cursor-next' });
    expect(await database.views.operationalUpdates.findByIncident('incident-1')).toEqual([
      expect.objectContaining({ updateId: 'update-1', reasonCode: 'resource.match.offer_for_open_need', readState: 'unread', lifecycleState: 'active', ackState: 'none', actionState: 'idle' }),
    ]);
    expect(await database.syncOps.findByIncident('incident-1')).toEqual([]);
  });

  it('materializes an absent reasonCode as undefined without breaking the local view', async () => {
    const database = createInMemoryLocalOperationDatabase();
    const { reasonCode: _reasonCode, ...updateWithoutReason } = updateFixture;
    const client: OperationalUpdatesClient = {
      list: jest.fn().mockResolvedValue({ updates: [updateWithoutReason], cursor: null, hasMore: false }),
      sendAction: jest.fn(),
    };
    const service = createOperationalUpdatesService({ database, client, actorExternalId: 'actor-key-1', clock: () => '2026-06-29T09:02:00.000Z' });

    await service.syncUpdates({ incidentId: 'incident-1', cellId: 'cell-a', limit: 20 });

    const stored = await database.views.operationalUpdates.findById('update-1');
    expect(stored).toEqual(expect.objectContaining({ updateId: 'update-1', readState: 'unread' }));
    expect(stored?.reasonCode).toBeUndefined();
  });

  it('queues ACK locally when offline and confirms it when the action endpoint accepts it', async () => {
    const database = createInMemoryLocalOperationDatabase();
    const client: OperationalUpdatesClient = {
      list: jest.fn().mockResolvedValue({ updates: [updateFixture], cursor: null, hasMore: false }),
      sendAction: jest.fn().mockResolvedValue({
        update: { ...updateFixture, delivery: { channel: 'mobile', status: 'acked', attemptCount: 1, ackedAt: '2026-06-29T09:03:00.000Z' } },
        action: { actionId: 'action-1', updateId: 'update-1', actionType: 'ack', status: 'accepted', idempotent: false, createdAt: '2026-06-29T09:03:00.000Z' },
      }),
    };
    const clock = jest
      .fn()
      .mockReturnValueOnce('2026-06-29T09:02:00.000Z')
      .mockReturnValueOnce('2026-06-29T09:02:30.000Z')
      .mockReturnValue('2026-06-29T09:03:00.000Z');
    const service = createOperationalUpdatesService({ database, client, actorExternalId: 'actor-key-1', clock });

    await service.syncUpdates({ incidentId: 'incident-1', cellId: 'cell-a' });
    await service.performAction({ incidentId: 'incident-1', cellId: 'cell-a', updateId: 'update-1', actionType: 'ack', networkAvailable: false });

    expect(await database.operationalUpdateActions.findByIncident('incident-1')).toEqual([expect.objectContaining({ actionType: 'ack', syncState: 'pending' })]);
    expect(await database.views.operationalUpdates.findById('update-1')).toEqual(expect.objectContaining({ readState: 'read', ackState: 'pending', actionState: 'pending' }));

    const result = await service.syncUpdates({ incidentId: 'incident-1', cellId: 'cell-a' });

    expect(result.queuedActions).toBe(1);
    expect(client.sendAction).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'ack', updateId: 'update-1' }));
    expect(await database.operationalUpdateActions.findByIncident('incident-1')).toEqual([expect.objectContaining({ actionType: 'ack', syncState: 'confirmed', receiptId: 'action-1' })]);
    expect(await database.views.operationalUpdates.findById('update-1')).toEqual(expect.objectContaining({ readState: 'read', ackState: 'confirmed', actionState: 'confirmed' }));
  });

  it('keeps failed action attempts pending for retry instead of dropping local state', async () => {
    const database = createInMemoryLocalOperationDatabase();
    const client: OperationalUpdatesClient = {
      list: jest.fn().mockResolvedValue({ updates: [updateFixture], cursor: null, hasMore: false }),
      sendAction: jest.fn().mockRejectedValue(new Error('network down')),
    };
    const service = createOperationalUpdatesService({ database, client, actorExternalId: 'actor-key-1', clock: () => '2026-06-29T09:02:00.000Z' });

    await service.syncUpdates({ incidentId: 'incident-1', cellId: 'cell-a' });
    await expect(service.performAction({ incidentId: 'incident-1', cellId: 'cell-a', updateId: 'update-1', actionType: 'read', networkAvailable: true })).rejects.toThrow('network down');

    expect(await database.operationalUpdateActions.findByIncident('incident-1')).toEqual([expect.objectContaining({ actionType: 'read', syncState: 'pending', errorCode: 'action_sync_failed' })]);
    expect(await database.views.operationalUpdates.findById('update-1')).toEqual(expect.objectContaining({ readState: 'read', actionState: 'pending', lastActionError: 'network down' }));
  });

  it('uses Equipo B dedicated HTTP endpoints for list and safe actions', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ updates: [updateFixture], cursor: 'cursor-next', hasMore: false }))
      .mockResolvedValueOnce(createJsonResponse({ update: updateFixture, action: { actionId: 'action-1', updateId: 'update-1', actionType: 'read', status: 'accepted', idempotent: false, createdAt: '2026-06-29T09:04:00.000Z' } }));
    const client = createHttpOperationalUpdatesClient({ baseUrl: 'https://api.example.test/', fetchImpl: fetchImpl as unknown as typeof fetch, actorExternalId: 'actor-key-1' });

    await client.list({ incidentId: 'incident-1', cellId: 'cell-a', cursor: 'cursor-1', limit: 20 });
    await client.sendAction({ incidentId: 'incident-1', updateId: 'update-1', actionType: 'read', request: { channel: 'mobile', externalId: 'actor-key-1', occurredAt: '2026-06-29T09:04:00.000Z' } });

    expect(fetchImpl).toHaveBeenNthCalledWith(1, 'https://api.example.test/incidents/incident-1/cells/cell-a/updates?cursor=cursor-1&limit=20&channel=mobile&externalId=actor-key-1', expect.objectContaining({ method: 'GET' }));
    expect(fetchImpl).toHaveBeenNthCalledWith(2, 'https://api.example.test/incidents/incident-1/updates/update-1/read', expect.objectContaining({ method: 'POST' }));
  });

  it('posts the opt-out/quieting preference to the dedicated preferences endpoint with the client channel and actor', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(createJsonResponse({ quietProactiveUpdates: true }));
    const client = createHttpOperationalUpdatesClient({ baseUrl: 'https://api.example.test/', fetchImpl: fetchImpl as unknown as typeof fetch, actorExternalId: 'actor-key-1' });

    const result = await client.setPreference?.({ incidentId: 'incident-1', quietProactiveUpdates: true });

    expect(result).toEqual({ quietProactiveUpdates: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example.test/incidents/incident-1/updates/preferences',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ channel: 'mobile', externalId: 'actor-key-1', quietProactiveUpdates: true }),
      }),
    );
  });
});

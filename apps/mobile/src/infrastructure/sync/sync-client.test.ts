/// <reference types="jest" />

import type { SignedOperation } from '@zona-cero/contracts';
import { createHttpScopedSyncClient } from './sync-client';

const operation: SignedOperation = {
  version: 1,
  actorKeyId: 'actor-key-1',
  deviceId: 'device-1',
  incidentId: 'incident-1',
  cellId: 'cell-a',
  opId: 'op-1',
  entityType: 'work_center',
  entityId: 'center-1',
  opType: 'work_center.create',
  payload: { name: 'Center' },
  hlc: '2026-06-29T09:00:00.000Z-0001-device-1',
  createdAtDevice: '2026-06-29T09:00:00.000Z',
  signature: 'signed',
  syncState: 'pending',
};

describe('HTTP scoped sync client', () => {
  it('uses the canonical Equipo B scoped push endpoint', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ opId: 'op-1', status: 'accepted', entityId: 'center-1', serverVersion: 2, serverUpdatedAt: '2026-06-29T09:01:00.000Z' }] }) });
    const client = createHttpScopedSyncClient({ baseUrl: 'https://api.example.test/', fetchImpl });

    const response = await client.push({ incidentId: 'incident-1', cellId: 'cell-a', operations: [operation] });

    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.test/incidents/incident-1/cells/cell-a/sync/push', expect.objectContaining({ method: 'POST', body: JSON.stringify({ operations: [operation], cursor: null }) }));
    expect(response.results[0]).toEqual(expect.objectContaining({ status: 'accepted', serverVersion: 2 }));
  });

  it('uses the canonical Equipo B scoped pull endpoint with cursor and limit', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        operations: [],
        cursor: 'cursor-next',
        hasMore: false,
        freshness: { status: 'fresh', lastFreshAt: null, lastSyncedAt: null, cursorLag: 0, hasConflicts: false, channels: [] },
        conflicts: [],
      }),
    });
    const client = createHttpScopedSyncClient({ baseUrl: 'https://api.example.test', fetchImpl });

    await client.pull({ incidentId: 'incident-1', cellId: 'cell-a', cursor: 'cursor-1', limit: 25 });

    expect(fetchImpl).toHaveBeenCalledWith('https://api.example.test/incidents/incident-1/cells/cell-a/sync/pull?cursor=cursor-1&limit=25', expect.objectContaining({ method: 'GET' }));
  });
});

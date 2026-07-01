/// <reference types="jest" />

import {
  InMemoryMapPackRepository,
  OfflineMapPackService,
  resolveMapAndOperationFreshness,
  resolveMapRenderState,
  type MapPackMetadata,
} from './offline-map-packs';

const downloadedPack: MapPackMetadata = {
  packId: 'incident-1:cell-a',
  incidentId: 'incident-1',
  cellId: 'cell-a',
  bounds: { west: 2.1, south: 41.3, east: 2.2, north: 41.4 },
  state: 'downloaded',
  progress: 1,
  estimatedBytes: 42000,
  downloadedBytes: 42000,
  updatedAt: '2026-06-29T09:00:00.000Z',
};

describe('offline map pack foundation', () => {
  it('stores incident and cell scoped pack metadata with lifecycle progress', async () => {
    const repository = new InMemoryMapPackRepository();
    const service = new OfflineMapPackService(repository);

    const queued = await service.queuePack({ incidentId: 'incident-1', cellId: 'cell-a', bounds: downloadedPack.bounds, estimatedBytes: 42000 });
    const downloading = await service.recordProgress(queued.packId, { downloadedBytes: 21000, estimatedBytes: 42000 });
    const downloaded = await service.recordProgress(queued.packId, { downloadedBytes: 42000, estimatedBytes: 42000 });

    expect(queued).toMatchObject({ packId: 'incident-1:cell-a', state: 'queued', progress: 0 });
    expect(downloading).toMatchObject({ state: 'downloading', progress: 0.5 });
    expect(downloaded).toMatchObject({ state: 'downloaded', progress: 1 });
    expect(await repository.findByIncident('incident-1')).toEqual([downloaded]);
  });

  it('creates native MapLibre packs and exposes native pack status through the adapter seam', async () => {
    const repository = new InMemoryMapPackRepository();
    const adapter = {
      createPack: jest.fn().mockResolvedValue(undefined),
      listPacks: jest.fn().mockResolvedValue([{ packId: 'incident-1:cell-a', status: 'complete' }]),
      deletePack: jest.fn().mockResolvedValue(undefined),
    };
    const service = new OfflineMapPackService(repository, {
      adapter,
      styleURL: 'maplibre://style/offline-test',
      minZoom: 9,
      maxZoom: 14,
      clock: () => '2026-06-29T10:00:00.000Z',
    });

    const pack = await service.queuePack({ incidentId: 'incident-1', cellId: 'cell-a', bounds: downloadedPack.bounds, estimatedBytes: 42000 });
    const nativeStatus = await service.getNativePackStatus(pack.packId);

    expect(adapter.createPack).toHaveBeenCalledWith({
      packId: 'incident-1:cell-a',
      styleURL: 'maplibre://style/offline-test',
      bounds: downloadedPack.bounds,
      minZoom: 9,
      maxZoom: 14,
    });
    expect(nativeStatus).toEqual({ packId: 'incident-1:cell-a', status: 'complete' });
  });

  it('marks failed or partial packs retryable without deleting completed packs', async () => {
    const repository = new InMemoryMapPackRepository([downloadedPack]);
    const service = new OfflineMapPackService(repository);
    const failed = await service.queuePack({ incidentId: 'incident-1', cellId: 'cell-b', bounds: downloadedPack.bounds, estimatedBytes: 20000 });

    await service.markFailed(failed.packId, 'network lost');
    const retried = await service.retryPack(failed.packId);

    expect(retried).toMatchObject({ packId: 'incident-1:cell-b', state: 'queued', failureReason: undefined });
    expect((await repository.findByIncident('incident-1')).map((pack) => pack.packId).sort()).toEqual(['incident-1:cell-a', 'incident-1:cell-b']);
  });

  it('recreates native MapLibre packs when retrying a failed pack', async () => {
    const repository = new InMemoryMapPackRepository();
    const adapter = { createPack: jest.fn().mockResolvedValue(undefined), listPacks: jest.fn(), deletePack: jest.fn() };
    const service = new OfflineMapPackService(repository, { adapter, styleURL: 'maplibre://style/retry', minZoom: 8, maxZoom: 13 });
    const failed = await service.queuePack({ incidentId: 'incident-1', cellId: 'cell-b', bounds: downloadedPack.bounds, estimatedBytes: 20000 });
    adapter.createPack.mockClear();

    await service.markFailed(failed.packId, 'network lost');
    await service.retryPack(failed.packId);

    expect(adapter.createPack).toHaveBeenCalledWith({ packId: 'incident-1:cell-b', styleURL: 'maplibre://style/retry', bounds: downloadedPack.bounds, minZoom: 8, maxZoom: 13 });
  });

  it('persists visible degraded state when native MapLibre pack creation fails', async () => {
    const repository = new InMemoryMapPackRepository();
    const adapter = {
      createPack: jest.fn().mockRejectedValue(new Error('native storage full')),
      listPacks: jest.fn(),
      deletePack: jest.fn(),
    };
    const service = new OfflineMapPackService(repository, { adapter, clock: () => '2026-06-29T10:00:00.000Z' });

    const pack = await service.queuePack({ incidentId: 'incident-1', cellId: 'cell-degraded', bounds: downloadedPack.bounds, estimatedBytes: 42000 });

    expect(pack).toMatchObject({ state: 'failed', failureReason: 'native storage full', progress: 0 });
    expect(await repository.findByPackId('incident-1:cell-degraded')).toEqual(expect.objectContaining({ state: 'failed', failureReason: 'native storage full' }));
    expect(resolveMapRenderState({ pack, networkAvailable: false })).toEqual({ coverage: 'missing', indicator: 'Missing offline map coverage' });
  });

  it('protects the active operational pack from accidental cleanup', async () => {
    const repository = new InMemoryMapPackRepository([downloadedPack, { ...downloadedPack, packId: 'incident-2:cell-a', incidentId: 'incident-2' }]);
    const service = new OfflineMapPackService(repository, { activeIncidentId: 'incident-1', activeCellId: 'cell-a' });

    const warning = await service.deletePack('incident-1:cell-a');
    const deleted = await service.deletePack('incident-2:cell-a');

    expect(warning).toEqual({ deleted: false, requiresConfirmation: true, warning: 'Deleting this active pack will remove offline map coverage for the current operation.' });
    expect(deleted).toEqual({ deleted: true, requiresConfirmation: false });
    expect(await repository.findByPackId('incident-2:cell-a')).toBeNull();
  });

  it('deletes confirmed packs from MapLibre native storage before local metadata cleanup', async () => {
    const repository = new InMemoryMapPackRepository([downloadedPack]);
    const adapter = { createPack: jest.fn(), listPacks: jest.fn(), deletePack: jest.fn().mockResolvedValue(undefined) };
    const service = new OfflineMapPackService(repository, { adapter, activeIncidentId: 'incident-1', activeCellId: 'cell-a' });

    const deleted = await service.deletePack('incident-1:cell-a', { confirmActive: true });

    expect(adapter.deletePack).toHaveBeenCalledWith('incident-1:cell-a');
    expect(deleted).toEqual({ deleted: true, requiresConfirmation: false });
    expect(await repository.findByPackId('incident-1:cell-a')).toBeNull();
  });

  it('resolves offline rendering coverage separately from operational data freshness', () => {
    expect(resolveMapRenderState({ pack: downloadedPack, networkAvailable: false })).toEqual({ coverage: 'offline', indicator: 'Offline map available' });
    expect(resolveMapRenderState({ pack: { ...downloadedPack, state: 'update_recommended' }, networkAvailable: false })).toEqual({ coverage: 'offline', indicator: 'Offline map available — update recommended' });
    expect(resolveMapRenderState({ pack: { ...downloadedPack, state: 'partial', progress: 0.4 }, networkAvailable: false })).toEqual({ coverage: 'partial', indicator: 'Partial offline map coverage' });
    expect(resolveMapAndOperationFreshness({ pack: downloadedPack, operationFreshness: 'stale', networkAvailable: false })).toEqual({
      mapCoverage: 'offline',
      mapUpdatedAt: '2026-06-29T09:00:00.000Z',
      operationFreshness: 'stale',
      operationFreshnessLabel: 'Operational data is stale',
    });
  });

  it('separates local and unavailable packs when map preparation opens offline', async () => {
    const repository = new InMemoryMapPackRepository([
      downloadedPack,
      {
        ...downloadedPack,
        packId: 'incident-1:cell-b',
        cellId: 'cell-b',
        state: 'partial',
        progress: 0.35,
        downloadedBytes: 14700,
      },
      {
        ...downloadedPack,
        packId: 'incident-1:cell-c',
        cellId: 'cell-c',
        state: 'failed',
        progress: 0,
        downloadedBytes: 0,
      },
    ]);
    const service = new OfflineMapPackService(repository);

    const preparation = await service.resolvePreparationCoverage({
      incidentId: 'incident-1',
      requestedCellIds: ['cell-a', 'cell-b', 'cell-c', 'cell-d'],
      networkAvailable: false,
    });

    expect(preparation.availableLocalPacks.map((pack) => pack.cellId)).toEqual(['cell-a', 'cell-b']);
    expect(preparation.unavailablePacks.map((pack) => pack.cellId)).toEqual(['cell-c', 'cell-d']);
    expect(preparation.canContinue).toBe(true);
    expect(preparation.continueCellIds).toEqual(['cell-a', 'cell-b']);
    expect(preparation.explanation).toBe('Network unavailable. Continue only with locally available coverage: cell-a, cell-b.');
  });

  it('does not treat failed or unavailable packs as usable local coverage because stale counters remain', async () => {
    const repository = new InMemoryMapPackRepository([
      { ...downloadedPack, packId: 'incident-1:cell-failed', cellId: 'cell-failed', state: 'failed', progress: 0.9, downloadedBytes: 36000 },
      { ...downloadedPack, packId: 'incident-1:cell-missing', cellId: 'cell-missing', state: 'not_available', progress: 1, downloadedBytes: 42000 },
      { ...downloadedPack, packId: 'incident-1:cell-update', cellId: 'cell-update', state: 'update_recommended', progress: 1, downloadedBytes: 42000 },
    ]);
    const service = new OfflineMapPackService(repository);

    const preparation = await service.resolvePreparationCoverage({
      incidentId: 'incident-1',
      requestedCellIds: ['cell-failed', 'cell-missing', 'cell-update'],
      networkAvailable: false,
    });

    expect(preparation.availableLocalPacks.map((pack) => pack.cellId)).toEqual(['cell-update']);
    expect(preparation.unavailablePacks.map((pack) => pack.cellId)).toEqual(['cell-failed', 'cell-missing']);
    expect(preparation.continueCellIds).toEqual(['cell-update']);
  });

  it('emits bucketed map lifecycle events without bounds or raw failure reasons', async () => {
    const repository = new InMemoryMapPackRepository();
    const events: unknown[] = [];
    const service = new OfflineMapPackService(repository, { observabilitySink: { record: (event) => { events.push(event); } } });

    const queued = await service.queuePack({ incidentId: 'incident-1', cellId: 'cell-a', bounds: downloadedPack.bounds, estimatedBytes: 42_000_000 });
    await service.recordProgress(queued.packId, { downloadedBytes: 21_000_000, estimatedBytes: 42_000_000 });
    await service.recordProgress(queued.packId, { downloadedBytes: 42_000_000, estimatedBytes: 42_000_000 });
    await service.markFailed(queued.packId, 'native storage full near 41.387,2.168');

    expect(events).toEqual([
      expect.objectContaining({ mapPackState: 'queued', progressBucket: 0, estimatedBytesBucket: '10-50mb', downloadedBytesBucket: '0' }),
      expect.objectContaining({ mapPackState: 'downloading', progressBucket: 50, estimatedBytesBucket: '10-50mb', downloadedBytesBucket: '10-50mb' }),
      expect.objectContaining({ mapPackState: 'downloaded', progressBucket: 100, estimatedBytesBucket: '10-50mb', downloadedBytesBucket: '10-50mb' }),
      expect.objectContaining({ mapPackState: 'partial', result: 'rejected', failureKind: 'unknown' }),
    ]);
    expect(JSON.stringify(events)).not.toContain('41.387');
    expect(JSON.stringify(events)).not.toContain('2.168');
    expect(JSON.stringify(events)).not.toContain('native storage full');
    expect(JSON.stringify(events)).not.toContain('west');
  });

  it('does not block map operations when observability fails', async () => {
    const repository = new InMemoryMapPackRepository();
    const service = new OfflineMapPackService(repository, {
      observabilitySink: { record: () => Promise.reject(new Error('telemetry unavailable')) },
    });

    const pack = await service.queuePack({ incidentId: 'incident-1', cellId: 'cell-a', bounds: downloadedPack.bounds, estimatedBytes: 42_000 });

    expect(pack).toMatchObject({ state: 'queued' });
    expect(await repository.findByPackId(pack.packId)).toEqual(expect.objectContaining({ state: 'queued' }));
  });

});

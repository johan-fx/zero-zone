import type { MapLibreOfflineAdapter } from './maplibre-adapter';

export type MapPackLifecycleState = 'not_available' | 'queued' | 'downloading' | 'partial' | 'downloaded' | 'failed' | 'update_recommended';

export type MapBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type MapPackMetadata = {
  packId: string;
  incidentId: string;
  cellId: string;
  bounds: MapBounds;
  state: MapPackLifecycleState;
  progress: number;
  estimatedBytes: number;
  downloadedBytes: number;
  updatedAt: string;
  failureReason?: string;
};

export type PackDeleteResult =
  | { deleted: true; requiresConfirmation: false }
  | { deleted: false; requiresConfirmation: true; warning: string }
  | { deleted: false; requiresConfirmation: false; warning: string };

export type MapRenderState = {
  coverage: 'online' | 'offline' | 'partial' | 'missing';
  indicator: string;
};

export type OperationFreshness = 'fresh' | 'degraded' | 'stale' | 'missing';

export type MapPackRepository = {
  upsert(pack: MapPackMetadata): Promise<void>;
  findByPackId(packId: string): Promise<MapPackMetadata | null>;
  findByIncident(incidentId: string): Promise<MapPackMetadata[]>;
  delete(packId: string): Promise<boolean>;
};

export class InMemoryMapPackRepository implements MapPackRepository {
  private readonly packs = new Map<string, MapPackMetadata>();

  constructor(initialPacks: readonly MapPackMetadata[] = []) {
    initialPacks.forEach((pack) => this.packs.set(pack.packId, pack));
  }

  async upsert(pack: MapPackMetadata): Promise<void> {
    this.packs.set(pack.packId, pack);
  }

  async findByPackId(packId: string): Promise<MapPackMetadata | null> {
    return this.packs.get(packId) ?? null;
  }

  async findByIncident(incidentId: string): Promise<MapPackMetadata[]> {
    return Array.from(this.packs.values()).filter((pack) => pack.incidentId === incidentId);
  }

  async delete(packId: string): Promise<boolean> {
    return this.packs.delete(packId);
  }
}

export type OfflineMapPackServiceOptions = {
  activeIncidentId?: string;
  activeCellId?: string;
  adapter?: MapLibreOfflineAdapter;
  styleURL?: string;
  minZoom?: number;
  maxZoom?: number;
  clock?: () => string;
};

export class OfflineMapPackService {
  private readonly clock: () => string;

  constructor(
    private readonly repository: MapPackRepository,
    private readonly options: OfflineMapPackServiceOptions = {},
  ) {
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  async queuePack(input: { incidentId: string; cellId: string; bounds: MapBounds; estimatedBytes: number }): Promise<MapPackMetadata> {
    const pack: MapPackMetadata = {
      packId: createPackId(input.incidentId, input.cellId),
      incidentId: input.incidentId,
      cellId: input.cellId,
      bounds: input.bounds,
      state: 'queued',
      progress: 0,
      estimatedBytes: input.estimatedBytes,
      downloadedBytes: 0,
      updatedAt: this.clock(),
    };

    await this.repository.upsert(pack);
    await this.options.adapter?.createPack({
      packId: pack.packId,
      styleURL: this.options.styleURL ?? 'maplibre://offline-pack',
      bounds: pack.bounds,
      minZoom: this.options.minZoom ?? 0,
      maxZoom: this.options.maxZoom ?? 16,
    });

    return pack;
  }

  async getNativePackStatus(packId: string): Promise<unknown | null> {
    const packs = (await this.options.adapter?.listPacks()) ?? [];

    return packs.find((pack) => isNativePackWithId(pack, packId)) ?? null;
  }

  async recordProgress(packId: string, progress: { downloadedBytes: number; estimatedBytes: number }): Promise<MapPackMetadata> {
    const pack = await this.requirePack(packId);
    const normalizedProgress = progress.estimatedBytes > 0 ? progress.downloadedBytes / progress.estimatedBytes : 0;
    const nextPack: MapPackMetadata = {
      ...pack,
      downloadedBytes: progress.downloadedBytes,
      estimatedBytes: progress.estimatedBytes,
      progress: Math.min(1, Math.max(0, normalizedProgress)),
      state: progress.downloadedBytes >= progress.estimatedBytes ? 'downloaded' : 'downloading',
      updatedAt: this.clock(),
    };

    await this.repository.upsert(nextPack);

    return nextPack;
  }

  async markFailed(packId: string, reason: string): Promise<MapPackMetadata> {
    const pack = await this.requirePack(packId);
    const nextPack: MapPackMetadata = {
      ...pack,
      state: pack.downloadedBytes > 0 ? 'partial' : 'failed',
      failureReason: reason,
      updatedAt: this.clock(),
    };

    await this.repository.upsert(nextPack);

    return nextPack;
  }

  async retryPack(packId: string): Promise<MapPackMetadata> {
    const pack = await this.requirePack(packId);
    const nextPack: MapPackMetadata = {
      ...pack,
      state: 'queued',
      failureReason: undefined,
      updatedAt: this.clock(),
    };

    await this.repository.upsert(nextPack);

    return nextPack;
  }

  async deletePack(packId: string, options: { confirmActive?: boolean } = {}): Promise<PackDeleteResult> {
    const pack = await this.repository.findByPackId(packId);

    if (!pack) {
      return { deleted: false, requiresConfirmation: false, warning: 'Pack was not found.' };
    }

    const isActive = pack.incidentId === this.options.activeIncidentId && pack.cellId === this.options.activeCellId;

    if (isActive && !options.confirmActive) {
      return {
        deleted: false,
        requiresConfirmation: true,
        warning: 'Deleting this active pack will remove offline map coverage for the current operation.',
      };
    }

    await this.options.adapter?.deletePack(packId);
    await this.repository.delete(packId);

    return { deleted: true, requiresConfirmation: false };
  }

  private async requirePack(packId: string): Promise<MapPackMetadata> {
    const pack = await this.repository.findByPackId(packId);

    if (!pack) {
      throw new Error(`Map pack not found: ${packId}`);
    }

    return pack;
  }
}

export function resolveMapRenderState(input: { pack: MapPackMetadata | null; networkAvailable: boolean }): MapRenderState {
  if (input.pack?.state === 'downloaded') {
    return { coverage: input.networkAvailable ? 'online' : 'offline', indicator: input.networkAvailable ? 'Online map available' : 'Offline map available' };
  }

  if (input.pack?.state === 'partial' || (input.pack?.progress ?? 0) > 0) {
    return { coverage: 'partial', indicator: 'Partial offline map coverage' };
  }

  return { coverage: input.networkAvailable ? 'online' : 'missing', indicator: input.networkAvailable ? 'Online map available' : 'Missing offline map coverage' };
}

export function resolveMapAndOperationFreshness(input: { pack: MapPackMetadata | null; operationFreshness: OperationFreshness; networkAvailable: boolean }) {
  const mapState = resolveMapRenderState({ pack: input.pack, networkAvailable: input.networkAvailable });

  return {
    mapCoverage: mapState.coverage,
    mapUpdatedAt: input.pack?.updatedAt ?? null,
    operationFreshness: input.operationFreshness,
    operationFreshnessLabel: operationFreshnessLabels[input.operationFreshness],
  };
}

const operationFreshnessLabels = {
  fresh: 'Operational data is fresh',
  degraded: 'Operational data is degraded',
  stale: 'Operational data is stale',
  missing: 'Operational data is missing',
} as const satisfies Record<OperationFreshness, string>;

function createPackId(incidentId: string, cellId: string): string {
  return `${incidentId}:${cellId}`;
}

function isNativePackWithId(pack: unknown, packId: string): boolean {
  return Boolean(pack && typeof pack === 'object' && 'packId' in pack && pack.packId === packId);
}

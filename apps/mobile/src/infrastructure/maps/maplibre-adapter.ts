import type { MapBounds } from './offline-map-packs';

export type MapLibreOfflinePackRequest = {
  packId: string;
  styleURL: string;
  bounds: MapBounds;
  minZoom: number;
  maxZoom: number;
};

export type MapLibreOfflineNativeModule = {
  offlineManager?: {
    createPack?: (request: MapLibreOfflinePackRequest) => Promise<unknown>;
    getPacks?: () => Promise<unknown[]>;
    deletePack?: (packId: string) => Promise<unknown>;
  };
};

export type MapLibreOfflineAdapter = {
  createPack(request: MapLibreOfflinePackRequest): Promise<void>;
  listPacks(): Promise<unknown[]>;
  deletePack(packId: string): Promise<void>;
};

export function createMapLibreOfflineAdapter(nativeModule: MapLibreOfflineNativeModule): MapLibreOfflineAdapter {
  return {
    async createPack(request) {
      const createPack = requireOfflineMethod(nativeModule, 'createPack');

      await createPack(request);
    },
    async listPacks() {
      const getPacks = requireOfflineMethod(nativeModule, 'getPacks');

      return getPacks();
    },
    async deletePack(packId) {
      const deletePack = requireOfflineMethod(nativeModule, 'deletePack');

      await deletePack(packId);
    },
  };
}

function requireOfflineMethod<TName extends keyof NonNullable<MapLibreOfflineNativeModule['offlineManager']>>(
  nativeModule: MapLibreOfflineNativeModule,
  methodName: TName,
): NonNullable<NonNullable<MapLibreOfflineNativeModule['offlineManager']>[TName]> {
  const method = nativeModule.offlineManager?.[methodName];

  if (typeof method !== 'function') {
    throw new Error(`MapLibre offline native method unavailable: ${methodName}`);
  }

  return method as NonNullable<NonNullable<MapLibreOfflineNativeModule['offlineManager']>[TName]>;
}

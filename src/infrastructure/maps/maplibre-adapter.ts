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
      await nativeModule.offlineManager?.createPack?.(request);
    },
    async listPacks() {
      return nativeModule.offlineManager?.getPacks?.() ?? [];
    },
    async deletePack(packId) {
      await nativeModule.offlineManager?.deletePack?.(packId);
    },
  };
}

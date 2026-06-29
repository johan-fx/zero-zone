/// <reference types="jest" />

import { createMapLibreOfflineAdapter } from './maplibre-adapter';

const packRequest = {
  packId: 'incident-1:cell-a',
  styleURL: 'maplibre://style/offline-test',
  bounds: { west: 2.1, south: 41.3, east: 2.2, north: 41.4 },
  minZoom: 9,
  maxZoom: 14,
};

describe('MapLibre offline adapter', () => {
  it('throws when required native offline methods are unavailable', async () => {
    const adapter = createMapLibreOfflineAdapter({ offlineManager: {} });

    await expect(adapter.createPack(packRequest)).rejects.toThrow('MapLibre offline native method unavailable: createPack');
    await expect(adapter.listPacks()).rejects.toThrow('MapLibre offline native method unavailable: getPacks');
    await expect(adapter.deletePack('incident-1:cell-a')).rejects.toThrow('MapLibre offline native method unavailable: deletePack');
  });
});

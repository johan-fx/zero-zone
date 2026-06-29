/// <reference types="jest" />

import '@testing-library/react-native';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    execAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(async () => ({ user_version: 1 })),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => undefined),
  })),
  SQLiteProvider: ({ children }: { children: unknown }) => children,
  useSQLiteContext: jest.fn(() => ({
    execAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(async () => ({ user_version: 1 })),
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => undefined),
  })),
}));

jest.mock('@maplibre/maplibre-react-native', () => ({
  MapView: 'MapLibreMapView',
  Camera: 'MapLibreCamera',
  ShapeSource: 'MapLibreShapeSource',
  SymbolLayer: 'MapLibreSymbolLayer',
  offlineManager: {
    createPack: jest.fn(async () => undefined),
    getPacks: jest.fn(async () => []),
    deletePack: jest.fn(async () => undefined),
  },
}));

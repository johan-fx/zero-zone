/// <reference types="jest" />

import { createInMemoryLocalOperationDatabase } from '@/infrastructure/local-db/local-db';
import { createMobileRuntimeSync, resolveMobileApiBaseUrl } from './runtime-sync';

describe('mobile runtime sync wiring', () => {
  it('creates a scoped sync service when API config exists', () => {
    const database = createInMemoryLocalOperationDatabase();
    const fetchImpl = jest.fn() as typeof fetch;

    const runtime = createMobileRuntimeSync({
      database,
      env: { EXPO_PUBLIC_API_BASE_URL: 'https://api.example.test/' },
      fetchImpl,
    });

    expect(runtime.networkAvailable).toBe(true);
    expect(runtime.syncUnavailableReason).toBeUndefined();
    expect(runtime.syncService).toEqual({ sync: expect.any(Function) });
  });

  it('degrades visibly when API config is absent', () => {
    const runtime = createMobileRuntimeSync({
      database: createInMemoryLocalOperationDatabase(),
      env: {},
    });

    expect(runtime.networkAvailable).toBe(false);
    expect(runtime.syncService).toBeUndefined();
    expect(runtime.syncUnavailableReason).toBe('Sync unavailable: set EXPO_PUBLIC_API_BASE_URL for the Equipo B API before deployment.');
  });

  it('resolves the canonical mobile API base URL from supported Expo public env keys', () => {
    expect(resolveMobileApiBaseUrl({ EXPO_PUBLIC_API_BASE_URL: ' https://api.example.test ' })).toBe('https://api.example.test');
    expect(resolveMobileApiBaseUrl({ EXPO_PUBLIC_ZERO_ZONE_API_BASE_URL: 'https://api-fallback.example.test' })).toBe('https://api-fallback.example.test');
    expect(resolveMobileApiBaseUrl({ EXPO_PUBLIC_API_BASE_URL: '   ' })).toBeNull();
  });
});

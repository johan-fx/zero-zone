import type { LocalOperationDatabase } from '@/infrastructure/local-db/local-db';
import { createHttpOperationalUpdatesClient, createOperationalUpdatesService, type OperationalUpdatesService } from './operational-updates-service';
import { createHttpScopedSyncClient, type CreateHttpScopedSyncClientOptions } from './sync-client';
import { createScopedOperationSyncService, type ScopedOperationSyncService } from './sync-service';

const API_BASE_URL_ENV_KEYS = ['EXPO_PUBLIC_API_BASE_URL', 'EXPO_PUBLIC_ZERO_ZONE_API_BASE_URL'] as const;
const ACTOR_EXTERNAL_ID_ENV_KEYS = ['EXPO_PUBLIC_ACTOR_EXTERNAL_ID', 'EXPO_PUBLIC_ZERO_ZONE_ACTOR_EXTERNAL_ID'] as const;
type MobileRuntimeEnv = Record<string, string | undefined>;

export type MobileRuntimeSync = {
  networkAvailable: boolean;
  syncService?: ScopedOperationSyncService;
  operationalUpdatesService?: OperationalUpdatesService;
  syncUnavailableReason?: string;
};

export type CreateMobileRuntimeSyncOptions = {
  database: LocalOperationDatabase;
  env?: MobileRuntimeEnv;
  fetchImpl?: CreateHttpScopedSyncClientOptions['fetchImpl'];
  headers?: CreateHttpScopedSyncClientOptions['headers'];
};

export function createMobileRuntimeSync({ database, env = process.env, fetchImpl, headers }: CreateMobileRuntimeSyncOptions): MobileRuntimeSync {
  const apiBaseUrl = resolveMobileApiBaseUrl(env);

  if (!apiBaseUrl) {
    return {
      networkAvailable: false,
      syncUnavailableReason: 'Sync unavailable: set EXPO_PUBLIC_API_BASE_URL for the Equipo B API before deployment.',
    };
  }

  const actorExternalId = resolveMobileActorExternalId(env);
  if (!actorExternalId) {
    return {
      networkAvailable: false,
      syncUnavailableReason: 'Sync unavailable: set EXPO_PUBLIC_ACTOR_EXTERNAL_ID before enabling mobile operational updates.',
    };
  }

  const client = createHttpScopedSyncClient({ baseUrl: apiBaseUrl, fetchImpl, headers });
  const operationalUpdatesClient = createHttpOperationalUpdatesClient({ baseUrl: apiBaseUrl, fetchImpl, headers, actorExternalId });

  return {
    networkAvailable: true,
    syncService: createScopedOperationSyncService({ database, client }),
    operationalUpdatesService: createOperationalUpdatesService({ database, client: operationalUpdatesClient, actorExternalId }),
  };
}

export function resolveMobileApiBaseUrl(env: MobileRuntimeEnv): string | null {
  for (const key of API_BASE_URL_ENV_KEYS) {
    const value = env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

export function resolveMobileActorExternalId(env: MobileRuntimeEnv): string | null {
  for (const key of ACTOR_EXTERNAL_ID_ENV_KEYS) {
    const value = env[key]?.trim();

    if (value) {
      return value;
    }
  }

  return null;
}

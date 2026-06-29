import * as ExpoSQLite from 'expo-sqlite';
import { getRxStorageSQLiteTrial, getSQLiteBasicsExpoSQLiteAsync } from 'rxdb/plugins/storage-sqlite';

export const zeroZoneSpikeDbName = 'zero_zone_offline_spike';

export function createRxdbSQLiteStorage() {
  return getRxStorageSQLiteTrial({
    sqliteBasics: getSQLiteBasicsExpoSQLiteAsync(ExpoSQLite.openDatabaseAsync),
  });
}

export async function createRxdbLocalDatabase(name = zeroZoneSpikeDbName) {
  const { createRxdbLocalDatabase: createConfiguredRxdbLocalDatabase } = await import('./local-db');

  return createConfiguredRxdbLocalDatabase({ name, storage: createRxdbSQLiteStorage() });
}

import * as ExpoSQLite from 'expo-sqlite';
import { getRxStorageSQLiteTrial, getSQLiteBasicsExpoSQLiteAsync } from 'rxdb/plugins/storage-sqlite';

import { zeroZoneSpikeDbName } from './local-db';

export function createTrialRxdbSQLiteStorage() {
  return getRxStorageSQLiteTrial({
    sqliteBasics: getSQLiteBasicsExpoSQLiteAsync(ExpoSQLite.openDatabaseAsync),
  });
}

export async function createRxdbLocalDatabase(name = zeroZoneSpikeDbName) {
  const { createRxdbLocalDatabase: createConfiguredRxdbLocalDatabase } = await import('./local-db');

  return createConfiguredRxdbLocalDatabase({ name, storage: createTrialRxdbSQLiteStorage() });
}

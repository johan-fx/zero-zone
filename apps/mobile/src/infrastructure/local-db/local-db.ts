import type { MapPackMetadata } from '@/infrastructure/maps/offline-map-packs';
import type { SignedOperation } from '@/infrastructure/security/operation-signer';
import type { SosLocation, SyncConflict, SyncState, TrustStatus, TrustVisibility } from '@zona-cero/contracts';

export const zeroZoneSpikeDbName = 'zero_zone_offline_spike';

export const localDbCollectionNames = [
  'sync_ops',
  'incidents',
  'work_centers',
  'map_packs',
  'sync_issues',
  'presence',
  'resource_reports',
  'dispatch_events',
  'sos_signals',
  'local_summaries',
] as const;

export type LocalDbCollectionName = (typeof localDbCollectionNames)[number];

export type LocalDbSchema = {
  title: string;
  version: number;
  primaryKey: string;
  type: 'object';
  required: string[];
  properties: Record<string, { type: string } | { type: readonly string[] }>;
};

const stringProperty = { type: 'string' } as const;
const nullableStringProperty = { type: ['string', 'null'] } as const;
const numberProperty = { type: 'number' } as const;
const booleanProperty = { type: 'boolean' } as const;
const objectProperty = { type: 'object' } as const;
const arrayProperty = { type: 'array' } as const;

export const localDbSchemas = {
  sync_ops: createSchema('sync_ops', 'opId', ['opId', 'version', 'actorKeyId', 'deviceId', 'incidentId', 'cellId', 'entityType', 'entityId', 'opType', 'payload', 'hlc', 'createdAtDevice', 'signature', 'syncState']),
  incidents: createSchema('incidents', 'incidentId', ['incidentId', 'title', 'status', 'syncState', 'updatedAt']),
  work_centers: createSchema('work_centers', 'centerId', ['centerId', 'incidentId', 'cellId', 'name', 'status', 'syncState', 'updatedAt']),
  map_packs: createSchema('map_packs', 'packId', ['packId', 'incidentId', 'cellId', 'bounds', 'state', 'progress', 'estimatedBytes', 'downloadedBytes', 'updatedAt']),
  sync_issues: createSchema('sync_issues', 'issueId', ['issueId', 'incidentId', 'cellId', 'state', 'code', 'updatedAt']),
  presence: createSchema('presence', 'presenceId', ['presenceId', 'incidentId', 'cellId', 'status', 'updatedAt']),
  resource_reports: createSchema('resource_reports', 'reportId', ['reportId', 'incidentId', 'cellId', 'category', 'quantityApprox', 'urgency', 'constraints', 'reportKind', 'syncState', 'updatedAt']),
  dispatch_events: createSchema('dispatch_events', 'dispatchEventId', ['dispatchEventId', 'dispatchTaskId', 'incidentId', 'cellId', 'category', 'quantityApprox', 'status', 'updatedAt']),
  sos_signals: createSchema('sos_signals', 'sosId', ['sosId', 'incidentId', 'cellId', 'status', 'updatedAt']),
  local_summaries: createSchema('local_summaries', 'summaryId', ['summaryId', 'incidentId', 'cellId', 'operationFreshness', 'pendingOperations']),
} as const satisfies Record<LocalDbCollectionName, LocalDbSchema>;

export type LegacySyncOperationDocument = Partial<SignedOperation> & {
  opId: string;
  incidentId: string;
  cellId: string;
  opType: string;
  payload: unknown;
  signature: string;
  syncState: string;
  hlc: string;
  createdAtDevice: string;
};

export type MigratedSyncOperationDocument = LegacySyncOperationDocument & {
  schemaVersion: 1;
  materializedAt: string | null;
};

export type SyncOperationLocalDocument = SignedOperation & {
  syncState: SyncState;
  serverVersion?: number;
  serverUpdatedAt?: string;
  retryCount?: number;
  lastSyncAttemptAt?: string;
  nextRetryAt?: string;
  syncErrorCode?: string;
  syncErrorMessage?: string;
  conflict?: SyncConflict;
};

export function migrateSyncOperationDocumentToV1(document: LegacySyncOperationDocument): MigratedSyncOperationDocument {
  return {
    ...document,
    schemaVersion: 1,
    materializedAt: null,
  };
}

export function getLocalDbMigrationStrategies() {
  return {
    sync_ops: {
      1: migrateSyncOperationDocumentToV1,
    },
  } as const;
}

export type IncidentLocalView = {
  incidentId: string;
  cellId: string;
  title: string;
  status: string;
  syncState: string;
  updatedAt: string;
};

export type WorkCenterView = {
  centerId: string;
  incidentId: string;
  cellId: string;
  name: string;
  centerType?: string;
  description?: string;
  priority?: string;
  initialNeed?: string;
  surplus?: string;
  activationState?: string;
  freshness?: string;
  confidence?: string;
  risk?: string;
  signalCount?: number;
  corroboratingSignalCount?: number;
  trustStatus?: TrustStatus | 'pending' | 'unverified';
  trustVisibility?: TrustVisibility;
  trustSignalCount?: number;
  trustDisputeCount?: number;
  trustExplanation?: string[];
  provisional?: boolean;
  provisionalReason?: string;
  location?: { latitude: number; longitude: number };
  status: string;
  syncState: string;
  updatedAt: string;
};

export type PresenceLocalView = {
  presenceId: string;
  incidentId: string;
  cellId: string;
  actorId: string;
  role: string;
  centerId: string;
  status: string;
  updatedAt: string;
};

export type ResourceReportLocalView = {
  reportId: string;
  incidentId: string;
  cellId: string;
  workCenterId?: string;
  category: string;
  quantityApprox: string;
  urgency: string;
  constraints: string[];
  reportKind: string;
  provisional?: boolean;
  provisionalReason?: string;
  trustStatus?: TrustStatus | 'pending' | 'unverified';
  trustVisibility?: TrustVisibility;
  trustSignalCount?: number;
  trustDisputeCount?: number;
  trustExplanation?: string[];
  syncState: string;
  updatedAt: string;
};

export type DispatchEventLocalView = {
  dispatchEventId: string;
  dispatchTaskId: string;
  incidentId: string;
  cellId: string;
  category: string;
  quantityApprox: string;
  fromResourceReportId?: string;
  toResourceReportId?: string;
  targetWorkCenterId?: string;
  notes?: string;
  status: string;
  provisional?: boolean;
  provisionalReason?: string;
  updatedAt: string;
};

export type SosSignalLocalView = {
  sosId: string;
  incidentId: string;
  cellId: string;
  severity: string;
  message: string;
  location?: SosLocation;
  status: string;
  syncState: string;
  trustStatus?: TrustStatus | 'pending' | 'unverified';
  trustVisibility?: TrustVisibility;
  trustSignalCount?: number;
  trustDisputeCount?: number;
  trustExplanation?: string[];
  provisional?: boolean;
  provisionalReason?: string;
  updatedAt: string;
};

export type LocalSummaryLocalView = {
  summaryId: string;
  incidentId: string;
  cellId: string;
  operationFreshness: string;
  pendingOperations: number;
  roleCounts: Record<string, number>;
};

export type SyncIssueLocalView = {
  issueId: string;
  incidentId: string;
  cellId: string;
  state: Extract<SyncState, 'conflict' | 'rejected'>;
  code: string;
  message?: string;
  opId?: string;
  entityId?: string;
  entityType?: string;
  serverVersion?: number;
  serverUpdatedAt?: string;
  updatedAt: string;
};

type IncidentScoped = { incidentId: string };

export type CollectionRepository<TDocument extends IncidentScoped> = {
  upsert(document: TDocument): Promise<void>;
  findById(id: string): Promise<TDocument | null>;
  findByIncident(incidentId: string): Promise<TDocument[]>;
  removeByIncident(incidentId: string): Promise<number>;
};

export type LocalOperationDatabase = {
  schemaVersion: 1;
  migrationStrategies: ReturnType<typeof getLocalDbMigrationStrategies>;
  syncOps: CollectionRepository<SyncOperationLocalDocument | MigratedSyncOperationDocument>;
  views: {
    incidents: CollectionRepository<IncidentLocalView>;
    workCenters: CollectionRepository<WorkCenterView>;
    mapPacks: CollectionRepository<MapPackMetadata>;
    syncIssues: CollectionRepository<SyncIssueLocalView>;
    presence: CollectionRepository<PresenceLocalView>;
    resourceReports: CollectionRepository<ResourceReportLocalView>;
    dispatchEvents: CollectionRepository<DispatchEventLocalView>;
    sosSignals: CollectionRepository<SosSignalLocalView>;
    localSummaries: CollectionRepository<LocalSummaryLocalView>;
  };
  resetIncident(incidentId: string): Promise<{ removedOperations: number; removedViews: number; warning: string }>;
};

export function createInMemoryLocalOperationDatabase(): LocalOperationDatabase {
  const syncOps = createCollectionRepository<SyncOperationLocalDocument | MigratedSyncOperationDocument>((operation) => operation.opId);
  const incidents = createCollectionRepository<IncidentLocalView>((incident) => incident.incidentId);
  const workCenters = createCollectionRepository<WorkCenterView>((center) => center.centerId);
  const mapPacks = createCollectionRepository<MapPackMetadata>((pack) => pack.packId);
  const syncIssues = createCollectionRepository<SyncIssueLocalView>((issue) => issue.issueId);
  const presence = createCollectionRepository<PresenceLocalView>((session) => session.presenceId);
  const resourceReports = createCollectionRepository<ResourceReportLocalView>((report) => report.reportId);
  const dispatchEvents = createCollectionRepository<DispatchEventLocalView>((event) => event.dispatchEventId);
  const sosSignals = createCollectionRepository<SosSignalLocalView>((signal) => signal.sosId);
  const localSummaries = createCollectionRepository<LocalSummaryLocalView>((summary) => summary.summaryId);

  return {
    schemaVersion: 1,
    migrationStrategies: getLocalDbMigrationStrategies(),
    syncOps,
    views: {
      incidents,
      workCenters,
      mapPacks,
      syncIssues,
      presence,
      resourceReports,
      dispatchEvents,
      sosSignals,
      localSummaries,
    },
    async resetIncident(incidentId: string) {
      const removedOperations = await syncOps.removeByIncident(incidentId);
      const removedViews = await removeIncidentViews(incidentId, [incidents, workCenters, mapPacks, syncIssues, presence, resourceReports, dispatchEvents, sosSignals, localSummaries]);

      return {
        removedOperations,
        removedViews,
        warning: 'Unsynchronized operations may be lost.',
      };
    },
  };
}

type RxDatabaseFactory = (input: { name: string; storage: unknown; multiInstance: false }) => Promise<RxdbDatabaseLike>;

type CreateRxdbLocalDatabaseOptions = {
  name?: string;
  storage?: unknown;
  createDatabase?: RxDatabaseFactory;
};

type RxdbDatabaseLike = {
  addCollections(collections: RxdbCollectionDefinitions): Promise<unknown>;
  collections?: Partial<Record<LocalDbCollectionName, RxCollectionLike>>;
};

type RxdbCollectionDefinitions = Record<LocalDbCollectionName, { schema: LocalDbSchema; migrationStrategies?: Record<number, (document: any) => any> }>;

type RxCollectionLike = {
  upsert(document: any): Promise<unknown>;
  findOne?(query: { selector: Record<string, unknown> }): { exec(): Promise<RxDocumentLike | null> };
  find(query: { selector: Record<string, unknown> }): { exec(): Promise<RxDocumentLike[]> };
};

type RxDocumentLike = {
  toJSON?: () => any;
  remove?: () => Promise<unknown>;
};

export async function createRxdbLocalDatabase(options: CreateRxdbLocalDatabaseOptions | string = {}): Promise<RxdbDatabaseLike> {
  const normalizedOptions = typeof options === 'string' ? { name: options } : options;
  const name = normalizedOptions.name ?? zeroZoneSpikeDbName;
  const storage = normalizedOptions.storage ?? (await createDefaultRxdbSQLiteStorage());
  const createDatabase = normalizedOptions.createDatabase ?? createDefaultRxDatabase;
  const database = await createDatabase({ name, storage, multiInstance: false });

  await addRxdbLocalCollections(database);

  return database;
}

export async function createPersistentLocalOperationDatabase(name = zeroZoneSpikeDbName): Promise<LocalOperationDatabase> {
  const rxdb = await createRxdbLocalDatabase({ name });

  return createRxdbLocalOperationDatabase({ collections: requireRxdbCollections(rxdb) });
}

async function createDefaultRxDatabase(input: { name: string; storage: unknown; multiInstance: false }): Promise<RxdbDatabaseLike> {
  const { createRxDatabase } = await import('rxdb/plugins/core');

  return (createRxDatabase as (databaseInput: { name: string; storage: unknown; multiInstance: false }) => Promise<RxdbDatabaseLike>)(input);
}

async function createDefaultRxdbSQLiteStorage(): Promise<unknown> {
  const { createTrialRxdbSQLiteStorage } = await import('./rxdb-storage');

  return createTrialRxdbSQLiteStorage();
}

export async function addRxdbLocalCollections(database: RxdbDatabaseLike): Promise<void> {
  await database.addCollections(createRxdbCollectionDefinitions());
}

export function createRxdbCollectionDefinitions(): RxdbCollectionDefinitions {
  const migrationStrategies = getLocalDbMigrationStrategies();

  return localDbCollectionNames.reduce((definitions, collectionName) => {
    definitions[collectionName] = {
      schema: localDbSchemas[collectionName],
      ...(collectionName === 'sync_ops' ? { migrationStrategies: migrationStrategies.sync_ops } : {}),
    };

    return definitions;
  }, {} as RxdbCollectionDefinitions);
}

export function createRxdbLocalOperationDatabase(database: { collections: Record<LocalDbCollectionName, RxCollectionLike> }): LocalOperationDatabase {
  const syncOps = createRxCollectionRepository<SyncOperationLocalDocument | MigratedSyncOperationDocument>(database.collections.sync_ops, 'opId');
  const incidents = createRxCollectionRepository<IncidentLocalView>(database.collections.incidents, 'incidentId');
  const workCenters = createRxCollectionRepository<WorkCenterView>(database.collections.work_centers, 'centerId');
  const mapPacks = createRxCollectionRepository<MapPackMetadata>(database.collections.map_packs, 'packId');
  const syncIssues = createRxCollectionRepository<SyncIssueLocalView>(database.collections.sync_issues, 'issueId');
  const presence = createRxCollectionRepository<PresenceLocalView>(database.collections.presence, 'presenceId');
  const resourceReports = createRxCollectionRepository<ResourceReportLocalView>(database.collections.resource_reports, 'reportId');
  const dispatchEvents = createRxCollectionRepository<DispatchEventLocalView>(database.collections.dispatch_events, 'dispatchEventId');
  const sosSignals = createRxCollectionRepository<SosSignalLocalView>(database.collections.sos_signals, 'sosId');
  const localSummaries = createRxCollectionRepository<LocalSummaryLocalView>(database.collections.local_summaries, 'summaryId');

  return {
    schemaVersion: 1,
    migrationStrategies: getLocalDbMigrationStrategies(),
    syncOps,
    views: {
      incidents,
      workCenters,
      mapPacks,
      syncIssues,
      presence,
      resourceReports,
      dispatchEvents,
      sosSignals,
      localSummaries,
    },
    async resetIncident(incidentId) {
      const removedOperations = await syncOps.removeByIncident(incidentId);
      const removedViews = await removeIncidentViews(incidentId, [incidents, workCenters, mapPacks, syncIssues, presence, resourceReports, dispatchEvents, sosSignals, localSummaries]);

      return {
        removedOperations,
        removedViews,
        warning: 'Unsynchronized operations may be lost.',
      };
    },
  };
}

function requireRxdbCollections(database: RxdbDatabaseLike): Record<LocalDbCollectionName, RxCollectionLike> {
  const collections = database.collections;

  if (!collections) {
    throw new Error('RxDB local database did not expose registered collections.');
  }

  for (const collectionName of localDbCollectionNames) {
    if (!collections[collectionName]) {
      throw new Error(`RxDB local database missing collection: ${collectionName}`);
    }
  }

  return collections as Record<LocalDbCollectionName, RxCollectionLike>;
}

function createCollectionRepository<TDocument extends IncidentScoped>(getPrimaryKey: (document: TDocument) => string): CollectionRepository<TDocument> {
  const documents = new Map<string, TDocument>();

  return {
    async upsert(document) {
      documents.set(getPrimaryKey(document), document);
    },
    async findById(id) {
      return documents.get(id) ?? null;
    },
    async findByIncident(incidentId) {
      return Array.from(documents.values()).filter((document) => document.incidentId === incidentId);
    },
    async removeByIncident(incidentId) {
      const keys = Array.from(documents.entries())
        .filter(([, document]) => document.incidentId === incidentId)
        .map(([key]) => key);

      keys.forEach((key) => documents.delete(key));

      return keys.length;
    },
  };
}

function createRxCollectionRepository<TDocument extends IncidentScoped>(collection: RxCollectionLike, primaryKey: keyof TDocument & string): CollectionRepository<TDocument> {
  return {
    async upsert(document) {
      await collection.upsert(document);
    },
    async findById(id) {
      if (!collection.findOne) {
        const documents = await collection.find({ selector: { [primaryKey]: id } }).exec();

        return documents[0] ? unwrapRxDocument<TDocument>(documents[0]) : null;
      }

      const document = await collection.findOne({ selector: { [primaryKey]: id } }).exec();

      return document ? unwrapRxDocument<TDocument>(document) : null;
    },
    async findByIncident(incidentId) {
      const documents = await collection.find({ selector: { incidentId } }).exec();

      return documents.map(unwrapRxDocument<TDocument>);
    },
    async removeByIncident(incidentId) {
      const documents = await collection.find({ selector: { incidentId } }).exec();

      await Promise.all(documents.map((document) => document.remove?.()));

      return documents.length;
    },
  };
}

function unwrapRxDocument<TDocument>(document: RxDocumentLike): TDocument {
  return (document.toJSON ? document.toJSON() : document) as TDocument;
}

async function removeIncidentViews(incidentId: string, repositories: CollectionRepository<IncidentScoped>[]): Promise<number> {
  const removals = await Promise.all(repositories.map((repository) => repository.removeByIncident(incidentId)));

  return removals.reduce((total, count) => total + count, 0);
}

function createSchema(title: string, primaryKey: string, required: string[]): LocalDbSchema {
  return {
    title,
    version: 1,
    primaryKey,
    type: 'object',
    required,
    properties: {
      [primaryKey]: stringProperty,
      version: numberProperty,
      actorKeyId: stringProperty,
      deviceId: stringProperty,
      incidentId: stringProperty,
      cellId: stringProperty,
      opId: stringProperty,
      entityType: stringProperty,
      entityId: stringProperty,
      issueId: stringProperty,
      opType: stringProperty,
      payload: objectProperty,
      bounds: objectProperty,
      signature: stringProperty,
      syncState: stringProperty,
      title: stringProperty,
      name: stringProperty,
      centerType: stringProperty,
      description: stringProperty,
      priority: stringProperty,
      initialNeed: stringProperty,
      confidence: stringProperty,
      risk: stringProperty,
      surplus: stringProperty,
      activationState: stringProperty,
      freshness: stringProperty,
      signalCount: numberProperty,
      corroboratingSignalCount: numberProperty,
      provisional: booleanProperty,
      provisionalReason: stringProperty,
      location: objectProperty,
      actorId: stringProperty,
      role: stringProperty,
      centerId: stringProperty,
      workCenterId: stringProperty,
      category: stringProperty,
      quantityApprox: stringProperty,
      urgency: stringProperty,
      constraints: arrayProperty,
      reportKind: stringProperty,
      dispatchTaskId: stringProperty,
      fromResourceReportId: stringProperty,
      toResourceReportId: stringProperty,
      targetWorkCenterId: stringProperty,
      notes: stringProperty,
      severity: stringProperty,
      message: stringProperty,
      trustStatus: stringProperty,
      trustVisibility: stringProperty,
      trustSignalCount: numberProperty,
      trustDisputeCount: numberProperty,
      roleCounts: objectProperty,
      state: stringProperty,
      failureReason: stringProperty,
      progress: numberProperty,
      estimatedBytes: numberProperty,
      downloadedBytes: numberProperty,
      serverVersion: numberProperty,
      serverUpdatedAt: stringProperty,
      retryCount: numberProperty,
      lastSyncAttemptAt: stringProperty,
      nextRetryAt: stringProperty,
      syncErrorCode: stringProperty,
      syncErrorMessage: stringProperty,
      conflict: objectProperty,
      code: stringProperty,
      hlc: stringProperty,
      createdAtDevice: stringProperty,
      updatedAt: stringProperty,
      materializedAt: nullableStringProperty,
      schemaVersion: numberProperty,
      operationFreshness: stringProperty,
      pendingOperations: numberProperty,
    },
  };
}

/// <reference types="jest" />

import { createSignedOperation, FakeOperationSigner } from '@/infrastructure/security/operation-signer';
import {
  createRxdbLocalDatabase,
  createRxdbLocalOperationDatabase,
  createInMemoryLocalOperationDatabase,
  getLocalDbMigrationStrategies,
  localDbCollectionNames,
  localDbSchemas,
  migrateSyncOperationDocumentToV1,
} from './local-db';

const signer = new FakeOperationSigner('local-db-tests');

async function signedOperation(overrides: Partial<Parameters<typeof createSignedOperation>[0]> = {}) {
  return createSignedOperation(
    {
      actorKeyId: 'actor-key-1',
      deviceId: 'device-1',
      incidentId: 'incident-1',
      cellId: 'cell-a',
      entityId: 'center-1',
      opType: 'work_center.create',
      payload: { name: 'North center' },
      hlc: '2026-06-29T09:00:00.000Z-0001-device-1',
      createdAtDevice: '2026-06-29T09:00:00.000Z',
      ...overrides,
    },
    signer,
  );
}

describe('local operation database contract', () => {
  it('declares sync_ops plus every materialized operational view collection', () => {
    expect(localDbCollectionNames).toEqual([
      'sync_ops',
      'incidents',
      'work_centers',
      'map_packs',
      'sync_issues',
      'presence',
      'resource_reports',
      'dispatch_events',
      'sos_signals',
      'operational_updates',
      'operational_update_actions',
      'local_summaries',
    ]);

    expect(localDbSchemas.sync_ops.primaryKey).toBe('opId');
    expect(localDbSchemas.incidents.primaryKey).toBe('incidentId');
    expect(localDbSchemas.work_centers.primaryKey).toBe('centerId');
    expect(localDbSchemas.map_packs.primaryKey).toBe('packId');
    expect(localDbSchemas.local_summaries.required).toEqual(expect.arrayContaining(['incidentId', 'cellId', 'operationFreshness']));
    expect(localDbSchemas.sync_ops.required).toEqual(
      expect.arrayContaining(['opId', 'version', 'actorKeyId', 'deviceId', 'incidentId', 'cellId', 'entityType', 'entityId', 'opType', 'payload', 'hlc', 'createdAtDevice', 'signature', 'syncState']),
    );
    expect(Object.keys(localDbSchemas.work_centers.properties)).toEqual(expect.arrayContaining(['centerType', 'description', 'priority', 'initialNeed', 'surplus', 'activationState', 'freshness', 'confidence', 'risk', 'signalCount', 'corroboratingSignalCount', 'trustStatus', 'trustVisibility', 'trustSignalCount', 'trustDisputeCount', 'trustExplanation', 'provisional', 'provisionalReason', 'location']));
    expect(Object.keys(localDbSchemas.presence.properties)).toEqual(expect.arrayContaining(['actorId', 'role', 'centerId']));
    expect(Object.keys(localDbSchemas.resource_reports.properties)).toEqual(expect.arrayContaining(['category', 'quantityApprox', 'urgency', 'constraints', 'reportKind', 'workCenterId', 'trustStatus', 'trustVisibility', 'trustSignalCount', 'trustDisputeCount', 'trustExplanation', 'provisional', 'provisionalReason', 'syncState']));
    expect(Object.keys(localDbSchemas.dispatch_events.properties)).toEqual(expect.arrayContaining(['dispatchTaskId', 'category', 'quantityApprox', 'fromResourceReportId', 'toResourceReportId', 'targetWorkCenterId', 'notes', 'provisional', 'provisionalReason']));
    expect(Object.keys(localDbSchemas.sos_signals.properties)).toEqual(expect.arrayContaining(['severity', 'message', 'trustStatus', 'trustVisibility', 'trustSignalCount', 'trustDisputeCount', 'trustExplanation']));
    expect(localDbSchemas.operational_updates.primaryKey).toBe('updateId');
    expect(Object.keys(localDbSchemas.operational_updates.properties)).toEqual(expect.arrayContaining(['updateId', 'type', 'urgency', 'summary', 'source', 'subject', 'actions', 'delivery', 'readState', 'lifecycleState', 'ackState', 'actionState', 'pendingActionType', 'lastActionError']));
    expect(localDbSchemas.operational_update_actions.primaryKey).toBe('localActionId');
    expect(Object.keys(localDbSchemas.operational_update_actions.properties)).toEqual(expect.arrayContaining(['localActionId', 'updateId', 'actionType', 'request', 'receiptId', 'errorCode', 'errorMessage']));
    expect(Object.keys(localDbSchemas.local_summaries.properties)).toEqual(expect.arrayContaining(['roleCounts']));
    expect(Object.keys(localDbSchemas.map_packs.properties)).toEqual(expect.arrayContaining(['failureReason']));
    expect(localDbSchemas.sync_issues.primaryKey).toBe('issueId');
    expect(Object.keys(localDbSchemas.sync_issues.properties)).toEqual(expect.arrayContaining(['issueId', 'state', 'code', 'opId', 'entityId', 'serverVersion', 'serverUpdatedAt']));
  });

  it('creates RxDB collections with schemas and migration strategies', async () => {
    const addCollections = jest.fn().mockResolvedValue({});
    const createDatabase = jest.fn().mockResolvedValue({ addCollections });

    await createRxdbLocalDatabase({ name: 'slice-a-test-db', storage: 'mock-storage', createDatabase });

    expect(createDatabase).toHaveBeenCalledWith({ name: 'slice-a-test-db', storage: 'mock-storage', multiInstance: false });
    expect(addCollections).toHaveBeenCalledWith(
      expect.objectContaining({
        sync_ops: expect.objectContaining({ schema: localDbSchemas.sync_ops, migrationStrategies: getLocalDbMigrationStrategies().sync_ops }),
        incidents: expect.objectContaining({ schema: localDbSchemas.incidents }),
        work_centers: expect.objectContaining({ schema: localDbSchemas.work_centers }),
        map_packs: expect.objectContaining({ schema: localDbSchemas.map_packs }),
        sync_issues: expect.objectContaining({ schema: localDbSchemas.sync_issues }),
        operational_updates: expect.objectContaining({ schema: localDbSchemas.operational_updates }),
        operational_update_actions: expect.objectContaining({ schema: localDbSchemas.operational_update_actions }),
      }),
    );
  });

  it('provides versioned migrations that preserve pending signed operations', () => {
    const migrated = migrateSyncOperationDocumentToV1({
      opId: 'op-1',
      incidentId: 'incident-1',
      cellId: 'cell-a',
      opType: 'incident.create',
      payload: { title: 'Preserved incident' },
      signature: 'signed',
      syncState: 'pending',
      hlc: '2026-06-29T09:00:00.000Z-0001-device-1',
      createdAtDevice: '2026-06-29T09:00:00.000Z',
    });

    expect(getLocalDbMigrationStrategies().sync_ops[1]).toBe(migrateSyncOperationDocumentToV1);
    expect(migrated).toMatchObject({
      opId: 'op-1',
      syncState: 'pending',
      signature: 'signed',
      schemaVersion: 1,
      materializedAt: null,
    });
  });

  it('stores sync_ops and materialized views through isolated collection repositories', async () => {
    const db = createInMemoryLocalOperationDatabase();
    const operation = await signedOperation({ entityId: 'center-7' });

    await db.syncOps.upsert(operation);
    await db.views.workCenters.upsert({
      centerId: 'center-7',
      incidentId: 'incident-1',
      cellId: 'cell-a',
      name: 'North center',
      status: 'pending',
      syncState: 'pending',
      updatedAt: operation.createdAtDevice,
    });

    expect(await db.syncOps.findByIncident('incident-1')).toEqual([operation]);
    expect(await db.views.workCenters.findByIncident('incident-1')).toEqual([
      expect.objectContaining({ centerId: 'center-7', status: 'pending', syncState: 'pending' }),
    ]);
  });

  it('persists sync_ops and materialized views through RxDB-backed repositories', async () => {
    const rxCollections = createFakeRxdbCollections();
    const db = createRxdbLocalOperationDatabase({ collections: rxCollections });
    const operation = await signedOperation({ entityId: 'center-rxdb' });

    await db.syncOps.upsert(operation);
    await db.views.incidents.upsert({ incidentId: 'incident-1', cellId: 'cell-a', title: 'Local incident', status: 'unverified', syncState: 'pending', updatedAt: operation.createdAtDevice });
    await db.views.workCenters.upsert({ centerId: 'center-rxdb', incidentId: 'incident-1', cellId: 'cell-a', name: 'RxDB center', status: 'pending', syncState: 'pending', updatedAt: operation.createdAtDevice });
    await db.views.mapPacks.upsert({ packId: 'incident-1:cell-a', incidentId: 'incident-1', cellId: 'cell-a', bounds: { west: 2.1, south: 41.3, east: 2.2, north: 41.4 }, state: 'downloaded', progress: 1, estimatedBytes: 42, downloadedBytes: 42, updatedAt: operation.createdAtDevice });
    await db.views.operationalUpdates.upsert({ updateId: 'update-1', incidentId: 'incident-1', cellId: 'cell-a', type: 'system_notice', urgency: 'medium', title: 'Notice', summary: 'Local notice', source: { kind: 'system' }, actions: [{ type: 'read', label: 'Read' }], createdAt: operation.createdAtDevice, updatedAt: operation.createdAtDevice, readState: 'unread', lifecycleState: 'active', ackState: 'none', actionState: 'idle', localUpdatedAt: operation.createdAtDevice });

    expect(await db.syncOps.findByIncident('incident-1')).toEqual([operation]);
    expect(await db.views.incidents.findByIncident('incident-1')).toEqual([expect.objectContaining({ incidentId: 'incident-1', syncState: 'pending' })]);
    expect(await db.views.workCenters.findByIncident('incident-1')).toEqual([expect.objectContaining({ centerId: 'center-rxdb', status: 'pending' })]);
    expect(await db.views.mapPacks.findByIncident('incident-1')).toEqual([expect.objectContaining({ packId: 'incident-1:cell-a', state: 'downloaded' })]);
    expect(await db.views.operationalUpdates.findByIncident('incident-1')).toEqual([expect.objectContaining({ updateId: 'update-1', readState: 'unread' })]);
  });

  it('resets spike data for one incident without deleting unrelated local data', async () => {
    const db = createRxdbLocalOperationDatabase({ collections: createFakeRxdbCollections() });
    const incidentOne = await signedOperation({ incidentId: 'incident-1', entityId: 'center-1' });
    const incidentTwo = await signedOperation({ incidentId: 'incident-2', entityId: 'center-2' });

    await db.syncOps.upsert(incidentOne);
    await db.syncOps.upsert(incidentTwo);
    await db.views.workCenters.upsert({ centerId: 'center-1', incidentId: 'incident-1', cellId: 'cell-a', name: 'One', status: 'pending', syncState: 'pending', updatedAt: incidentOne.createdAtDevice });
    await db.views.workCenters.upsert({ centerId: 'center-2', incidentId: 'incident-2', cellId: 'cell-a', name: 'Two', status: 'pending', syncState: 'pending', updatedAt: incidentTwo.createdAtDevice });
    await db.views.operationalUpdates.upsert({ updateId: 'update-1', incidentId: 'incident-1', cellId: 'cell-a', type: 'system_notice', urgency: 'medium', title: 'Notice', summary: 'Local notice', source: { kind: 'system' }, actions: [{ type: 'read', label: 'Read' }], createdAt: incidentOne.createdAtDevice, updatedAt: incidentOne.createdAtDevice, readState: 'unread', lifecycleState: 'active', ackState: 'none', actionState: 'idle', localUpdatedAt: incidentOne.createdAtDevice });
    await db.operationalUpdateActions.upsert({ localActionId: 'action-1', updateId: 'update-1', incidentId: 'incident-1', cellId: 'cell-a', actionType: 'read', request: { channel: 'mobile', externalId: 'actor-key-1' }, syncState: 'pending', createdAt: incidentOne.createdAtDevice, updatedAt: incidentOne.createdAtDevice });

    const result = await db.resetIncident('incident-1');

    expect(result).toEqual({ removedOperations: 2, removedViews: 2, warning: 'Unsynchronized operations may be lost.' });
    expect(await db.syncOps.findByIncident('incident-1')).toEqual([]);
    expect(await db.syncOps.findByIncident('incident-2')).toEqual([incidentTwo]);
  });

  it('runs supported migration output through the repository seam before exposing views', async () => {
    const db = createRxdbLocalOperationDatabase({ collections: createFakeRxdbCollections() });
    const migrated = migrateSyncOperationDocumentToV1({
      opId: 'op-migrated',
      actorKeyId: 'actor-key-1',
      deviceId: 'device-1',
      incidentId: 'incident-1',
      cellId: 'cell-a',
      entityId: 'incident-1',
      entityType: 'incident',
      opType: 'incident.create',
      payload: { title: 'Migrated incident' },
      signature: 'signed-before-upgrade',
      syncState: 'pending',
      hlc: '2026-06-29T09:00:00.000Z-0001-device-1',
      createdAtDevice: '2026-06-29T09:00:00.000Z',
      version: 1,
    });

    await db.syncOps.upsert(migrated);

    expect(db.schemaVersion).toBe(1);
    expect(db.migrationStrategies.sync_ops[1]).toBe(migrateSyncOperationDocumentToV1);
    expect(await db.syncOps.findByIncident('incident-1')).toEqual([expect.objectContaining({ opId: 'op-migrated', signature: 'signed-before-upgrade', schemaVersion: 1, materializedAt: null })]);
  });
});

function createFakeRxdbCollections() {
  return {
    sync_ops: new FakeRxCollection('opId'),
    incidents: new FakeRxCollection('incidentId'),
    work_centers: new FakeRxCollection('centerId'),
    map_packs: new FakeRxCollection('packId'),
    sync_issues: new FakeRxCollection('issueId'),
    presence: new FakeRxCollection('presenceId'),
    resource_reports: new FakeRxCollection('reportId'),
    dispatch_events: new FakeRxCollection('dispatchEventId'),
    sos_signals: new FakeRxCollection('sosId'),
    operational_updates: new FakeRxCollection('updateId'),
    operational_update_actions: new FakeRxCollection('localActionId'),
    local_summaries: new FakeRxCollection('summaryId'),
  };
}

class FakeRxCollection<TDocument extends Record<string, unknown>> {
  private readonly documents = new Map<string, TDocument>();

  constructor(private readonly primaryKey: keyof TDocument & string) {}

  async upsert(document: TDocument): Promise<void> {
    this.documents.set(String(document[this.primaryKey]), document);
  }

  find(query: { selector: Partial<TDocument> }) {
    return {
      exec: async () =>
        Array.from(this.documents.values())
          .filter((document) => Object.entries(query.selector).every(([key, value]) => document[key] === value))
          .map((document) => ({
            toJSON: () => document,
            remove: async () => {
              this.documents.delete(String(document[this.primaryKey]));
            },
          })),
    };
  }
}

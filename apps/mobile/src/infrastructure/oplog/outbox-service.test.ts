/// <reference types="jest" />

import { createRxdbLocalOperationDatabase } from '@/infrastructure/local-db/local-db';
import { FakeOperationSigner, SigningUnavailableError } from '@/infrastructure/security/operation-signer';
import { appendSignedOperationAndMaterialize } from './outbox-service';

const operationInput = {
  actorKeyId: 'actor-key-1',
  deviceId: 'device-1',
  incidentId: 'incident-1',
  cellId: 'cell-a',
  entityId: 'center-1',
  opType: 'work_center.create',
  payload: { name: 'North shelter', priority: 'high', location: { latitude: 41.38, longitude: 2.17 } },
  hlc: '2026-06-29T09:00:00.000Z-0001-device-1',
  createdAtDevice: '2026-06-29T09:00:00.000Z',
} as const;

describe('durable signed outbox service', () => {
  it('persists a signed operation to sync_ops before materializing local views', async () => {
    const writeOrder: string[] = [];
    const db = createRxdbLocalOperationDatabase({ collections: createFakeRxdbCollections(writeOrder) });

    const result = await appendSignedOperationAndMaterialize({
      database: db,
      input: operationInput,
      signer: new FakeOperationSigner('outbox-service-tests'),
    });

    expect(writeOrder.slice(0, 2)).toEqual(['sync_ops', 'work_centers']);
    expect(await db.syncOps.findByIncident('incident-1')).toEqual([expect.objectContaining({ opId: result.operation.opId, signature: result.operation.signature, syncState: 'pending', version: 1, payload: operationInput.payload })]);
    expect(await db.views.workCenters.findByIncident('incident-1')).toEqual([expect.objectContaining({ centerId: 'center-1', name: 'North shelter', status: 'pending', provisional: true, location: operationInput.payload.location })]);
    expect(result.views.localSummaries).toEqual([expect.objectContaining({ pendingOperations: 1, operationFreshness: 'local_pending' })]);
  });

  it('persists SOS operations before exposing provisional local SOS views', async () => {
    const writeOrder: string[] = [];
    const db = createRxdbLocalOperationDatabase({ collections: createFakeRxdbCollections(writeOrder) });

    const result = await appendSignedOperationAndMaterialize({
      database: db,
      input: {
        ...operationInput,
        entityId: 'sos-1',
        opType: 'sos.create',
        payload: { severity: 'critical', message: 'Need support', location: { latitude: 41.38, longitude: 2.17, accuracyMeters: 250 } },
      },
      signer: new FakeOperationSigner('outbox-sos-tests'),
    });

    expect(writeOrder.slice(0, 2)).toEqual(['sync_ops', 'sos_signals']);
    expect(await db.syncOps.findByIncident('incident-1')).toEqual([expect.objectContaining({ opId: result.operation.opId, opType: 'sos.create', syncState: 'pending' })]);
    expect(await db.views.sosSignals.findByIncident('incident-1')).toEqual([
      expect.objectContaining({ sosId: 'sos-1', status: 'open', syncState: 'pending', provisional: true, provisionalReason: 'offline_pending_sync' }),
    ]);
  });

  it('does not persist or materialize when signing is unavailable', async () => {
    const writeOrder: string[] = [];
    const db = createRxdbLocalOperationDatabase({ collections: createFakeRxdbCollections(writeOrder) });
    const signer = { sign: jest.fn().mockRejectedValue(new SigningUnavailableError('Device key locked')) };

    await expect(appendSignedOperationAndMaterialize({ database: db, input: operationInput, signer })).rejects.toThrow(SigningUnavailableError);

    expect(writeOrder).toEqual([]);
    expect(await db.syncOps.findByIncident('incident-1')).toEqual([]);
    expect(await db.views.workCenters.findByIncident('incident-1')).toEqual([]);
  });
});

function createFakeRxdbCollections(writeOrder: string[]) {
  return {
    sync_ops: new FakeRxCollection('sync_ops', 'opId', writeOrder),
    incidents: new FakeRxCollection('incidents', 'incidentId', writeOrder),
    work_centers: new FakeRxCollection('work_centers', 'centerId', writeOrder),
    map_packs: new FakeRxCollection('map_packs', 'packId', writeOrder),
    sync_issues: new FakeRxCollection('sync_issues', 'issueId', writeOrder),
    presence: new FakeRxCollection('presence', 'presenceId', writeOrder),
    resource_reports: new FakeRxCollection('resource_reports', 'reportId', writeOrder),
    dispatch_events: new FakeRxCollection('dispatch_events', 'dispatchEventId', writeOrder),
    sos_signals: new FakeRxCollection('sos_signals', 'sosId', writeOrder),
    local_summaries: new FakeRxCollection('local_summaries', 'summaryId', writeOrder),
  };
}

class FakeRxCollection<TDocument extends Record<string, unknown>> {
  private readonly documents = new Map<string, TDocument>();

  constructor(
    private readonly name: string,
    private readonly primaryKey: keyof TDocument & string,
    private readonly writeOrder: string[],
  ) {}

  async upsert(document: TDocument): Promise<void> {
    this.writeOrder.push(this.name);
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

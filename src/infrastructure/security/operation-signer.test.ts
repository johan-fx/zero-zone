/// <reference types="jest" />

import {
  FakeOperationSigner,
  SigningUnavailableError,
  createCanonicalPayload,
  createSignedOperation,
  operationTypeFamilies,
  type OperationType,
} from './operation-signer';

const baseInput = {
  actorKeyId: 'actor-key-1',
  deviceId: 'device-1',
  incidentId: 'incident-1',
  cellId: 'cell-a',
  entityId: 'entity-1',
  hlc: '2026-06-29T09:00:00.000Z-0001-device-1',
  createdAtDevice: '2026-06-29T09:00:00.000Z',
} as const;

describe('operation signing contract', () => {
  it('builds a stable canonical payload independent from object insertion order', () => {
    const first = createCanonicalPayload({
      version: 1,
      opType: 'work_center.create',
      payload: { priority: 'high', location: { lng: 2.17, lat: 41.38 }, description: 'North gate' },
      ...baseInput,
    });

    const second = createCanonicalPayload({
      createdAtDevice: baseInput.createdAtDevice,
      version: 1,
      payload: { description: 'North gate', location: { lat: 41.38, lng: 2.17 }, priority: 'high' },
      hlc: baseInput.hlc,
      entityId: baseInput.entityId,
      cellId: baseInput.cellId,
      incidentId: baseInput.incidentId,
      deviceId: baseInput.deviceId,
      actorKeyId: baseInput.actorKeyId,
      opType: 'work_center.create',
    });

    expect(first).toBe(second);
    expect(first).toContain('"opType":"work_center.create"');
    expect(first.indexOf('"actorKeyId"')).toBeLessThan(first.indexOf('"cellId"'));
  });

  it('creates a signed pending outbox operation through the signer seam', async () => {
    const signer = new FakeOperationSigner('fake-key-material');

    const operation = await createSignedOperation(
      {
        ...baseInput,
        entityId: 'center-1',
        opType: 'work_center.create',
        payload: { type: 'medical', description: 'Triage tent', priority: 'high' },
      },
      signer,
    );

    expect(operation).toMatchObject({
      version: 1,
      actorKeyId: 'actor-key-1',
      deviceId: 'device-1',
      incidentId: 'incident-1',
      cellId: 'cell-a',
      entityType: 'work_center',
      entityId: 'center-1',
      opType: 'work_center.create',
      syncState: 'pending',
    });
    expect(operation.signature).toMatch(/^fake-signature:actor-key-1:\d+$/);
    expect(operation.opId).toMatch(/^op_\d+$/);

    await expect(
      createSignedOperation(
        {
          ...baseInput,
          entityId: 'center-1',
          opType: 'work_center.create',
          payload: { type: 'medical', description: 'Triage tent', priority: 'high' },
        },
        signer,
      ),
    ).resolves.toMatchObject({ opId: operation.opId, signature: operation.signature });
  });

  it('blocks critical mutations when signing material is unavailable', async () => {
    const unavailableSigner = {
      sign: jest.fn().mockRejectedValue(new SigningUnavailableError('Device key locked')),
    };

    await expect(
      createSignedOperation(
        {
          ...baseInput,
          opType: 'incident.create',
          payload: { title: 'Local incident' },
        },
        unavailableSigner,
      ),
    ).rejects.toThrow(SigningUnavailableError);

    expect(unavailableSigner.sign).toHaveBeenCalledWith(
      expect.objectContaining({ actorKeyId: 'actor-key-1', canonicalPayload: expect.stringContaining('incident.create') }),
    );
  });

  it('maps every critical operation type to its required operation family', async () => {
    const signer = new FakeOperationSigner('family-check');
    const expectedFamilies: Record<OperationType, string> = {
      'incident.create': 'incident',
      'work_center.create': 'work_center',
      'presence.check_in': 'presence',
      'presence.pause': 'presence',
      'presence.check_out': 'presence',
      'resource_report.create': 'resource_report',
      'dispatch_event.create': 'dispatch_event',
      'dispatch_event.update': 'dispatch_event',
      'sos.create': 'sos',
      'sos.cancel': 'sos',
    };

    const operations = await Promise.all(
      (Object.keys(expectedFamilies) as OperationType[]).map((opType, index) =>
        createSignedOperation(
          {
            ...baseInput,
            entityId: `entity-${index}`,
            opType,
            payload: { index, opType },
          },
          signer,
        ),
      ),
    );

    expect(operationTypeFamilies).toEqual(expectedFamilies);
    expect(operations.map((operation) => [operation.opType, operation.entityType])).toEqual(
      Object.entries(expectedFamilies),
    );
  });
});

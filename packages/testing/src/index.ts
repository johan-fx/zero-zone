import type { SignedOperation } from '@zona-cero/contracts';

export function createSignedOperationFixture(overrides: Partial<SignedOperation> = {}): SignedOperation {
  return {
    opId: 'op-fixture-1',
    opVersion: 1,
    actorKeyId: 'actor-key-fixture',
    deviceId: 'device-fixture',
    incidentId: 'incident-fixture',
    cellId: 'cell-fixture',
    entityId: 'incident-fixture',
    opType: 'incident.create',
    payload: { title: 'Fixture incident' },
    hlc: '2026-06-29T00:00:00.000Z-fixture',
    createdAtDevice: '2026-06-29T00:00:00.000Z',
    signature: 'fixture-signature',
    ...overrides,
  };
}

export const telegramStartUpdateFixture = {
  update_id: 1,
  message: {
    message_id: 1,
    text: '/start',
    chat: { id: 1001, type: 'private' },
    from: { id: 1001, is_bot: false, first_name: 'Field' },
  },
} as const;

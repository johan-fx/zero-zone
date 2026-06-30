/// <reference types="jest" />

import { createUnavailableMeshtasticSosAdapter } from './meshtastic-adapter';

describe('Meshtastic SOS adapter seam', () => {
  it('fails safe when no transport is available and never reports acknowledgement', async () => {
    const adapter = createUnavailableMeshtasticSosAdapter();

    await expect(
      adapter.sendSos({
        sosId: 'sos-1',
        incidentId: 'incident-1',
        cellId: 'cell-a',
        payload: { severity: 'critical', message: 'Need help' },
        createdAtDevice: '2026-06-29T09:00:00.000Z',
      }),
    ).resolves.toEqual({
      status: 'unavailable',
      acknowledgement: 'not_received',
      reason: 'transport_unavailable',
      message: 'Meshtastic transport unavailable; SOS remains saved on this device and no acknowledgement has been received.',
    });
  });
});

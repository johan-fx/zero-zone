import type { SosCreatePayload } from '@zona-cero/contracts';

export type MeshtasticSosEnvelope = {
  sosId: string;
  incidentId: string;
  cellId: string;
  payload: SosCreatePayload;
  createdAtDevice: string;
};

export type MeshtasticSendResult =
  | {
      status: 'unavailable';
      acknowledgement: 'not_received';
      reason: 'transport_unavailable';
      message: string;
    }
  | {
      status: 'sent_to_transport';
      acknowledgement: 'not_received';
      reason: 'ack_not_supported';
      message: string;
    };

export type MeshtasticSosAdapter = {
  sendSos(envelope: MeshtasticSosEnvelope): Promise<MeshtasticSendResult>;
};

export function createUnavailableMeshtasticSosAdapter(): MeshtasticSosAdapter {
  return {
    async sendSos() {
      return {
        status: 'unavailable',
        acknowledgement: 'not_received',
        reason: 'transport_unavailable',
        message: 'Meshtastic transport unavailable; SOS remains saved on this device and no acknowledgement has been received.',
      };
    },
  };
}

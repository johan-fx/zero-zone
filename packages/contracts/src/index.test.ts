import { describe, expect, it } from 'vitest';

import { HealthResponseSchema, SignedOperationSchema, SyncPushRequestSchema, operationTypes } from './index';

describe('contracts package', () => {
  it('validates shared signed operation fixtures', () => {
    const operation = SignedOperationSchema.parse({
      opId: 'op-1',
      opVersion: 1,
      actorKeyId: 'actor-key-1',
      deviceId: 'device-1',
      incidentId: 'incident-1',
      cellId: 'cell-a',
      entityId: 'incident-1',
      opType: 'incident.create',
      payload: { title: 'Local drill' },
      hlc: '2026-06-29T00:00:00.000Z-0001',
      createdAtDevice: '2026-06-29T00:00:00.000Z',
      signature: 'signature-1',
    });

    expect(SyncPushRequestSchema.parse({ operations: [operation] }).operations).toHaveLength(1);
  });

  it('keeps health response stable for web and e2e smoke tests', () => {
    expect(HealthResponseSchema.parse({ service: 'zona-cero-api', ok: true, version: '0.0.0' })).toEqual({
      service: 'zona-cero-api',
      ok: true,
      version: '0.0.0',
    });
  });

  it('exposes initial operation language for all channels', () => {
    expect(operationTypes).toContain('work_center.create');
    expect(operationTypes).toContain('sos.raise');
  });
});

/// <reference types="jest" />

import { createSignedOperation, FakeOperationSigner, type OperationType, type SignedOperation } from '@/infrastructure/security/operation-signer';
import { materializeOperations } from './materializer';

const signer = new FakeOperationSigner('materializer-tests');

async function op(opType: OperationType, entityId: string, payload: Record<string, unknown>): Promise<SignedOperation> {
  return createSignedOperation(
    {
      actorKeyId: 'actor-key-1',
      deviceId: 'device-1',
      incidentId: 'incident-1',
      cellId: 'cell-a',
      entityId,
      opType,
      payload,
      hlc: `2026-06-29T09:00:00.000Z-${entityId}-device-1`,
      createdAtDevice: '2026-06-29T09:00:00.000Z',
    },
    signer,
  );
}

describe('operation materializer', () => {
  it('materializes incident and work center operations as pending local views', async () => {
    const incident = await op('incident.create', 'incident-1', { title: 'Local incident', status: 'unverified' });
    const center = await op('work_center.create', 'center-1', {
      name: 'North school',
      centerType: 'shelter',
      priority: 'high',
      location: { lat: 41.38, lng: 2.17 },
    });

    const views = materializeOperations([incident, center]);

    expect(views.incidents).toEqual([
      expect.objectContaining({ incidentId: 'incident-1', title: 'Local incident', status: 'unverified', syncState: 'pending' }),
    ]);
    expect(views.workCenters).toEqual([
      expect.objectContaining({ centerId: 'center-1', name: 'North school', status: 'pending', activationState: 'requires_evidence' }),
    ]);
    expect(views.localSummaries[0]).toMatchObject({ incidentId: 'incident-1', cellId: 'cell-a', pendingOperations: 2 });
  });

  it('keeps duplicate operation replay idempotent across centers and reports', async () => {
    const center = await op('work_center.create', 'center-1', { name: 'North school' });
    const report = await op('resource_report.create', 'report-1', { resource: 'Water', quantity: 24, state: 'needed' });

    const views = materializeOperations([center, report, center, report]);

    expect(views.workCenters).toHaveLength(1);
    expect(views.resourceReports).toHaveLength(1);
    expect(views.localSummaries[0].pendingOperations).toBe(2);
  });

  it('materializes presence state transitions without duplicating role counts', async () => {
    const checkIn = await op('presence.check_in', 'presence-1', { actorId: 'volunteer-1', role: 'medic', centerId: 'center-1' });
    const pause = await op('presence.pause', 'presence-1', { actorId: 'volunteer-1', role: 'medic', centerId: 'center-1' });

    const views = materializeOperations([checkIn, pause, pause]);

    expect(views.presence).toEqual([
      expect.objectContaining({ presenceId: 'presence-1', status: 'paused', role: 'medic', centerId: 'center-1' }),
    ]);
    expect(views.localSummaries[0].roleCounts).toEqual({ medic: 1 });
  });

  it('keeps resource report, dispatch event, and SOS placeholder views schema-compatible', async () => {
    const resource = await op('resource_report.create', 'report-1', { resource: 'Blankets', quantity: 12, state: 'surplus' });
    const dispatchCreate = await op('dispatch_event.create', 'dispatch-1', { eventType: 'assignment', status: 'open' });
    const dispatchUpdate = await op('dispatch_event.update', 'dispatch-1', { status: 'acknowledged' });
    const sosCreate = await op('sos.create', 'sos-1', { severity: 'critical', message: 'Need evacuation support' });
    const sosCancel = await op('sos.cancel', 'sos-1', { reason: 'Resolved locally' });

    const views = materializeOperations([resource, dispatchCreate, dispatchUpdate, sosCreate, sosCancel]);

    expect(views.resourceReports).toEqual([expect.objectContaining({ reportId: 'report-1', resource: 'Blankets', state: 'surplus' })]);
    expect(views.dispatchEvents).toEqual([expect.objectContaining({ dispatchEventId: 'dispatch-1', status: 'acknowledged' })]);
    expect(views.sosSignals).toEqual([expect.objectContaining({ sosId: 'sos-1', status: 'cancelled', message: 'Need evacuation support' })]);
  });
});

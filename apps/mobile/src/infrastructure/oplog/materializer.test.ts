/// <reference types="jest" />

import { WorkCenterCreatePayloadSchema } from '@zona-cero/contracts';
import { validWorkCenterCreateOperationFixture, validWorkCenterCreatePayloadFixture } from '@zona-cero/testing';
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
      location: { latitude: 41.38, longitude: 2.17 },
    });

    const views = materializeOperations([incident, center]);

    expect(views.incidents).toEqual([
      expect.objectContaining({ incidentId: 'incident-1', title: 'Local incident', status: 'unverified', syncState: 'pending' }),
    ]);
    expect(views.workCenters).toEqual([
      expect.objectContaining({ centerId: 'center-1', name: 'North school', status: 'pending', provisional: true, provisionalReason: 'offline_pending_sync' }),
    ]);
    expect(views.localSummaries[0]).toMatchObject({ incidentId: 'incident-1', cellId: 'cell-a', pendingOperations: 2 });
  });

  it('materializes the shared canonical work center create fixture without mobile-only payload fields', () => {
    expect(WorkCenterCreatePayloadSchema.parse(validWorkCenterCreatePayloadFixture)).toEqual(validWorkCenterCreatePayloadFixture);

    const views = materializeOperations([validWorkCenterCreateOperationFixture]);

    expect(views.workCenters).toEqual([
      expect.objectContaining({
        centerId: validWorkCenterCreateOperationFixture.entityId,
        name: validWorkCenterCreatePayloadFixture.name,
        priority: validWorkCenterCreatePayloadFixture.priority,
        location: validWorkCenterCreatePayloadFixture.location,
        provisional: true,
        provisionalReason: 'offline_pending_sync',
      }),
    ]);
    expect(views.workCenters[0]).not.toHaveProperty('confidence');
    expect(views.workCenters[0]).not.toHaveProperty('risk');
    expect(views.workCenters[0]).not.toHaveProperty('staleFields');
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

  it('preserves previous presence actor, role, and center when transition payloads are partial', async () => {
    const checkIn = await op('presence.check_in', 'presence-1', { actorId: 'volunteer-1', role: 'medic', centerId: 'center-1' });
    const pause = await op('presence.pause', 'presence-1', {});
    const checkOut = await op('presence.check_out', 'presence-1', {});

    const pausedViews = materializeOperations([checkIn, pause]);
    const checkedOutViews = materializeOperations([checkIn, pause, checkOut]);

    expect(pausedViews.presence).toEqual([
      expect.objectContaining({ actorId: 'volunteer-1', role: 'medic', centerId: 'center-1', status: 'paused' }),
    ]);
    expect(checkedOutViews.presence).toEqual([
      expect.objectContaining({ actorId: 'volunteer-1', role: 'medic', centerId: 'center-1', status: 'checked_out' }),
    ]);
  });

  it('groups local summaries by incident and cell instead of the first operation only', async () => {
    const incidentOnePresence = await op('presence.check_in', 'presence-1', { actorId: 'volunteer-1', role: 'medic', centerId: 'center-1' });
    const incidentTwoCenter = await createSignedOperation(
      {
        actorKeyId: 'actor-key-1',
        deviceId: 'device-1',
        incidentId: 'incident-2',
        cellId: 'cell-b',
        entityId: 'center-2',
        opType: 'work_center.create',
        payload: { name: 'South school' },
        hlc: '2026-06-29T09:00:01.000Z-center-2-device-1',
        createdAtDevice: '2026-06-29T09:00:01.000Z',
      },
      signer,
    );

    const views = materializeOperations([incidentOnePresence, incidentTwoCenter]);

    expect(views.localSummaries).toEqual([
      expect.objectContaining({ summaryId: 'incident-1:cell-a', pendingOperations: 1, roleCounts: { medic: 1 } }),
      expect.objectContaining({ summaryId: 'incident-2:cell-b', pendingOperations: 1, roleCounts: {} }),
    ]);
  });

  it('materializes canonical resource reports, dispatch events, and SOS local views', async () => {
    const resource = await op('resource_report.create', 'report-1', {
      category: 'Blankets',
      quantityApprox: '12 units',
      urgency: 'high',
      constraints: ['dry storage'],
      reportKind: 'surplus',
      workCenterId: 'center-1',
    });
    const dispatchCreate = await op('dispatch_event.create', 'dispatch-1', {
      category: 'Blankets',
      quantityApprox: '12 units',
      fromResourceReportId: 'report-1',
      targetWorkCenterId: 'center-2',
    });
    const dispatchUpdate = await op('dispatch_event.update', 'dispatch-1', { dispatchTaskId: 'dispatch-1', status: 'accepted', notes: 'Runner assigned' });
    const sosCreate = await op('sos.create', 'sos-1', { severity: 'critical', message: 'Need evacuation support' });
    const sosCancel = await op('sos.cancel', 'sos-1', { reason: 'Resolved locally' });

    const views = materializeOperations([resource, dispatchCreate, dispatchUpdate, sosCreate, sosCancel]);

    expect(views.resourceReports).toEqual([
      expect.objectContaining({
        reportId: 'report-1',
        category: 'Blankets',
        quantityApprox: '12 units',
        urgency: 'high',
        constraints: ['dry storage'],
        reportKind: 'surplus',
        workCenterId: 'center-1',
        provisional: true,
      }),
    ]);
    expect(views.dispatchEvents).toEqual([
      expect.objectContaining({
        dispatchEventId: 'dispatch-1',
        dispatchTaskId: 'dispatch-1',
        category: 'Blankets',
        quantityApprox: '12 units',
        status: 'accepted',
        notes: 'Runner assigned',
        provisionalReason: 'local_update_pending_sync',
      }),
    ]);
    expect(views.sosSignals).toEqual([
      expect.objectContaining({
        sosId: 'sos-1',
        status: 'cancelled',
        message: 'Need evacuation support',
        syncState: 'pending',
        provisional: true,
        provisionalReason: 'offline_pending_sync',
      }),
    ]);
  });

  it('materializes SOS create with local-first sync state and approximate last-known location', async () => {
    const sosCreate = await op('sos.create', 'sos-2', {
      severity: 'medical',
      message: 'Need medical support near north gate',
      location: { latitude: 41.3812, longitude: 2.1734, accuracyMeters: 250 },
    });

    const views = materializeOperations([sosCreate]);

    expect(views.sosSignals).toEqual([
      expect.objectContaining({
        sosId: 'sos-2',
        severity: 'medical',
        message: 'Need medical support near north gate',
        location: { latitude: 41.3812, longitude: 2.1734, accuracyMeters: 250 },
        status: 'open',
        syncState: 'pending',
        provisional: true,
        provisionalReason: 'offline_pending_sync',
      }),
    ]);
  });

});

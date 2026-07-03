import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  HealthResponseSchema,
  IncidentConfigResponseSchema,
  IncidentJoinResponseSchema,
  IncidentListResponseSchema,
  CountryListResponseSchema,
  OperationalMapResponseSchema,
  SosAlertCreateResponseSchema,
  SosAlertStatusResponseSchema,
  SyncPullResponseSchema,
  SyncPushResponseSchema,
  WorkCenterCreateResponseSchema,
  WorkCenterDetailResponseSchema,
  WorkCenterListResponseSchema,
} from '@zona-cero/contracts';
import { mobileSosCreateSyncPushFixture, mobileWorkCenterCreateSyncPushFixture, telegramIncidentJoinRequestFixture, telegramSosCreateRequestFixture, telegramWorkCenterCreateRequestFixture } from '@zona-cero/testing';
import { app } from './index';
import { resetApiTestDatabase } from './test-support';

async function request(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await app.fetch(new Request(`http://local.test${path}`, init), env as Env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe('api contract integration', () => {
  beforeEach(async () => {
    await resetApiTestDatabase((env as Env).DB);
  });

  it('returns health payloads accepted by shared contracts', async () => {
    const response = await request('/health');
    expect(HealthResponseSchema.parse(await response.json()).version).toBe('0.0.0-boilerplate');
  });

  it('returns incident payloads accepted by shared contracts', async () => {
    const list = IncidentListResponseSchema.parse(await (await request('/incidents')).json());
    expect(list.incidents[0]?.incidentId).toBe('incident-zc-demo');

    const config = IncidentConfigResponseSchema.parse(await (await request('/incidents/incident-zc-demo/config')).json());
    expect(config.permissionSnapshots.volunteer.canReadIncident).toBe(true);

    const join = IncidentJoinResponseSchema.parse(
      await (
        await request('/incidents/incident-zc-demo/join', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: 'contract-telegram-user', preferredLocale: 'en' }),
        })
      ).json(),
    );
    expect(join.channelIdentity.channel).toBe('telegram');
    expect(join.channelIdentity.preferredLocale).toBe('en');
  });

  it('returns operational map country and marker payloads accepted by shared contracts', async () => {
    const countries = CountryListResponseSchema.parse(await (await request('/map/countries')).json());
    expect(countries.countries[0]).toMatchObject({ countryCode: 'ES', countryName: 'Spain', incidentCount: 1 });

    const initialMap = OperationalMapResponseSchema.parse(await (await request('/map?countryCode=ES')).json());
    expect(initialMap.incidents[0]).toMatchObject({ incidentId: 'incident-zc-demo', countryCode: 'ES' });
    expect(initialMap.workCenters).toHaveLength(0);
    expect(initialMap.sosAlerts).toHaveLength(0);
    expect(initialMap.counts.withoutLocation).toBe(0);

    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    await request('/incidents/incident-zc-demo/work-centers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramWorkCenterCreateRequestFixture),
    });
    await request('/incidents/incident-zc-demo/sos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramSosCreateRequestFixture),
    });

    const populatedMap = OperationalMapResponseSchema.parse(await (await request('/map?countryCode=es')).json());
    expect(populatedMap.countryCode).toBe('ES');
    expect(populatedMap.workCenters[0]).toMatchObject({ type: 'work_center', name: 'North triage point' });
    expect(populatedMap.sosAlerts).toEqual([]);
    expect(populatedMap.counts.sosAlerts).toBe(1);
    expect(JSON.stringify(populatedMap)).not.toContain('sosAlertId');
  });

  it('returns work center payloads accepted by shared contracts', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    const created = WorkCenterCreateResponseSchema.parse(
      await (
        await request('/incidents/incident-zc-demo/work-centers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(telegramWorkCenterCreateRequestFixture),
        })
      ).json(),
    );
    expect(created.workCenter.activationState).toBe('pending_corroboration');

    const list = WorkCenterListResponseSchema.parse(await (await request('/incidents/incident-zc-demo/work-centers')).json());
    expect(list.workCenters[0]?.workCenterId).toBe(created.workCenter.workCenterId);

    const detail = WorkCenterDetailResponseSchema.parse(
      await (await request(`/incidents/incident-zc-demo/work-centers/${created.workCenter.workCenterId}`)).json(),
    );
    expect(detail.workCenter.latestSignals[0]?.signalType).toBe('creator_report');
  });

  it('returns sync push work center results accepted by shared contracts', async () => {
    const response = SyncPushResponseSchema.parse(
      await (
        await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/push', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
        })
      ).json(),
    );

    expect(response.results[0]).toMatchObject({ opId: 'op-work-center-create-1', status: 'accepted', entityId: 'center-north-triage' });

    const pull = SyncPullResponseSchema.parse(await (await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull')).json());
    expect(pull.operations[0]?.operation.opId).toBe('op-work-center-create-1');
    expect(pull.freshness.status).toBe('fresh');
  });

  it('returns SOS payloads accepted by shared contracts', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    const created = SosAlertCreateResponseSchema.parse(
      await (
        await request('/incidents/incident-zc-demo/sos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(telegramSosCreateRequestFixture),
        })
      ).json(),
    );
    expect(created.sosAlert.status).toBe('open');

    const sync = SyncPushResponseSchema.parse(
      await (
        await request('/sync/push', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(mobileSosCreateSyncPushFixture),
        })
      ).json(),
    );
    expect(sync.results[0]).toMatchObject({ opId: 'op-sos-create-1', status: 'accepted' });

    const list = SosAlertStatusResponseSchema.parse(await (await request('/incidents/incident-zc-demo/sos')).json());
    expect(list.fanout.total).toBeGreaterThanOrEqual(3);
  });
});

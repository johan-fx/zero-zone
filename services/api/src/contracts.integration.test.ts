import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  HealthResponseSchema,
  IncidentConfigResponseSchema,
  IncidentJoinResponseSchema,
  IncidentListResponseSchema,
  SosAlertCreateResponseSchema,
  SosAlertStatusResponseSchema,
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
          body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: 'contract-telegram-user' }),
        })
      ).json(),
    );
    expect(join.channelIdentity.channel).toBe('telegram');
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
        await request('/sync/push', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
        })
      ).json(),
    );

    expect(response.results[0]).toMatchObject({ opId: 'op-work-center-create-1', status: 'accepted' });
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

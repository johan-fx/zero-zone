import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { HealthResponseSchema, IncidentConfigResponseSchema, IncidentJoinResponseSchema, IncidentListResponseSchema } from '@zona-cero/contracts';
import { telegramIncidentJoinRequestFixture } from '@zona-cero/testing';
import { app } from './index';

async function request(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await app.fetch(new Request(`http://local.test${path}`, init), env as Env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe('api contract integration', () => {
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
});

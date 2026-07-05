import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  OperationalUpdateActionResponseSchema,
  OperationalUpdateLinkResponseSchema,
  OperationalUpdatePullResponseSchema,
  ResourceReportCreateResponseSchema,
  SosAlertCreateResponseSchema,
} from '@zona-cero/contracts';
import { telegramIncidentJoinRequestFixture } from '@zona-cero/testing';
import { app } from './index';
import { resetApiTestDatabase } from './test-support';

async function request(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await app.fetch(new Request(`http://local.test${path}`, init), env as Env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe('operational updates API', () => {
  beforeEach(async () => {
    await resetApiTestDatabase((env as Env).DB);
  });

  it('creates pullable operational updates from resource and SOS paths without sensitive payload leakage', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: 'telegram-updates-user', role: 'volunteer' }),
    });

    const resourceResponse = await request('/incidents/incident-zc-demo/resource-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        externalId: 'telegram-updates-user',
        payload: {
          category: 'water',
          quantityApprox: '20 bottles',
          urgency: 'high',
          constraints: ['sealed'],
          reportKind: 'needed',
        },
      }),
    });
    expect(resourceResponse.status).toBe(200);
    ResourceReportCreateResponseSchema.parse(await resourceResponse.json());

    const sosResponse = await request('/incidents/incident-zc-demo/sos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        externalId: 'telegram-updates-user',
        payload: {
          severity: 'critical',
          message: 'Private medical details must not leak',
          location: { latitude: 41.38, longitude: 2.17, accuracyMeters: 10 },
        },
      }),
    });
    expect(sosResponse.status).toBe(200);
    SosAlertCreateResponseSchema.parse(await sosResponse.json());

    const resourceUpdates = OperationalUpdatePullResponseSchema.parse(
      await (await request('/incidents/incident-zc-demo/cells/connected-telegram/updates?limit=10&channel=telegram&externalId=telegram-updates-user')).json(),
    );
    expect(resourceUpdates.updates.some((update) => update.type === 'resource_need' && update.source.kind === 'resource_report')).toBe(true);
    expect(resourceUpdates.updates.some((update) => update.type === 'sos_alert' && update.source.kind === 'sos_alert')).toBe(true);
    expect(JSON.stringify(resourceUpdates)).not.toMatch(/telegram-updates-user|Private medical details|latitude|longitude/i);

    const firstUpdate = resourceUpdates.updates[0];
    if (!firstUpdate) throw new Error('Expected an operational update');

    const ack = await request(`/incidents/incident-zc-demo/updates/${firstUpdate.updateId}/ack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-updates-user', idempotencyKey: 'ack-once' }),
    });
    expect(ack.status).toBe(200);
    const ackBody = OperationalUpdateActionResponseSchema.parse(await ack.json());
    expect(ackBody).toMatchObject({ action: { actionType: 'ack', idempotent: false } });

    const duplicateAck = await request(`/incidents/incident-zc-demo/updates/${firstUpdate.updateId}/ack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-updates-user', idempotencyKey: 'ack-once' }),
    });
    expect(OperationalUpdateActionResponseSchema.parse(await duplicateAck.json()).action.idempotent).toBe(true);

    const link = await request(`/incidents/incident-zc-demo/updates/${firstUpdate.updateId}/links`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-updates-user', idempotencyKey: 'link-once' }),
    });
    expect(link.status).toBe(200);
    const linkBody = OperationalUpdateLinkResponseSchema.parse(await link.json());
    expect(linkBody.link.scope).toBe('operational_update.detail');
    expect(linkBody.link.href).toContain('/operational-updates/private-detail#');

    const detailParams = new URLSearchParams(linkBody.link.href.split('#')[1]);
    const detail = await request('/private-links/operational-updates/detail', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: detailParams.get('token'),
        scope: detailParams.get('scope'),
        correlationId: detailParams.get('correlationId'),
        fingerprint: 'browser-fingerprint-update-detail',
      }),
    });
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({ valid: true, update: { updateId: firstUpdate.updateId } });

    const secondDetailUse = await request('/private-links/operational-updates/detail', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: detailParams.get('token'),
        scope: detailParams.get('scope'),
        correlationId: detailParams.get('correlationId'),
        fingerprint: 'browser-fingerprint-update-detail-second-use',
      }),
    });
    expect(secondDetailUse.status).toBe(410);
  });

  it('scopes read, open, and ack delivery mutations to the acting target only', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: 'telegram-delivery-target', role: 'volunteer' }),
    });
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: 'telegram-delivery-observer', role: 'volunteer' }),
    });

    for (const actionType of ['read', 'open', 'ack'] as const) {
      const resourceResponse = await request('/incidents/incident-zc-demo/resource-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          channel: 'telegram',
          externalId: 'telegram-delivery-target',
          payload: {
            category: `water-${actionType}`,
            quantityApprox: '20 bottles',
            urgency: 'high',
            constraints: ['sealed'],
            reportKind: 'needed',
          },
        }),
      });
      expect(resourceResponse.status).toBe(200);

      const targetBefore = OperationalUpdatePullResponseSchema.parse(
        await (await request('/incidents/incident-zc-demo/cells/connected-telegram/updates?limit=10&channel=telegram&externalId=telegram-delivery-target')).json(),
      );
      const update = targetBefore.updates.find((candidate) => candidate.summary.includes(`water-${actionType}`));
      if (!update) throw new Error(`Expected ${actionType} operational update`);

      const action = await request(`/incidents/incident-zc-demo/updates/${update.updateId}/${actionType}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-delivery-target', idempotencyKey: `${actionType}-delivery-scope` }),
      });
      expect(action.status).toBe(200);

      const targetAfter = OperationalUpdatePullResponseSchema.parse(
        await (await request('/incidents/incident-zc-demo/cells/connected-telegram/updates?limit=10&channel=telegram&externalId=telegram-delivery-target')).json(),
      );
      const observerAfter = OperationalUpdatePullResponseSchema.parse(
        await (await request('/incidents/incident-zc-demo/cells/connected-telegram/updates?limit=10&channel=telegram&externalId=telegram-delivery-observer')).json(),
      );
      expect(targetAfter.updates.find((candidate) => candidate.updateId === update.updateId)?.delivery?.status).toBe(actionType === 'ack' ? 'acked' : 'read');
      expect(observerAfter.updates.find((candidate) => candidate.updateId === update.updateId)?.delivery?.status).toBe('pending');
    }
  });

  it('delegates corroborate and dispute update actions to canonical trust lifecycle', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: 'telegram-trust-updates-user', role: 'volunteer' }),
    });

    const sosResponse = await request('/incidents/incident-zc-demo/sos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-trust-updates-user', payload: { severity: 'critical' } }),
    });
    SosAlertCreateResponseSchema.parse(await sosResponse.json());
    const updates = OperationalUpdatePullResponseSchema.parse(
      await (await request('/incidents/incident-zc-demo/cells/connected-telegram/updates?channel=telegram&externalId=telegram-trust-updates-user')).json(),
    );
    const sosUpdate = updates.updates.find((update) => update.type === 'sos_alert');
    if (!sosUpdate) throw new Error('Expected SOS operational update');

    const corroborate = await request(`/incidents/incident-zc-demo/updates/${sosUpdate.updateId}/corroborate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-trust-updates-user', idempotencyKey: 'corroborate-once', confidence: 0.8 }),
    });
    expect(corroborate.status).toBe(200);
    expect(OperationalUpdateActionResponseSchema.parse(await corroborate.json()).trustState).toMatchObject({
      subject: { entityType: 'sos_alert', entityId: sosUpdate.subject?.entityId },
      signalCount: 1,
    });

    const dispute = await request(`/incidents/incident-zc-demo/updates/${sosUpdate.updateId}/dispute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-trust-updates-user', idempotencyKey: 'dispute-once', reason: 'false_claim' }),
    });
    expect(dispute.status).toBe(200);
    expect(OperationalUpdateActionResponseSchema.parse(await dispute.json()).trustState).toMatchObject({
      subject: { entityType: 'sos_alert', entityId: sosUpdate.subject?.entityId },
      status: 'disputed',
      disputeCount: 1,
    });
  });

  it('requires incident membership and audience targeting before listing operational updates', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: 'telegram-targeted-user', role: 'volunteer' }),
    });
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: 'telegram-non-target-user', role: 'logistics' }),
    });

    const sosResponse = await request('/incidents/incident-zc-demo/sos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-targeted-user', payload: { severity: 'critical' } }),
    });
    expect(sosResponse.status).toBe(200);

    const outsider = await request('/incidents/incident-zc-demo/cells/connected-telegram/updates?channel=telegram&externalId=telegram-outsider');
    expect(outsider.status).toBe(403);

    const targetedBeforeRoleFilter = OperationalUpdatePullResponseSchema.parse(
      await (await request('/incidents/incident-zc-demo/cells/connected-telegram/updates?channel=telegram&externalId=telegram-targeted-user')).json(),
    );
    expect(targetedBeforeRoleFilter.updates.length).toBeGreaterThan(0);

    const firstUpdate = targetedBeforeRoleFilter.updates[0];
    if (!firstUpdate) throw new Error('Expected operational update before role filter');
    await (env as Env).DB.prepare('UPDATE operational_update_audiences SET role = ? WHERE update_id = ? AND channel = ?')
      .bind('volunteer', firstUpdate.updateId, 'telegram')
      .run();

    const target = OperationalUpdatePullResponseSchema.parse(
      await (await request('/incidents/incident-zc-demo/cells/connected-telegram/updates?channel=telegram&externalId=telegram-targeted-user')).json(),
    );
    expect(target.updates.some((update) => update.updateId === firstUpdate.updateId)).toBe(true);

    const nonTarget = OperationalUpdatePullResponseSchema.parse(
      await (await request('/incidents/incident-zc-demo/cells/connected-telegram/updates?channel=telegram&externalId=telegram-non-target-user')).json(),
    );
    expect(nonTarget.updates.some((update) => update.updateId === firstUpdate.updateId)).toBe(false);

    const outsiderAct = await request(`/incidents/incident-zc-demo/updates/${firstUpdate.updateId}/ack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-outsider', idempotencyKey: 'outsider-ack' }),
    });
    expect(outsiderAct.status).toBe(403);

    for (const actionType of ['ack', 'open', 'corroborate', 'dispute', 'link'] as const) {
      const segment = actionType === 'link' ? 'links' : actionType;
      const body = {
        channel: 'telegram',
        externalId: 'telegram-non-target-user',
        idempotencyKey: `non-target-${actionType}`,
        ...(actionType === 'corroborate' ? { confidence: 0.7 } : {}),
        ...(actionType === 'dispute' ? { reason: 'context_mismatch' } : {}),
      };
      const response = await request(`/incidents/incident-zc-demo/updates/${firstUpdate.updateId}/${segment}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(403);
    }
  });

  it('directs a resource-offer update to the matching demander and not to unrelated members (Slice 21.1)', async () => {
    const demander = 'telegram-demander-water';
    const supplier = 'telegram-supplier-water';
    const outsider = 'telegram-outsider-water';

    for (const externalId of [demander, supplier, outsider]) {
      await request('/incidents/incident-zc-demo/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId, role: 'volunteer' }),
      });
    }

    // Demander asks for water first (no surplus yet -> falls back to cell broadcast).
    await request('/incidents/incident-zc-demo/resource-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        externalId: demander,
        payload: { category: 'water', quantityApprox: '20 bottles', urgency: 'high', constraints: ['sealed'], reportKind: 'needed' },
      }),
    });

    // Supplier offers matching water -> should emit a targeted resource_offer update to the demander.
    const offer = await request('/incidents/incident-zc-demo/resource-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        externalId: supplier,
        payload: { category: 'water', quantityApprox: '30 bottles', urgency: 'medium', constraints: ['sealed'], reportKind: 'surplus' },
      }),
    });
    expect(offer.status).toBe(200);

    const pull = async (externalId: string) => OperationalUpdatePullResponseSchema.parse(
      await (await request(`/incidents/incident-zc-demo/cells/connected-telegram/updates?limit=20&channel=telegram&externalId=${externalId}`)).json(),
    );

    const demanderUpdates = await pull(demander);
    const matchUpdate = demanderUpdates.updates.find(
      (update) => update.type === 'resource_offer' && update.reasonCode === 'resource.match.offer_for_open_need',
    );
    expect(matchUpdate, 'demander should receive the targeted resource-offer match update').toBeDefined();

    const outsiderUpdates = await pull(outsider);
    expect(
      outsiderUpdates.updates.some((update) => update.updateId === matchUpdate?.updateId),
      'unrelated member must not receive the targeted match update',
    ).toBe(false);

    // Privacy: targeting must not leak reporter identities into the payload.
    expect(JSON.stringify(demanderUpdates)).not.toMatch(/telegram-demander-water|telegram-supplier-water/i);
  });

  it('suppresses proactive match updates for an actor who opted out (Slice 21.1 Fase 2)', async () => {
    const demander = 'telegram-quiet-demander';
    const supplier = 'telegram-quiet-supplier';

    for (const externalId of [demander, supplier]) {
      await request('/incidents/incident-zc-demo/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId, role: 'volunteer' }),
      });
    }

    // A non-member cannot set preferences.
    const forbidden = await request('/incidents/incident-zc-demo/updates/preferences', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-not-a-member', quietProactiveUpdates: true }),
    });
    expect(forbidden.status).toBe(403);

    // Demander asks for water, then opts out of proactive match updates.
    await request('/incidents/incident-zc-demo/resource-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: demander, payload: { category: 'blankets', quantityApprox: '10', urgency: 'high', constraints: [], reportKind: 'needed' } }),
    });
    const optOut = await request('/incidents/incident-zc-demo/updates/preferences', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: demander, quietProactiveUpdates: true }),
    });
    expect(optOut.status).toBe(200);
    await expect(optOut.json()).resolves.toMatchObject({ quietProactiveUpdates: true });

    // Supplier offers matching blankets -> would normally target the demander, but they are quieted.
    await request('/incidents/incident-zc-demo/resource-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: supplier, payload: { category: 'blankets', quantityApprox: '15', urgency: 'medium', constraints: [], reportKind: 'surplus' } }),
    });

    const demanderUpdates = OperationalUpdatePullResponseSchema.parse(
      await (await request(`/incidents/incident-zc-demo/cells/connected-telegram/updates?limit=20&channel=telegram&externalId=${demander}`)).json(),
    );
    expect(
      demanderUpdates.updates.some((update) => update.reasonCode === 'resource.match.offer_for_open_need'),
      'quieted actor must not receive the targeted proactive match update',
    ).toBe(false);
  });
});

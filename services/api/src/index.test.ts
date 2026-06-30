import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createSignedOperationFixture,
  mobileIncidentJoinRequestFixture,
  telegramIncidentJoinRequestFixture,
  telegramStartUpdateFixture,
} from '@zona-cero/testing';
import { IncidentJoinResponseSchema, TelegramWebhookResultSchema } from '@zona-cero/contracts';
import { app } from './index';
import { resetApiTestDatabase } from './test-support';

async function request(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await app.fetch(new Request(`http://local.test${path}`, init), env as Env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

describe('api worker', () => {
  beforeEach(async () => {
    await resetApiTestDatabase((env as Env).DB);
  });

  it('serves a stable health response', async () => {
    const response = await request('/health');

    await expect(response.json()).resolves.toEqual({ service: 'zona-cero-api', ok: true, version: '0.0.0-boilerplate' });
  });

  it('accepts contract-valid sync push operations', async () => {
    const response = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operations: [createSignedOperationFixture({ opId: 'op-api-1' })] }),
    });

    await expect(response.json()).resolves.toEqual({ results: [{ opId: 'op-api-1', status: 'accepted' }] });
  });

  it('routes Telegram webhook updates through the telegram-channel workspace', async () => {
    const response = await request('/telegram/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramStartUpdateFixture),
    });

    await expect(response.json()).resolves.toMatchObject({ accepted: true, command: '/start', responseText: expect.stringContaining('Choose an incident') });
  });

  it('drives Telegram webhook updates through the real incident join flow', async () => {
    const telegramUserId = 24001;
    const baseUpdate = {
      update_id: 24001,
      message: {
        message_id: 1,
        chat: { id: telegramUserId, type: 'private' },
        from: { id: telegramUserId, is_bot: false, first_name: 'Webhook' },
      },
    };

    const postTelegramMessage = async (text: string) => {
      const response = await request('/telegram/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...baseUpdate, message: { ...baseUpdate.message, text } }),
      });

      expect(response.status).toBe(200);
      return TelegramWebhookResultSchema.parse(await response.json());
    };

    const beforeFirstStateMs = Date.now() - 1000;
    await expect(postTelegramMessage('/start')).resolves.toMatchObject({
      accepted: true,
      command: '/start',
      responseText: expect.stringContaining('incident-zc-demo'),
    });

    const stateKey = `chat:${telegramUserId}:from:${telegramUserId}`;
    const firstState = await (env as Env).DB.prepare(
      'SELECT step, updated_at AS updatedAt, expires_at AS expiresAt FROM telegram_conversation_states WHERE state_key = ?',
    )
      .bind(stateKey)
      .first<{ step: string; updatedAt: string; expiresAt: string }>();
    expect(firstState).toMatchObject({ step: 'awaitingIncident' });
    const firstUpdatedAtMs = Date.parse(firstState?.updatedAt ?? '');
    const firstExpiresAtMs = Date.parse(firstState?.expiresAt ?? '');
    expect(Number.isFinite(firstUpdatedAtMs)).toBe(true);
    expect(firstUpdatedAtMs).toBeGreaterThanOrEqual(beforeFirstStateMs);
    expect(firstExpiresAtMs).toBeGreaterThan(Date.now());

    await expect(postTelegramMessage('1')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('What pseudonym'),
    });

    const refreshedState = await (env as Env).DB.prepare(
      'SELECT step, updated_at AS updatedAt, expires_at AS expiresAt FROM telegram_conversation_states WHERE state_key = ?',
    )
      .bind(stateKey)
      .first<{ step: string; updatedAt: string; expiresAt: string }>();
    expect(refreshedState).toMatchObject({ step: 'awaitingPseudonym' });
    expect(Date.parse(refreshedState?.updatedAt ?? '')).toBeGreaterThanOrEqual(firstUpdatedAtMs);
    expect(Date.parse(refreshedState?.expiresAt ?? '')).toBeGreaterThan(Date.now());

    await expect(postTelegramMessage('Webhook Volunteer')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Choose your role'),
    });

    const joined = await postTelegramMessage('1');
    expect(joined).toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Joined Zona Cero Demo Incident as volunteer.'),
    });

    const externalId = String(telegramUserId);
    const channelIdentityId = `chid_telegram_${externalId}`;
    const membership = await (env as Env).DB.prepare(
      'SELECT role, permissions_json AS permissionsJson FROM incident_memberships WHERE incident_id = ? AND channel_identity_id = ?',
    )
      .bind('incident-zc-demo', channelIdentityId)
      .first<{ role: string; permissionsJson: string }>();
    expect(membership).toMatchObject({ role: 'volunteer' });
    expect(JSON.parse(membership?.permissionsJson ?? '{}')).toMatchObject({ canJoinIncident: true });

    const audit = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE channel_identity_id = ?')
      .bind(channelIdentityId)
      .first<{ count: number }>();
    expect(audit?.count).toBe(1);

    const terminalState = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key = ?')
      .bind(stateKey)
      .first<{ count: number }>();
    expect(terminalState?.count).toBe(0);
  });

  it('resets corrupt Telegram conversation state before handling updates', async () => {
    const telegramUserId = 24002;
    const stateKey = `chat:${telegramUserId}:from:${telegramUserId}`;
    await (env as Env).DB.prepare(
      `INSERT INTO telegram_conversation_states (state_key, state_json, step, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(stateKey, '{"step":"awaitingRole"', 'awaitingRole', new Date(Date.now() + 30 * 60 * 1000).toISOString())
      .run();

    const response = await request('/telegram/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        update_id: 24002,
        message: {
          message_id: 1,
          text: '/start',
          chat: { id: telegramUserId, type: 'private' },
          from: { id: telegramUserId, is_bot: false, first_name: 'Corrupt' },
        },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      command: '/start',
      responseText: expect.stringContaining('incident-zc-demo'),
    });

    const repairedState = await (env as Env).DB.prepare('SELECT step FROM telegram_conversation_states WHERE state_key = ?')
      .bind(stateKey)
      .first<{ step: string }>();
    expect(repairedState).toMatchObject({ step: 'awaitingIncident' });
  });

  it('resets invalid-expiry Telegram conversation state before handling updates', async () => {
    const telegramUserId = 24004;
    const stateKey = `chat:${telegramUserId}:from:${telegramUserId}`;
    const staleCreatedAt = '2000-01-01T00:00:00.000Z';
    await (env as Env).DB.prepare(
      `INSERT INTO telegram_conversation_states (state_key, state_json, step, created_at, updated_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        stateKey,
        JSON.stringify({ step: 'awaitingIncident', incidents: [], externalUserId: String(telegramUserId) }),
        'awaitingIncident',
        staleCreatedAt,
        staleCreatedAt,
        'not-a-date',
      )
      .run();

    const response = await request('/telegram/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        update_id: 24004,
        message: {
          message_id: 1,
          text: '/start',
          chat: { id: telegramUserId, type: 'private' },
          from: { id: telegramUserId, is_bot: false, first_name: 'InvalidExpiry' },
        },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      command: '/start',
      responseText: expect.stringContaining('incident-zc-demo'),
    });

    const repairedState = await (env as Env).DB.prepare(
      'SELECT step, created_at AS createdAt, updated_at AS updatedAt, expires_at AS expiresAt FROM telegram_conversation_states WHERE state_key = ?',
    )
      .bind(stateKey)
      .first<{ step: string; createdAt: string; updatedAt: string; expiresAt: string }>();
    expect(repairedState).toMatchObject({ step: 'awaitingIncident' });
    expect(repairedState?.createdAt).not.toBe(staleCreatedAt);
    expect(Date.parse(repairedState?.updatedAt ?? '')).toBeGreaterThan(Date.parse(staleCreatedAt));
    expect(Date.parse(repairedState?.expiresAt ?? '')).toBeGreaterThan(Date.now());
  });

  it('resets expired Telegram conversation state before handling updates', async () => {
    const telegramUserId = 24003;
    const stateKey = `chat:${telegramUserId}:from:${telegramUserId}`;
    await (env as Env).DB.prepare(
      `INSERT INTO telegram_conversation_states (state_key, state_json, step, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(
        stateKey,
        JSON.stringify({ step: 'awaitingIncident', incidents: [], externalUserId: String(telegramUserId) }),
        'awaitingIncident',
        new Date(Date.now() - 1000).toISOString(),
      )
      .run();

    const response = await request('/telegram/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        update_id: 24003,
        message: {
          message_id: 1,
          text: '/start',
          chat: { id: telegramUserId, type: 'private' },
          from: { id: telegramUserId, is_bot: false, first_name: 'Expired' },
        },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      accepted: true,
      command: '/start',
      responseText: expect.stringContaining('incident-zc-demo'),
    });

    const repairedState = await (env as Env).DB.prepare('SELECT step FROM telegram_conversation_states WHERE state_key = ?')
      .bind(stateKey)
      .first<{ step: string }>();
    expect(repairedState).toMatchObject({ step: 'awaitingIncident' });
  });

  it('lists seeded incidents and exposes incident config', async () => {
    const list = await request('/incidents');
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({ incidents: [{ incidentId: 'incident-zc-demo' }] });

    const config = await request('/incidents/incident-zc-demo/config');
    expect(config.status).toBe(200);
    await expect(config.json()).resolves.toMatchObject({ roles: ['volunteer', 'coordinator', 'logistics', 'medical'] });
  });

  it('joins Telegram identities and creates an audit event', async () => {
    const response = await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    expect(response.status).toBe(200);
    const body = IncidentJoinResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      channelIdentity: { channel: 'telegram', externalId: 'telegram-user-1001' },
      membership: { role: 'volunteer' },
      audit: { auditEventId: 'audit_join_incident-zc-demo_chid_telegram_telegram-user-1001_volunteer' },
      idempotent: false,
    });

    const audit = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE audit_event_id = ?')
      .bind(body.audit.auditEventId)
      .first<{ count: number }>();
    expect(audit?.count).toBe(1);
  });

  it('joins mobile identities', async () => {
    const response = await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileIncidentJoinRequestFixture),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      channelIdentity: { channel: 'mobile', externalId: 'mobile-device-1001' },
      membership: { role: 'medical', permissions: { canManageMedical: true } },
      idempotent: false,
    });
  });

  it('returns 404 for missing incidents', async () => {
    const response = await request('/incidents/missing-incident/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    expect(response.status).toBe(404);
  });

  it('returns 400 for invalid roles', async () => {
    const response = await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, role: 'admin' }),
    });

    expect(response.status).toBe(400);
  });

  it('recovers a missing audit event for an idempotent retry after partial join persistence', async () => {
    await request('/incidents');

    const partialExternalId = 'telegram-user-partial-audit';
    const channelIdentityId = 'chid_telegram_telegram-user-partial-audit';
    const incidentMembershipId = `mship_incident-zc-demo_${channelIdentityId}_volunteer`;
    const auditEventId = `audit_join_incident-zc-demo_${channelIdentityId}_volunteer`;

    await (env as Env).DB.prepare(
      `INSERT OR IGNORE INTO channel_identities (channel_identity_id, channel, external_id, display_name)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(channelIdentityId, 'telegram', partialExternalId, 'Partial Audit User')
      .run();

    await (env as Env).DB.prepare(
      `INSERT OR IGNORE INTO incident_memberships (incident_membership_id, incident_id, channel_identity_id, role, permissions_json)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        incidentMembershipId,
        'incident-zc-demo',
        channelIdentityId,
        'volunteer',
        JSON.stringify({
          canReadIncident: true,
          canJoinIncident: true,
          canManageIncident: false,
          canManageLogistics: false,
          canManageMedical: false,
        }),
      )
      .run();

    await (env as Env).DB.prepare('DELETE FROM audit_events WHERE audit_event_id = ?').bind(auditEventId).run();

    const response = await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: partialExternalId }),
    });

    expect(response.status).toBe(200);
    const body = IncidentJoinResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      membership: { incidentMembershipId },
      audit: { auditEventId },
      idempotent: true,
    });

    const audit = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE audit_event_id = ?')
      .bind(body.audit.auditEventId)
      .first<{ count: number }>();
    expect(audit?.count).toBe(1);
  });

  it('treats duplicate channel identity joins as idempotent without duplicating audit events', async () => {
    const init = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: 'telegram-user-idempotent' }),
    };

    const first = await request('/incidents/incident-zc-demo/join', init);
    const second = await request('/incidents/incident-zc-demo/join', init);
    const firstBody = IncidentJoinResponseSchema.parse(await first.json());
    const secondBody = IncidentJoinResponseSchema.parse(await second.json());

    expect(firstBody.idempotent).toBe(false);
    expect(secondBody).toMatchObject({
      channelIdentity: firstBody.channelIdentity,
      membership: firstBody.membership,
      audit: firstBody.audit,
      idempotent: true,
    });

    const audit = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE incident_membership_id = ?')
      .bind(firstBody.membership.incidentMembershipId)
      .first<{ count: number }>();
    expect(audit?.count).toBe(1);
  });
});

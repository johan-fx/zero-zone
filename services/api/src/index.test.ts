import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createSignedOperationFixture,
  incompatibleVersionSyncPushRequestFixture,
  mobileWorkCenterCreateSyncPushFixture,
  mobileSosCancelSyncPushFixture,
  mobileSosCreateSyncPushFixture,
  mobileIncidentJoinRequestFixture,
  telegramSosCreateRequestFixture,
  telegramIncidentJoinRequestFixture,
  telegramStartUpdateFixture,
  telegramWorkCenterCreateRequestFixture,
  validSosCreateOperationFixture,
  validWorkCenterCreateOperationFixture,
} from '@zona-cero/testing';
import {
  DispatchTaskListResponseSchema,
  DispatchTaskResponseSchema,
  IncidentJoinResponseSchema,
  ResourceReportCreateResponseSchema,
  ResourceReportListResponseSchema,
  ResourceReportMatchResponseSchema,
  SosAlertCreateResponseSchema,
  SosAlertStatusResponseSchema,
  SyncPushResponseSchema,
  TelegramWebhookResultSchema,
  WorkCenterCreateResponseSchema,
  WorkCenterDetailResponseSchema,
  WorkCenterListResponseSchema,
} from '@zona-cero/contracts';
import { app } from './index';
import { resetApiTestDatabase } from './test-support';

async function request(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await app.fetch(new Request(`http://local.test${path}`, init), env as Env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function postTelegramMessage(telegramUserId: number, text: string, firstName = 'Webhook'): Promise<ReturnType<typeof TelegramWebhookResultSchema.parse>> {
  const response = await request('/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      update_id: telegramUserId,
      message: {
        message_id: 1,
        text,
        chat: { id: telegramUserId, type: 'private' },
        from: { id: telegramUserId, is_bot: false, first_name: firstName },
      },
    }),
  });

  expect(response.status).toBe(200);
  return TelegramWebhookResultSchema.parse(await response.json());
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

  it('materializes work center create operations from sync push', async () => {
    const response = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
    });

    expect(response.status).toBe(200);
    expect(SyncPushResponseSchema.parse(await response.json())).toEqual({
      results: [{ opId: 'op-work-center-create-1', status: 'accepted' }],
    });

    const list = WorkCenterListResponseSchema.parse(await (await request('/incidents/incident-zc-demo/work-centers')).json());
    expect(list.workCenters).toHaveLength(1);
    expect(list.workCenters[0]).toMatchObject({
      workCenterId: 'center-north-triage',
      activationState: 'pending_corroboration',
      status: 'reported',
      confidence: 'low',
    });

    const detail = WorkCenterDetailResponseSchema.parse(
      await (await request('/incidents/incident-zc-demo/work-centers/center-north-triage')).json(),
    );
    expect(detail.workCenter.latestSignals[0]).toMatchObject({ signalType: 'creator_report', sourceChannel: 'mobile' });
  });

  it('recomputes work center freshness and risk on API reads instead of returning stale persisted values', async () => {
    await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
    });

    const oldUpdatedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await (env as Env).DB.prepare('UPDATE work_centers SET updated_at = ?, freshness = ?, risk = ? WHERE work_center_id = ?')
      .bind(oldUpdatedAt, 'fresh', 'low', 'center-north-triage')
      .run();

    const list = WorkCenterListResponseSchema.parse(await (await request('/incidents/incident-zc-demo/work-centers')).json());
    expect(list.workCenters[0]).toMatchObject({
      workCenterId: 'center-north-triage',
      freshness: 'stale',
      risk: 'medium',
      updatedAt: oldUpdatedAt,
    });

    const detail = WorkCenterDetailResponseSchema.parse(
      await (await request('/incidents/incident-zc-demo/work-centers/center-north-triage')).json(),
    );
    expect(detail.workCenter).toMatchObject({
      workCenterId: 'center-north-triage',
      freshness: 'stale',
      risk: 'medium',
      updatedAt: oldUpdatedAt,
    });

    const persisted = await (env as Env).DB.prepare('SELECT freshness, risk FROM work_centers WHERE work_center_id = ?')
      .bind('center-north-triage')
      .first<{ freshness: string; risk: string }>();
    expect(persisted).toEqual({ freshness: 'fresh', risk: 'low' });
  });

  it('idempotently accepts duplicate work center sync operations and rejects incompatible duplicate opIds', async () => {
    const first = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
    });
    const duplicate = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
    });
    const conflict = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operations: [
          {
            ...validWorkCenterCreateOperationFixture,
            payload: { ...validWorkCenterCreateOperationFixture.payload, name: 'Changed center name' },
          },
        ],
      }),
    });

    expect(SyncPushResponseSchema.parse(await first.json()).results[0]).toMatchObject({ status: 'accepted' });
    expect(SyncPushResponseSchema.parse(await duplicate.json()).results[0]).toMatchObject({ status: 'accepted' });
    expect(SyncPushResponseSchema.parse(await conflict.json()).results[0]).toMatchObject({ status: 'rejected', code: 'operation_conflict' });

    const count = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM work_centers WHERE work_center_id = ?')
      .bind('center-north-triage')
      .first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it('rejects unknown sync operation versions with a stable error result', async () => {
    const response = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(incompatibleVersionSyncPushRequestFixture),
    });

    expect(response.status).toBe(200);
    expect(SyncPushResponseSchema.parse(await response.json()).results[0]).toMatchObject({
      opId: 'op-work-center-create-1',
      status: 'rejected',
      code: 'invalid_operation_version',
    });
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

  it('drives Telegram webhook /workcenter through the real connected work center create flow after membership exists', async () => {
    const telegramUserId = 25001;
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...telegramIncidentJoinRequestFixture,
        externalId: String(telegramUserId),
        displayName: 'Work Center Reporter',
      }),
    });

    await expect(postTelegramMessage(telegramUserId, '/workcenter', 'Reporter')).resolves.toMatchObject({
      accepted: true,
      command: '/workcenter',
      responseText: expect.stringContaining('Choose an incident before reporting a work center'),
    });

    const stateKey = `flow:workcenter:chat:${telegramUserId}:from:${telegramUserId}`;
    const startedState = await (env as Env).DB.prepare('SELECT step FROM telegram_conversation_states WHERE state_key = ?')
      .bind(stateKey)
      .first<{ step: string }>();
    expect(startedState).toMatchObject({ step: 'awaitingIncident' });

    await expect(postTelegramMessage(telegramUserId, '1', 'Reporter')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Send the work center name'),
    });

    await expect(postTelegramMessage(telegramUserId, 'Telegram staging center', 'Reporter')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Confirm work center report'),
    });

    const created = await postTelegramMessage(telegramUserId, 'yes', 'Reporter');
    expect(created).toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Work center reported: Telegram staging center.'),
    });

    const workCenterId = `wc_incident-zc-demo_telegram_${telegramUserId}_Telegram-staging-center`;
    const detail = WorkCenterDetailResponseSchema.parse(
      await (await request(`/incidents/incident-zc-demo/work-centers/${workCenterId}`)).json(),
    );
    expect(detail.workCenter).toMatchObject({
      workCenterId,
      name: 'Telegram staging center',
      sourceChannel: 'telegram',
      signalCount: 1,
    });

    const terminalState = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key = ?')
      .bind(stateKey)
      .first<{ count: number }>();
    expect(terminalState?.count).toBe(0);
  });

  it('clears denied /workcenter state so /start incident join replies are not hijacked', async () => {
    const telegramUserId = 25002;

    await postTelegramMessage(telegramUserId, '/workcenter', 'NoMember');
    await postTelegramMessage(telegramUserId, '1', 'NoMember');
    await postTelegramMessage(telegramUserId, 'Unjoined staging center', 'NoMember');

    const denied = await postTelegramMessage(telegramUserId, 'yes', 'NoMember');
    expect(denied).toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Permission denied'),
    });
    expect(denied.responseText).toContain('Join this incident first with /start');

    const clearedWorkCenterState = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key = ?')
      .bind(`flow:workcenter:chat:${telegramUserId}:from:${telegramUserId}`)
      .first<{ count: number }>();
    expect(clearedWorkCenterState?.count).toBe(0);

    await expect(postTelegramMessage(telegramUserId, '/start', 'NoMember')).resolves.toMatchObject({
      accepted: true,
      command: '/start',
      responseText: expect.stringContaining('incident-zc-demo'),
    });
    await expect(postTelegramMessage(telegramUserId, '1', 'NoMember')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('What pseudonym'),
    });
    await expect(postTelegramMessage(telegramUserId, 'Recovered Volunteer', 'NoMember')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Choose your role'),
    });

    const joined = await postTelegramMessage(telegramUserId, '1', 'NoMember');
    expect(joined).toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Joined Zona Cero Demo Incident as volunteer.'),
    });

    const membership = await (env as Env).DB.prepare(
      'SELECT role FROM incident_memberships WHERE incident_id = ? AND channel_identity_id = ?',
    )
      .bind('incident-zc-demo', `chid_telegram_${telegramUserId}`)
      .first<{ role: string }>();
    expect(membership).toMatchObject({ role: 'volunteer' });

    const workCenter = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM work_centers WHERE name = ?')
      .bind('Unjoined staging center')
      .first<{ count: number }>();
    expect(workCenter?.count).toBe(0);
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

  it('creates connected-channel work centers for joined identities', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    const response = await request('/incidents/incident-zc-demo/work-centers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramWorkCenterCreateRequestFixture),
    });

    expect(response.status).toBe(200);
    const body = WorkCenterCreateResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      workCenter: {
        name: 'North triage point',
        sourceChannel: 'telegram',
        activationState: 'pending_corroboration',
        status: 'reported',
        signalCount: 1,
      },
      idempotent: false,
    });

    const audit = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE audit_event_id = ?')
      .bind(body.audit.auditEventId)
      .first<{ count: number }>();
    expect(audit?.count).toBe(1);
  });

  it('rejects connected-channel work center creation for non-members', async () => {
    const response = await request('/incidents/incident-zc-demo/work-centers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramWorkCenterCreateRequestFixture),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'permission_denied' });
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

  it('creates, lists and matches resource reports', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    const needResponse = await request('/incidents/incident-zc-demo/resource-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        externalId: 'telegram-user-1001',
        payload: { category: 'water', quantityApprox: '20 boxes', urgency: 'high', constraints: ['sealed'], reportKind: 'needed' },
      }),
    });
    expect(needResponse.status).toBe(200);
    const need = ResourceReportCreateResponseSchema.parse(await needResponse.json());
    expect(need.resourceReport).toMatchObject({ category: 'water', reportKind: 'needed', sourceChannel: 'telegram' });

    await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operations: [{
          ...createSignedOperationFixture({
            opId: 'op-resource-surplus-1',
            incidentId: 'incident-zc-demo',
            cellId: 'connected-telegram',
            entityId: 'rr-surplus-water-1',
            entityType: 'resource_report',
            opType: 'resource_report.create',
            payload: { category: 'water', quantityApprox: '30 boxes', urgency: 'medium', constraints: [], reportKind: 'surplus' },
          }),
          syncState: 'pending',
        }],
      }),
    });

    const list = ResourceReportListResponseSchema.parse(await (await request('/incidents/incident-zc-demo/resource-reports')).json());
    expect(list.resourceReports.map((report) => report.reportKind).sort()).toEqual(['needed', 'surplus']);

    const matches = ResourceReportMatchResponseSchema.parse(await (await request('/incidents/incident-zc-demo/resource-reports/matches')).json());
    expect(matches.matches).toHaveLength(1);
    expect(matches.matches[0]).toMatchObject({ need: { reportKind: 'needed' }, surplus: { reportKind: 'surplus' } });
  });

  it('creates and updates dispatch task status', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    const create = await request('/incidents/incident-zc-demo/dispatch-tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        externalId: 'telegram-user-1001',
        payload: { category: 'water', quantityApprox: '10 boxes', notes: 'Bring to north gate' },
      }),
    });
    expect(create.status).toBe(200);
    const created = DispatchTaskResponseSchema.parse(await create.json());
    expect(created.dispatchTask.status).toBe('pending');

    const update = await request(`/incidents/incident-zc-demo/dispatch-tasks/${created.dispatchTask.dispatchTaskId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-user-1001', status: 'en_route' }),
    });
    expect(update.status).toBe(200);
    expect(DispatchTaskResponseSchema.parse(await update.json()).dispatchTask.status).toBe('en_route');

    const list = DispatchTaskListResponseSchema.parse(await (await request('/incidents/incident-zc-demo/dispatch-tasks')).json());
    expect(list.dispatchTasks[0]).toMatchObject({ status: 'en_route', category: 'water' });
  });

  it('sync push creates and updates dispatch tasks idempotently', async () => {
    const createOperation = {
      ...createSignedOperationFixture({
        opId: 'op-dispatch-create-1',
        incidentId: 'incident-zc-demo',
        cellId: 'cell-zc-demo',
        entityId: 'dt-mobile-water-1',
        entityType: 'dispatch_event',
        opType: 'dispatch_event.create',
        payload: { category: 'water', quantityApprox: '5 boxes' },
      }),
      syncState: 'pending',
    };
    const first = await request('/sync/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operations: [createOperation] }) });
    const duplicate = await request('/sync/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operations: [createOperation] }) });
    expect(SyncPushResponseSchema.parse(await first.json()).results[0]).toMatchObject({ status: 'accepted' });
    expect(SyncPushResponseSchema.parse(await duplicate.json()).results[0]).toMatchObject({ status: 'accepted' });

    const conflict = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operations: [{
          ...createOperation,
          opId: 'op-dispatch-create-conflict-1',
          payload: { category: 'medical', quantityApprox: '12 kits' },
        }],
      }),
    });
    expect(SyncPushResponseSchema.parse(await conflict.json()).results[0]).toMatchObject({
      opId: 'op-dispatch-create-conflict-1',
      status: 'rejected',
      code: 'operation_conflict',
    });

    const rejectedOperation = await (env as Env).DB.prepare('SELECT status FROM sync_operations WHERE op_id = ?')
      .bind('op-dispatch-create-conflict-1')
      .first<{ status: string }>();
    expect(rejectedOperation?.status).toBe('rejected');

    const eventCount = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM dispatch_events WHERE dispatch_task_id = ?')
      .bind('dt-mobile-water-1')
      .first<{ count: number }>();
    expect(eventCount?.count).toBe(1);

    const update = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operations: [{ ...createOperation, opId: 'op-dispatch-update-1', entityId: 'dt-mobile-water-1', opType: 'dispatch_event.update', payload: { dispatchTaskId: 'dt-mobile-water-1', status: 'delivered' } }] }),
    });
    expect(SyncPushResponseSchema.parse(await update.json()).results[0]).toMatchObject({ status: 'accepted' });
    const list = DispatchTaskListResponseSchema.parse(await (await request('/incidents/incident-zc-demo/dispatch-tasks')).json());
    expect(list.dispatchTasks[0]?.status).toBe('delivered');
  });

  it('creates connected SOS alerts for joined identities and queues observable fan-out only', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    const response = await request('/incidents/incident-zc-demo/sos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramSosCreateRequestFixture),
    });

    expect(response.status).toBe(200);
    const body = SosAlertCreateResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      sosAlert: { severity: 'critical', status: 'open', sourceChannel: 'telegram' },
      fanout: { total: 3, queued: 3, pending: 0, failed: 0, cancelled: 0 },
      idempotent: false,
    });

    const list = SosAlertStatusResponseSchema.parse(await (await request('/incidents/incident-zc-demo/sos')).json());
    expect(list.sosAlerts[0]).toMatchObject({ sosAlertId: body.sosAlert.sosAlertId, status: 'open' });
    expect(list.fanout).toMatchObject({ total: 3, queued: 3 });
  });

  it('allows the seeded Web UI demo membership to create connected SOS alerts', async () => {
    const response = await request('/incidents/incident-zc-demo/sos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'web-ui',
        externalId: 'web-user-1001',
        displayName: 'Field Web',
        payload: { severity: 'critical', reportedAt: '2026-06-30T11:00:00.000Z' },
      }),
    });

    expect(response.status).toBe(200);
    const body = SosAlertCreateResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      sosAlert: { sourceChannel: 'web-ui', severity: 'critical', status: 'open' },
      fanout: { total: 3, queued: 3 },
      idempotent: false,
    });
  });

  it('drives Telegram webhook /sos through persisted state and exact confirmation', async () => {
    const telegramUserId = 27001;
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...telegramIncidentJoinRequestFixture,
        externalId: String(telegramUserId),
        displayName: 'SOS Reporter',
      }),
    });

    await expect(postTelegramMessage(telegramUserId, '/sos', 'SOS')).resolves.toMatchObject({
      accepted: true,
      command: '/sos',
      responseText: expect.stringContaining('Choose an incident before starting SOS'),
    });

    const stateKey = `flow:sos:chat:${telegramUserId}:from:${telegramUserId}`;
    await expect(
      (env as Env).DB.prepare('SELECT step FROM telegram_conversation_states WHERE state_key = ?').bind(stateKey).first<{ step: string }>(),
    ).resolves.toMatchObject({ step: 'awaitingIncident' });

    await expect(postTelegramMessage(telegramUserId, '1', 'SOS')).resolves.toMatchObject({
      responseText: expect.stringContaining('Reply exactly CONFIRM SOS'),
    });

    const persisted = await (env as Env).DB.prepare('SELECT state_json AS stateJson FROM telegram_conversation_states WHERE state_key = ?')
      .bind(stateKey)
      .first<{ stateJson: string }>();
    const persistedRequest = JSON.parse(persisted?.stateJson ?? '{}') as { request?: { payload?: { reportedAt?: string } } };
    expect(persistedRequest.request?.payload?.reportedAt).toEqual(expect.any(String));

    const created = await postTelegramMessage(telegramUserId, 'CONFIRM SOS', 'SOS');
    expect(created).toMatchObject({
      accepted: true,
      responseText: expect.stringContaining('Backend recording confirmed only'),
    });

    await expect(
      (env as Env).DB.prepare('SELECT step FROM telegram_conversation_states WHERE state_key = ?').bind(stateKey).first<{ step: string }>(),
    ).resolves.toBeNull();

    const list = SosAlertStatusResponseSchema.parse(await (await request('/incidents/incident-zc-demo/sos')).json());
    expect(list.sosAlerts).toHaveLength(1);
    expect(list.sosAlerts[0]).toMatchObject({ sourceChannel: 'telegram', status: 'open' });
    expect(list.fanout).toMatchObject({ total: 3, queued: 3 });
  });

  it('rejects connected SOS invalid payloads, missing incidents and non-members', async () => {
    const invalid = await request('/incidents/incident-zc-demo/sos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramSosCreateRequestFixture, payload: { severity: 'handled' } }),
    });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ error: 'invalid_payload' });

    const missing = await request('/incidents/missing-incident/sos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramSosCreateRequestFixture),
    });
    expect(missing.status).toBe(404);

    const denied = await request('/incidents/incident-zc-demo/sos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramSosCreateRequestFixture),
    });
    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({ error: 'permission_denied' });
  });

  it('sync push materializes SOS create/cancel with idempotency, conflicts and persistent fan-out', async () => {
    const first = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileSosCreateSyncPushFixture),
    });
    const duplicate = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileSosCreateSyncPushFixture),
    });
    const sameOpConflict = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operations: [{
          ...validSosCreateOperationFixture,
          payload: { ...validSosCreateOperationFixture.payload, message: 'Changed critical details' },
        }],
      }),
    });
    const entityConflict = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operations: [{
          ...validSosCreateOperationFixture,
          opId: 'op-sos-create-conflict-entity',
        }],
      }),
    });
    const invalidPayload = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operations: [{ ...validSosCreateOperationFixture, opId: 'op-sos-invalid', entityId: 'sos-invalid', payload: { severity: 'handled' } }] }),
    });
    const cancel = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileSosCancelSyncPushFixture),
    });

    expect(SyncPushResponseSchema.parse(await first.json()).results[0]).toMatchObject({ opId: 'op-sos-create-1', status: 'accepted' });
    expect(SyncPushResponseSchema.parse(await duplicate.json()).results[0]).toMatchObject({ opId: 'op-sos-create-1', status: 'accepted' });
    expect(SyncPushResponseSchema.parse(await sameOpConflict.json()).results[0]).toMatchObject({ opId: 'op-sos-create-1', status: 'rejected', code: 'operation_conflict' });
    expect(SyncPushResponseSchema.parse(await entityConflict.json()).results[0]).toMatchObject({ opId: 'op-sos-create-conflict-entity', status: 'rejected', code: 'operation_conflict' });
    expect(SyncPushResponseSchema.parse(await invalidPayload.json()).results[0]).toMatchObject({ opId: 'op-sos-invalid', status: 'rejected', code: 'invalid_payload' });
    expect(SyncPushResponseSchema.parse(await cancel.json()).results[0]).toMatchObject({ opId: 'op-sos-cancel-1', status: 'accepted' });

    const list = SosAlertStatusResponseSchema.parse(await (await request('/incidents/incident-zc-demo/sos')).json());
    expect(list.sosAlerts).toHaveLength(1);
    expect(list.sosAlerts[0]).toMatchObject({ sosAlertId: 'sos-mobile-critical-1', status: 'cancelled', cancelReason: 'false alarm' });
    expect(list.fanout).toMatchObject({ total: 6, queued: 3, cancelled: 3 });
  });

  it('rejects SOS cancel sync for missing alerts without accepting false backend state', async () => {
    const response = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileSosCancelSyncPushFixture),
    });

    expect(SyncPushResponseSchema.parse(await response.json()).results[0]).toMatchObject({
      opId: 'op-sos-cancel-1',
      status: 'rejected',
      code: 'not_found',
    });
  });

  it('drives Telegram webhook /resource through persisted state and clears terminal state', async () => {
    const telegramUserId = 26001;
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...telegramIncidentJoinRequestFixture,
        externalId: String(telegramUserId),
        displayName: 'Resource Reporter',
      }),
    });

    await expect(postTelegramMessage(telegramUserId, '/resource', 'Resource')).resolves.toMatchObject({
      accepted: true,
      command: '/resource',
      responseText: expect.stringContaining('Choose an incident before reporting resources'),
    });

    const stateKey = `flow:resource:chat:${telegramUserId}:from:${telegramUserId}`;
    await expect(
      (env as Env).DB.prepare('SELECT step FROM telegram_conversation_states WHERE state_key = ?').bind(stateKey).first<{ step: string }>(),
    ).resolves.toMatchObject({ step: 'awaitingIncident' });

    await expect(postTelegramMessage(telegramUserId, '1', 'Resource')).resolves.toMatchObject({ responseText: expect.stringContaining('needed or surplus') });
    await expect(postTelegramMessage(telegramUserId, 'needed', 'Resource')).resolves.toMatchObject({ responseText: expect.stringContaining('resource category') });
    await expect(postTelegramMessage(telegramUserId, 'water', 'Resource')).resolves.toMatchObject({ responseText: expect.stringContaining('approximate quantity') });
    await expect(postTelegramMessage(telegramUserId, '20 boxes', 'Resource')).resolves.toMatchObject({ responseText: expect.stringContaining('urgency') });
    await expect(postTelegramMessage(telegramUserId, 'high', 'Resource')).resolves.toMatchObject({ responseText: expect.stringContaining('optional restrictions') });
    await expect(postTelegramMessage(telegramUserId, 'sealed', 'Resource')).resolves.toMatchObject({ responseText: expect.stringContaining('work center id') });
    await expect(postTelegramMessage(telegramUserId, 'skip', 'Resource')).resolves.toMatchObject({ responseText: expect.stringContaining('Confirm resource report') });

    const created = await postTelegramMessage(telegramUserId, 'yes', 'Resource');
    expect(created).toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Resource needed reported: water (20 boxes).'),
    });

    const list = ResourceReportListResponseSchema.parse(await (await request('/incidents/incident-zc-demo/resource-reports')).json());
    expect(list.resourceReports[0]).toMatchObject({ category: 'water', reportKind: 'needed', sourceChannel: 'telegram' });

    const terminalState = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key = ?')
      .bind(stateKey)
      .first<{ count: number }>();
    expect(terminalState?.count).toBe(0);
  });

  it('drives Telegram webhook /dispatch through persisted state and clears terminal state', async () => {
    const telegramUserId = 26002;
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...telegramIncidentJoinRequestFixture,
        externalId: String(telegramUserId),
        displayName: 'Dispatch Reporter',
      }),
    });

    const create = await request('/incidents/incident-zc-demo/dispatch-tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        externalId: String(telegramUserId),
        payload: { category: 'water', quantityApprox: '10 boxes', notes: 'North gate' },
      }),
    });
    const task = DispatchTaskResponseSchema.parse(await create.json()).dispatchTask;

    await expect(postTelegramMessage(telegramUserId, '/dispatch', 'Dispatch')).resolves.toMatchObject({
      accepted: true,
      command: '/dispatch',
      responseText: expect.stringContaining('Choose an incident before updating dispatch tasks'),
    });

    const stateKey = `flow:dispatch:chat:${telegramUserId}:from:${telegramUserId}`;
    await expect(
      (env as Env).DB.prepare('SELECT step FROM telegram_conversation_states WHERE state_key = ?').bind(stateKey).first<{ step: string }>(),
    ).resolves.toMatchObject({ step: 'awaitingIncident' });

    await expect(postTelegramMessage(telegramUserId, '1', 'Dispatch')).resolves.toMatchObject({ responseText: expect.stringContaining('Choose a dispatch task') });
    await expect(postTelegramMessage(telegramUserId, '1', 'Dispatch')).resolves.toMatchObject({ responseText: expect.stringContaining('new status') });
    await expect(postTelegramMessage(telegramUserId, 'en_route', 'Dispatch')).resolves.toMatchObject({ responseText: expect.stringContaining('Confirm dispatch task update') });

    const updated = await postTelegramMessage(telegramUserId, 'yes', 'Dispatch');
    expect(updated).toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining(`Dispatch task updated: ${task.dispatchTaskId}.`),
    });

    const list = DispatchTaskListResponseSchema.parse(await (await request('/incidents/incident-zc-demo/dispatch-tasks')).json());
    expect(list.dispatchTasks[0]).toMatchObject({ dispatchTaskId: task.dispatchTaskId, status: 'en_route' });

    const terminalState = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key = ?')
      .bind(stateKey)
      .first<{ count: number }>();
    expect(terminalState?.count).toBe(0);
  });

  it('prevents explicit Telegram commands from being hijacked by sibling flow state', async () => {
    const telegramUserId = 26003;

    await postTelegramMessage(telegramUserId, '/resource', 'NoHijack');
    await expect(
      (env as Env).DB.prepare('SELECT step FROM telegram_conversation_states WHERE state_key = ?')
        .bind(`flow:resource:chat:${telegramUserId}:from:${telegramUserId}`)
        .first<{ step: string }>(),
    ).resolves.toMatchObject({ step: 'awaitingIncident' });

    await expect(postTelegramMessage(telegramUserId, '/workcenter', 'NoHijack')).resolves.toMatchObject({
      command: '/workcenter',
      responseText: expect.stringContaining('Choose an incident before reporting a work center'),
    });
    await expect(
      (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key = ?')
        .bind(`flow:resource:chat:${telegramUserId}:from:${telegramUserId}`)
        .first<{ count: number }>(),
    ).resolves.toMatchObject({ count: 0 });

    await expect(postTelegramMessage(telegramUserId, '/dispatch', 'NoHijack')).resolves.toMatchObject({
      command: '/dispatch',
      responseText: expect.stringContaining('Choose an incident before updating dispatch tasks'),
    });
    await expect(
      (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key = ?')
        .bind(`flow:workcenter:chat:${telegramUserId}:from:${telegramUserId}`)
        .first<{ count: number }>(),
    ).resolves.toMatchObject({ count: 0 });

    await expect(postTelegramMessage(telegramUserId, '/start', 'NoHijack')).resolves.toMatchObject({
      command: '/start',
      responseText: expect.stringContaining('Choose an incident'),
    });
    await expect(
      (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key LIKE ?')
        .bind(`flow:%:chat:${telegramUserId}:from:${telegramUserId}`)
        .first<{ count: number }>(),
    ).resolves.toMatchObject({ count: 0 });
  });

});

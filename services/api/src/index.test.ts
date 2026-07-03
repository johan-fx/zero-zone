import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSignedOperationFixture,
  incompatibleVersionSyncPushRequestFixture,
  mobileWorkCenterCreateSyncPushFixture,
  mobileSosCancelSyncPushFixture,
  mobileSosCreateSyncPushFixture,
  mobileIncidentJoinRequestFixture,
  privateFamilyReunificationIssueRequestFixture,
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
  OperationalEventSchema,
  FamilyReunificationSearchResponseSchema,
  PrivateWebLinkConsumeResponseSchema,
  PrivateWebLinkIssueResponseSchema,
  PrivateWebLinkValidateResponseSchema,
  ResourceReportCreateResponseSchema,
  ResourceReportListResponseSchema,
  ResourceReportMatchResponseSchema,
  SosAlertCreateResponseSchema,
  SosAlertStatusResponseSchema,
  SyncPullResponseSchema,
  SyncPushResponseSchema,
  TelegramWebhookResultSchema,
  WorkCenterCreateResponseSchema,
  WorkCenterDetailResponseSchema,
  WorkCenterListResponseSchema,
} from '@zona-cero/contracts';
import { app, recommendTelegramResourceNeeds } from './index';
import { resetApiTestDatabase } from './test-support';

async function request(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await app.fetch(new Request(`http://local.test${path}`, init), env as Env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function postTelegramMessage(
  telegramUserId: number,
  text: string,
  firstName = 'Webhook',
  languageCode = 'en',
): Promise<ReturnType<typeof TelegramWebhookResultSchema.parse>> {
  const response = await request('/telegram/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      update_id: telegramUserId,
      message: {
        message_id: 1,
        text,
        chat: { id: telegramUserId, type: 'private' },
        from: { id: telegramUserId, is_bot: false, first_name: firstName, language_code: languageCode },
      },
    }),
  });

  expect(response.status).toBe(200);
  return TelegramWebhookResultSchema.parse(await response.json());
}

type TelegramIntentClassifierTestEnv = Omit<Env, 'AI'> & {
  AI?: { run: ReturnType<typeof vi.fn> };
  TELEGRAM_INTENT_ROUTER_ENABLED?: string;
  TELEGRAM_INTENT_MODEL?: string;
  TELEGRAM_INTENT_CONFIDENCE_THRESHOLD?: string;
};

function resetTelegramIntentClassifierTestEnv(): void {
  const testEnv = env as unknown as TelegramIntentClassifierTestEnv;
  testEnv.TELEGRAM_INTENT_ROUTER_ENABLED = 'off';
  testEnv.TELEGRAM_INTENT_MODEL = undefined;
  testEnv.TELEGRAM_INTENT_CONFIDENCE_THRESHOLD = undefined;
  testEnv.AI = { run: vi.fn() };
}

function enableTelegramIntentClassifier(run: ReturnType<typeof vi.fn> = vi.fn()): ReturnType<typeof vi.fn> {
  const testEnv = env as unknown as TelegramIntentClassifierTestEnv;
  testEnv.TELEGRAM_INTENT_ROUTER_ENABLED = 'on';
  testEnv.TELEGRAM_INTENT_CONFIDENCE_THRESHOLD = '0.75';
  testEnv.AI = { run };
  return run;
}

async function seedTelegramFreshnessChange(opId: string, serverUpdatedAt: string): Promise<void> {
  const operation = {
    ...validWorkCenterCreateOperationFixture,
    opId,
    entityId: `${opId}-entity`,
    cellId: 'cell-zc-demo',
    payload: { ...validWorkCenterCreateOperationFixture.payload, name: `${opId} center` },
  };

  await (env as Env).DB.prepare(
    `INSERT INTO sync_change_log (
       incident_id, cell_id, op_id, entity_id, entity_type, op_type, operation_json, server_version, server_updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      operation.incidentId,
      operation.cellId,
      operation.opId,
      operation.entityId,
      operation.entityType,
      operation.opType,
      JSON.stringify({ ...operation, syncState: 'confirmed' }),
      1,
      serverUpdatedAt,
    )
    .run();
}

async function seedTelegramFreshnessConflict(opId: string): Promise<void> {
  const operation = { ...validWorkCenterCreateOperationFixture, opId, entityId: `${opId}-entity`, cellId: 'cell-zc-demo' };

  await (env as Env).DB.prepare(
    `INSERT INTO sync_operations (
       op_id, incident_id, cell_id, entity_id, entity_type, op_type, version, payload_hash, payload_json,
       status, result_entity_id, server_version, server_updated_at, conflict_code, conflict_message
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      operation.opId,
      operation.incidentId,
      operation.cellId,
      operation.entityId,
      operation.entityType,
      operation.opType,
      operation.version,
      'telegram-conflict-payload-hash',
      JSON.stringify(operation),
      'rejected',
      operation.entityId,
      null,
      null,
      'operation_conflict',
      'telegram freshness conflict fixture',
    )
    .run();
}


async function issueFamilyReunificationLink(overrides: Record<string, unknown> = {}): Promise<ReturnType<typeof PrivateWebLinkIssueResponseSchema.parse>> {
  const response = await request('/incidents/incident-zc-demo/private-links', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...privateFamilyReunificationIssueRequestFixture, ...overrides }),
  });

  expect(response.status).toBe(200);
  return PrivateWebLinkIssueResponseSchema.parse(await response.json());
}

function mockOperationalAuditInsertFailure(): ReturnType<typeof vi.spyOn> {
  const db = (env as Env).DB;
  const originalPrepare = db.prepare.bind(db);

  return vi.spyOn(db, 'prepare').mockImplementation((query: string) => {
    const statement = originalPrepare(query);
    if (!query.includes('INSERT INTO operational_audit_events')) {
      return statement;
    }

    return new Proxy(statement, {
      get(target, property, receiver) {
        if (property !== 'bind') {
          return Reflect.get(target, property, receiver);
        }

        return (...values: unknown[]) => {
          const bound = target.bind(...values);
          return new Proxy(bound, {
            get(boundTarget, boundProperty, boundReceiver) {
              if (boundProperty === 'run') {
                return async () => {
                  throw new Error('operational audit unavailable');
                };
              }

              return Reflect.get(boundTarget, boundProperty, boundReceiver);
            },
          });
        };
      },
    });
  });
}

describe('api worker', () => {
  beforeEach(async () => {
    resetTelegramIntentClassifierTestEnv();
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

    const body = SyncPushResponseSchema.parse(await response.json());
    expect(body.results[0]).toMatchObject({ opId: 'op-api-1', status: 'accepted', entityId: 'incident-fixture' });
    expect(body.results[0]?.status === 'accepted' ? body.results[0].serverVersion : null).toEqual(expect.any(Number));
  });

  it('materializes work center create operations from sync push', async () => {
    const response = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
    });

    expect(response.status).toBe(200);
    const body = SyncPushResponseSchema.parse(await response.json());
    expect(body.results[0]).toMatchObject({ opId: 'op-work-center-create-1', status: 'accepted', entityId: 'center-north-triage' });
    expect(body.results[0]?.status === 'accepted' ? body.results[0].serverVersion : null).toEqual(expect.any(Number));

    const list = WorkCenterListResponseSchema.parse(await (await request('/incidents/incident-zc-demo/work-centers')).json());
    expect(list.workCenters).toHaveLength(1);
    expect(list.workCenters[0]).toMatchObject({
      workCenterId: 'center-north-triage',
      activationState: 'pending_corroboration',
      status: 'reported',
      confidence: 'low',
    });

    const detail = WorkCenterDetailResponseSchema.parse(await (await request('/incidents/incident-zc-demo/work-centers/center-north-triage')).json());
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
    expect(list.workCenters[0]).toMatchObject({ workCenterId: 'center-north-triage', freshness: 'stale', risk: 'medium', updatedAt: oldUpdatedAt });

    const detail = WorkCenterDetailResponseSchema.parse(await (await request('/incidents/incident-zc-demo/work-centers/center-north-triage')).json());
    expect(detail.workCenter).toMatchObject({ workCenterId: 'center-north-triage', freshness: 'stale', risk: 'medium', updatedAt: oldUpdatedAt });

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
        operations: [{ ...validWorkCenterCreateOperationFixture, payload: { ...validWorkCenterCreateOperationFixture.payload, name: 'Changed center name' } }],
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

  it('does not block scoped sync push when rate-limit operational audit persistence fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prepareSpy = mockOperationalAuditInsertFailure();
    try {
      const response = await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
      });

      expect(response.status).toBe(200);
      expect(SyncPushResponseSchema.parse(await response.json()).results[0]).toMatchObject({ status: 'accepted' });
    } finally {
      prepareSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('uses scoped sync push as source of truth with idempotent metadata and scoped conflict results', async () => {
    const first = await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
    });
    const duplicate = await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
    });
    const conflict = await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operations: [{ ...validWorkCenterCreateOperationFixture, payload: { ...validWorkCenterCreateOperationFixture.payload, name: 'Changed center name' } }],
      }),
    });

    const firstBody = SyncPushResponseSchema.parse(await first.json());
    const duplicateBody = SyncPushResponseSchema.parse(await duplicate.json());
    const conflictBody = SyncPushResponseSchema.parse(await conflict.json());
    expect(firstBody.results[0]).toMatchObject({ status: 'accepted', entityId: 'center-north-triage' });
    expect(firstBody.results[0]?.status === 'accepted' ? firstBody.results[0].serverVersion : null).toEqual(expect.any(Number));
    expect(duplicateBody.results[0]).toEqual(firstBody.results[0]);
    expect(conflictBody.results[0]).toMatchObject({
      status: 'rejected',
      code: 'operation_conflict',
      conflict: { code: 'operation_conflict', entityId: 'center-north-triage' },
    });

    const materialized = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM work_centers WHERE work_center_id = ?')
      .bind('center-north-triage')
      .first<{ count: number }>();
    const changeLog = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM sync_change_log WHERE op_id = ?')
      .bind('op-work-center-create-1')
      .first<{ count: number }>();
    expect(materialized?.count).toBe(1);
    expect(changeLog?.count).toBe(1);
  });

  it('rejects scoped sync push operations that do not match the endpoint scope', async () => {
    const response = await request('/incidents/incident-zc-demo/cells/cell-other/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
    });

    expect(response.status).toBe(200);
    expect(SyncPushResponseSchema.parse(await response.json()).results[0]).toMatchObject({
      opId: 'op-work-center-create-1',
      status: 'rejected',
      code: 'scope_mismatch',
      conflict: { code: 'scope_mismatch', entityId: 'center-north-triage' },
    });
  });

  it('paginates scoped sync pull with cursor freshness and does not leak across cells', async () => {
    await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
    });
    await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileSosCreateSyncPushFixture),
    });

    const firstPage = SyncPullResponseSchema.parse(await (await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull?limit=1')).json());
    expect(firstPage.operations).toHaveLength(1);
    expect(firstPage.operations[0]?.sequence).toEqual(expect.any(Number));
    expect(firstPage.operations[0]?.serverVersion).toBe(firstPage.operations[0]?.sequence);
    expect(firstPage.operations[0]?.operation.syncState).toBe('confirmed');
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.freshness).toMatchObject({ status: 'stale', cursorLag: 1, hasConflicts: false });
    expect(firstPage.cursor).toEqual(expect.any(String));

    const secondPage = SyncPullResponseSchema.parse(
      await (await request(`/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull?limit=10&cursor=${encodeURIComponent(firstPage.cursor ?? '')}`)).json(),
    );
    expect(secondPage.operations).toHaveLength(1);
    expect(secondPage.operations[0]?.sequence).toBeGreaterThan(firstPage.operations[0]?.sequence ?? 0);
    expect(secondPage.operations[0]?.serverVersion).toBe(secondPage.operations[0]?.sequence);
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.freshness).toMatchObject({ cursorLag: 0 });

    const otherCell = SyncPullResponseSchema.parse(await (await request('/incidents/incident-zc-demo/cells/cell-other/sync/pull?limit=10')).json());
    expect(otherCell.operations).toEqual([]);
    expect(otherCell.freshness).toMatchObject({ status: 'missing', cursorLag: 0 });
  });

  it('rejects invalid and forged scoped sync pull cursors', async () => {
    const invalid = await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull?cursor=not-a-cursor');
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({ error: 'stale_cursor' });

    await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileWorkCenterCreateSyncPushFixture),
    });
    const firstPage = SyncPullResponseSchema.parse(await (await request('/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull?limit=1')).json());
    const forged = await request(`/incidents/incident-zc-demo/cells/cell-other/sync/pull?cursor=${encodeURIComponent(firstPage.cursor ?? '')}`);
    expect(forged.status).toBe(400);
    await expect(forged.json()).resolves.toMatchObject({ error: 'scope_mismatch' });
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

  it('accepts Telegram webhook requests with a valid secret token', async () => {
    const mutableEnv = env as Env;
    const previousSecret = mutableEnv.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    mutableEnv.TELEGRAM_WEBHOOK_SECRET_TOKEN = 'test-webhook-secret';
    try {
      const response = await request('/telegram/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'test-webhook-secret' },
        body: JSON.stringify(telegramStartUpdateFixture),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ accepted: true, command: '/start', responseText: expect.stringContaining('Choose an incident') });
    } finally {
      mutableEnv.TELEGRAM_WEBHOOK_SECRET_TOKEN = previousSecret;
    }
  });

  it('rejects Telegram webhook requests with missing or invalid secret tokens before processing updates', async () => {
    const mutableEnv = env as Env;
    const previousSecret = mutableEnv.TELEGRAM_WEBHOOK_SECRET_TOKEN;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mutableEnv.TELEGRAM_WEBHOOK_SECRET_TOKEN = 'test-webhook-secret';
    try {
      const missing = await request('/telegram/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(telegramStartUpdateFixture),
      });
      const invalid = await request('/telegram/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'wrong-secret' },
        body: JSON.stringify(telegramStartUpdateFixture),
      });

      expect(missing.status).toBe(403);
      expect(invalid.status).toBe(403);
      await expect(missing.json()).resolves.toEqual({ error: 'permission_denied' });
      await expect(invalid.json()).resolves.toEqual({ error: 'permission_denied' });
      expect(logSpy.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain('telegram.incident_join');

      const state = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states').first<{ count: number }>();
      expect(state?.count).toBe(0);
    } finally {
      logSpy.mockRestore();
      mutableEnv.TELEGRAM_WEBHOOK_SECRET_TOKEN = previousSecret;
    }
  });

  it('sends Telegram webhook responseText to the originating chat when bot token is configured', async () => {
    const mutableEnv = env as Env;
    const previousToken = mutableEnv.TELEGRAM_BOT_TOKEN;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    mutableEnv.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    try {
      const response = await request('/telegram/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(telegramStartUpdateFixture),
      });

      expect(response.status).toBe(200);
      const body = TelegramWebhookResultSchema.parse(await response.json());
      expect(body.responseText).toContain('Choose an incident');
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.telegram.org/bottest-bot-token/sendMessage');
      expect(init.method).toBe('POST');
      expect(JSON.parse(String(init.body))).toEqual({ chat_id: telegramStartUpdateFixture.message.chat.id, text: body.responseText });
    } finally {
      fetchSpy.mockRestore();
      mutableEnv.TELEGRAM_BOT_TOKEN = previousToken;
    }
  });

  it('keeps Telegram webhook 200 contract and emits operational telemetry when bot token is missing', async () => {
    const mutableEnv = env as Env;
    const previousToken = mutableEnv.TELEGRAM_BOT_TOKEN;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mutableEnv.TELEGRAM_BOT_TOKEN = undefined;
    try {
      const response = await request('/telegram/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(telegramStartUpdateFixture),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ accepted: true, command: '/start', responseText: expect.stringContaining('Choose an incident') });
      const logs = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logs).toContain('sendMessage.not_configured');
      expect(logs).not.toMatch(/24001|Webhook|chat|from|text|token|fingerprint/i);
    } finally {
      logSpy.mockRestore();
      mutableEnv.TELEGRAM_BOT_TOKEN = previousToken;
    }
  });

  it('keeps Telegram webhook 200 contract when Bot API sendMessage fails', async () => {
    const mutableEnv = env as Env;
    const previousToken = mutableEnv.TELEGRAM_BOT_TOKEN;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('telegram unavailable'));
    mutableEnv.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    try {
      const response = await request('/telegram/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(telegramStartUpdateFixture),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ accepted: true, command: '/start', responseText: expect.stringContaining('Choose an incident') });
    } finally {
      fetchSpy.mockRestore();
      mutableEnv.TELEGRAM_BOT_TOKEN = previousToken;
    }
  });

  it('emits structured Telegram channel telemetry from the real webhook path', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const response = await request('/telegram/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(telegramStartUpdateFixture),
      });

      expect(response.status).toBe(200);
      await response.json();
      await Promise.resolve();
      await Promise.resolve();

      const events = logSpy.mock.calls
        .map(([entry]) => {
          if (typeof entry !== 'string') return null;
          try {
            return OperationalEventSchema.safeParse(JSON.parse(entry));
          } catch {
            return null;
          }
        })
        .filter((result): result is { success: true; data: ReturnType<typeof OperationalEventSchema.parse> } => result?.success === true)
        .map((result) => result.data);

      expect(events).toContainEqual(
        expect.objectContaining({
          event: 'operation.processed',
          category: 'sync',
          result: 'accepted',
          channel: 'telegram',
          scope: 'telegram.incident_join',
          action: 'idle->awaitingIncident',
          errorCode: null,
          sampled: true,
        }),
      );
      expect(logSpy.mock.calls.map((call) => call.join(' ')).join('\n')).not.toMatch(/24001|Webhook|chat|from|text|token|fingerprint/i);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('drives Telegram webhook updates through the real incident join flow', async () => {
    const telegramUserId = 24001;
    const baseUpdate = {
      update_id: 24001,
      message: { message_id: 1, chat: { id: telegramUserId, type: 'private' }, from: { id: telegramUserId, is_bot: false, first_name: 'Webhook', language_code: 'en' } },
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

    await expect(postTelegramMessage('1')).resolves.toMatchObject({ accepted: true, command: null, responseText: expect.stringContaining('What pseudonym') });

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
    expect(joined).toMatchObject({ accepted: true, command: null, responseText: expect.stringContaining('Joined Zona Cero Demo Incident as volunteer.') });

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
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: String(telegramUserId), displayName: 'Work Center Reporter' }),
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
    expect(created).toMatchObject({ accepted: true, command: null, responseText: expect.stringContaining('Work center reported: Telegram staging center.') });

    const workCenterId = `wc_incident-zc-demo_telegram_${telegramUserId}_Telegram-staging-center`;
    const detail = WorkCenterDetailResponseSchema.parse(await (await request(`/incidents/incident-zc-demo/work-centers/${workCenterId}`)).json());
    expect(detail.workCenter).toMatchObject({ workCenterId, name: 'Telegram staging center', sourceChannel: 'telegram', signalCount: 1 });

    const terminalState = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key = ?')
      .bind(stateKey)
      .first<{ count: number }>();
    expect(terminalState?.count).toBe(0);
  });

  it('does not call the Telegram intent classifier for explicit /resource commands', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({ intent: 'workcenter', confidence: 0.99, extractedFacts: {} }),
    );

    await expect(postTelegramMessage(25201, '/resource', 'Explicit')).resolves.toMatchObject({
      accepted: true,
      command: '/resource',
      responseText: expect.stringContaining('Choose an incident before reporting resources'),
    });
    expect(classifier).not.toHaveBeenCalled();
  });

  it('continues active Telegram flow state without calling the intent classifier', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({ intent: 'workcenter', confidence: 0.99, extractedFacts: {} }),
    );
    const telegramUserId = 25202;

    await postTelegramMessage(telegramUserId, '/resource', 'ActiveFlow');
    expect(classifier).not.toHaveBeenCalled();

    await expect(postTelegramMessage(telegramUserId, '1', 'ActiveFlow')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Is this resource needed or surplus'),
    });
    expect(classifier).not.toHaveBeenCalled();
  });

  it('routes natural potable water messages to the resource conversation with safe extracted-fact context', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'resource',
        confidence: 0.92,
        extractedFacts: {
          resourceDirection: 'offer',
          resourceType: 'water',
          resourceLabel: 'agua potable',
          implicitQuestion: 'where_needed',
        },
      }),
    );
    const telegramUserId = 25203;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const result = await postTelegramMessage(telegramUserId, 'tengo agua potable, dónde la necesitan?', 'Water', 'ca');
      expect(result).toMatchObject({ accepted: true, command: null });
      expect(result.responseText).toContain('agua potable');
      expect(result.responseText).toContain('Te guiaré');
      expect(result.responseText).toContain('No encontré recomendaciones compatibles para este recurso');
      expect(result.responseText).toContain('Elige un incidente:');
      expect(result.responseText).not.toContain('Choose an incident before reporting resources');
      expect(classifier).toHaveBeenCalledTimes(1);
      const logs = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(logs).toContain('classification:resource:confidence_high');
      expect(logs).not.toMatch(/tengo agua potable|agua potable|resourceDirection|where_needed/i);

      const state = await (env as Env).DB.prepare('SELECT step, state_json AS stateJson FROM telegram_conversation_states WHERE state_key = ?')
        .bind(`flow:resource:chat:${telegramUserId}:from:${telegramUserId}`)
        .first<{ step: string; stateJson: string }>();
      expect(state).toMatchObject({ step: 'awaitingIncident' });
      expect(JSON.parse(state?.stateJson ?? '{}')).toMatchObject({ preferredLocale: 'es' });
    } finally {
      logSpy.mockRestore();
    }
  });

  it('routes natural English resource messages with English-only visible text', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'resource',
        confidence: 0.92,
        extractedFacts: {
          resourceDirection: 'offer',
          resourceType: 'medicine',
          resourceLabel: 'medicine',
          implicitQuestion: 'where_needed',
        },
      }),
    );
    const telegramUserId = 25204;

    const result = await postTelegramMessage(telegramUserId, 'I have medicine, where is it needed?', 'Medicine', 'en');
    expect(result).toMatchObject({ accepted: true, command: null });
    expect(result.responseText).toContain('I understand you have medicine available');
    expect(result.responseText).toContain('No compatible recommendations were found for this resource');
    expect(result.responseText).toContain('Choose an incident:');
    expect(result.responseText).not.toContain('Entiendo que tienes');
    expect(result.responseText).not.toContain('Elige un incidente antes de reportar recursos');
    expect(classifier).toHaveBeenCalledTimes(1);
  });

  it('routes natural Spanish resource offers to ranked need recommendations when needs exist', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    const workCenterResponse = await request('/incidents/incident-zc-demo/work-centers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        externalId: 'telegram-user-1001',
        payload: {
          name: 'Medical Tent North',
          priority: 'high',
          initialNeed: 'medicamentos',
          location: { latitude: 40.42, longitude: -3.7 },
        },
      }),
    });
    const workCenter = WorkCenterCreateResponseSchema.parse(await workCenterResponse.json()).workCenter;

    const needed = await request('/incidents/incident-zc-demo/resource-reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        externalId: 'telegram-user-1001',
        payload: {
          category: 'medicina',
          quantityApprox: '10 cajas',
          urgency: 'high',
          constraints: ['sellado'],
          reportKind: 'needed',
          workCenterId: workCenter.workCenterId,
        },
      }),
    });
    expect(needed.status).toBe(200);

    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'resource',
        confidence: 0.94,
        extractedFacts: {
          resourceDirection: 'offer',
          resourceType: 'medicine',
          resourceLabel: 'medicamentos',
          implicitQuestion: 'where_needed',
        },
      }),
    );
    const telegramUserId = 25209;

    const result = await postTelegramMessage(telegramUserId, 'tengo medicamentos, dónde la necesitan?', 'Matcher', 'es');
    expect(result).toMatchObject({ accepted: true, command: null });
    expect(result.responseText).toContain('Entiendo que tienes medicamentos disponibles');
    expect(result.responseText).toContain('Encontré necesidades compatibles para este recurso');
    expect(result.responseText).toContain('Medical Tent North');
    expect(result.responseText).toContain('medicina');
    expect(result.responseText).not.toContain('No encontré recomendaciones compatibles');
    expect(result.responseText).not.toContain('Elige un incidente antes de reportar recursos');
    expect(classifier).toHaveBeenCalledTimes(1);

    const state = await (env as Env).DB.prepare('SELECT step, state_json AS stateJson FROM telegram_conversation_states WHERE state_key = ?')
      .bind(`flow:resource:chat:${telegramUserId}:from:${telegramUserId}`)
      .first<{ step: string; stateJson: string }>();
    expect(state).toMatchObject({ step: 'awaitingRecommendedNeedSelection' });
    expect(JSON.parse(state?.stateJson ?? '{}')).toMatchObject({ preferredLocale: 'es' });
  });

  it('routes natural Spanish resource offers to active work center initial needs without resource reports', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    const workCenterResponse = await request('/incidents/incident-zc-demo/work-centers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        externalId: 'telegram-user-1001',
        payload: {
          name: 'Centro Salud Este',
          priority: 'high',
          initialNeed: 'medicamentos',
          location: { latitude: 40.43, longitude: -3.71 },
        },
      }),
    });
    expect(workCenterResponse.status).toBe(200);
    const workCenter = WorkCenterCreateResponseSchema.parse(await workCenterResponse.json()).workCenter;

    await (env as Env).DB.prepare("UPDATE work_centers SET status = 'active', activation_state = 'active' WHERE work_center_id = ?")
      .bind(workCenter.workCenterId)
      .run();

    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'resource',
        confidence: 0.94,
        extractedFacts: {
          resourceDirection: 'offer',
          resourceType: 'medicine',
          resourceLabel: 'medicamentos',
          implicitQuestion: 'where_needed',
        },
      }),
    );
    const telegramUserId = 25210;

    const result = await postTelegramMessage(telegramUserId, 'tengo medicamentos, dónde la necesitan?', 'CenterOnly', 'es');
    expect(result).toMatchObject({ accepted: true, command: null });
    expect(result.responseText).toContain('Entiendo que tienes medicamentos disponibles');
    expect(result.responseText).toContain('Encontré necesidades compatibles para este recurso');
    expect(result.responseText).toContain('Centro Salud Este');
    expect(result.responseText).toContain('medicamentos');
    expect(result.responseText).toContain('cantidad no especificada');
    expect(result.responseText).not.toContain('medicamentos · medicamentos');
    expect(result.responseText).not.toContain('No encontré recomendaciones compatibles');
    expect(result.responseText).not.toContain('Elige un incidente:');
    expect(classifier).toHaveBeenCalledTimes(1);

    const state = await (env as Env).DB.prepare('SELECT step, state_json AS stateJson FROM telegram_conversation_states WHERE state_key = ?')
      .bind(`flow:resource:chat:${telegramUserId}:from:${telegramUserId}`)
      .first<{ step: string; stateJson: string }>();
    expect(state).toMatchObject({ step: 'awaitingRecommendedNeedSelection' });
    expect(JSON.parse(state?.stateJson ?? '{}').recommendations[0]).toMatchObject({ workCenterName: 'Centro Salud Este' });
  });

  it('clears the Spanish resource flow after permission denied instead of persisting localized error state', async () => {
    const telegramUserId = 25208;

    await expect(postTelegramMessage(telegramUserId, '/resource', 'Denied', 'es')).resolves.toMatchObject({
      responseText: expect.stringContaining('Elige un incidente antes de reportar recursos'),
    });
    await expect(postTelegramMessage(telegramUserId, '1', 'Denied', 'es')).resolves.toMatchObject({
      responseText: expect.stringContaining('necesario o sobrante'),
    });
    await expect(postTelegramMessage(telegramUserId, 'sobrante', 'Denied', 'es')).resolves.toMatchObject({
      responseText: expect.stringContaining('categoría del recurso'),
    });
    await postTelegramMessage(telegramUserId, 'medicamentos', 'Denied', 'es');
    await expect(postTelegramMessage(telegramUserId, '10 cajas', 'Denied', 'es')).resolves.toMatchObject({
      responseText: expect.stringContaining('baja, media, alta o crítica'),
    });
    await postTelegramMessage(telegramUserId, 'alta', 'Denied', 'es');
    await postTelegramMessage(telegramUserId, 'omitir', 'Denied', 'es');
    await postTelegramMessage(telegramUserId, 'omitir', 'Denied', 'es');
    const denied = await postTelegramMessage(telegramUserId, 'sí', 'Denied', 'es');

    expect(denied.responseText).toContain('Permiso denegado');

    const state = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key = ?')
      .bind(`flow:resource:chat:${telegramUserId}:from:${telegramUserId}`)
      .first<{ count: number }>();
    expect(state?.count).toBe(0);
  });

  it('ignores invalid resource extracted facts without creating a resource report', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'resource',
        confidence: 0.93,
        extractedFacts: { resourceDirection: 'offer', resourceType: 'water', resourceLabel: 42, implicitQuestion: 'where_needed' },
      }),
    );
    const telegramUserId = 25207;

    const result = await postTelegramMessage(telegramUserId, 'tengo agua potable, dónde la necesitan?', 'InvalidFacts', 'ca');
    expect(result).toMatchObject({ accepted: true, command: null });
    expect(result.responseText).toContain('No encontré recomendaciones compatibles para este recurso');
    expect(result.responseText).toContain('Elige un incidente:');
    expect(result.responseText).not.toContain('Te guiaré');
    expect(classifier).toHaveBeenCalledTimes(1);

    const reports = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM resource_reports').first<{ count: number }>();
    expect(reports?.count).toBe(0);
  });

  it('routes natural missing child/person messages to family reunification', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'family_reunification',
        confidence: 0.94,
        reason: 'Looking for Lucia, age 8, red jacket, call +34 600 000 000 near north gate.',
        extractedFacts: {
          action: 'search',
          relationshipHint: 'parent',
          urgencyHint: 'urgent',
          fullName: 'Lucia Example',
          age: 8,
          clothing: 'red jacket',
          phone: '+34 600 000 000',
          locationHint: 'north gate',
          caseType: 'missing_person',
          subjectType: 'child',
        },
      }),
    );
    const telegramUserId = 25204;
    const rawMessage = 'Busco a Lucia de 8 años con chaqueta roja cerca de north gate, llamad +34 600 000 000.';

    const result = await postTelegramMessage(telegramUserId, rawMessage, 'Family');
    expect(result).toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('incident-zc-demo'),
    });
    expect(result.responseText).not.toMatch(/Lucia|8 años|chaqueta roja|red jacket|600 000 000|north gate/i);
    expect(classifier).toHaveBeenCalledTimes(1);

    const state = await (env as Env).DB.prepare('SELECT step, state_json AS stateJson FROM telegram_conversation_states WHERE state_key = ?')
      .bind(`flow:family-reunification:chat:${telegramUserId}:from:${telegramUserId}`)
      .first<{ step: string; stateJson: string }>();
    expect(state).toMatchObject({ step: 'awaitingIncident' });
    expect(state?.stateJson).not.toMatch(
      /Lucia|8 años|chaqueta roja|red jacket|600 000 000|north gate|fullName|age|clothing|phone|locationHint|caseType|subjectType|flowContext|facts|prefill|action|relationshipHint|urgencyHint/i,
    );
  });

  it('routes clear workcenter intent with valid facts through typed flow context without creating operations', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'workcenter',
        confidence: 0.93,
        extractedFacts: {
          signal: 'availability',
          status: 'active',
          name: 'puesto médico',
          locationHint: 'escuela norte',
          priority: 'high',
          initialNeed: 'medicamentos',
          surplus: 'mantas',
          implicitQuestion: 'none',
        },
      }),
    );
    const telegramUserId = 25211;
    const beforeWorkCenters = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM work_centers').first<{ count: number }>();

    const result = await postTelegramMessage(telegramUserId, 'north shelter is full but active', 'WorkcenterFacts');
    expect(result).toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Choose an incident before reporting a work center'),
    });
    expect(classifier).toHaveBeenCalledTimes(1);

    const state = await (env as Env).DB.prepare('SELECT step FROM telegram_conversation_states WHERE state_key = ?')
      .bind(`flow:workcenter:chat:${telegramUserId}:from:${telegramUserId}`)
      .first<{ step: string }>();
    expect(state).toMatchObject({ step: 'awaitingIncident' });

    const workCenters = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM work_centers').first<{ count: number }>();
    expect(workCenters?.count).toBe(beforeWorkCenters?.count);
  });

  it('ignores invalid non-resource extracted facts while preserving the clear intent route', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'workcenter',
        confidence: 0.93,
        extractedFacts: { signal: 'capacity', fullName: 'private name' },
      }),
    );
    const telegramUserId = 25212;

    await expect(postTelegramMessage(telegramUserId, 'the north center is full', 'InvalidWorkcenterFacts')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Choose an incident before reporting a work center'),
    });
    expect(classifier).toHaveBeenCalledTimes(1);
  });

  it('routes clear dispatch intent safely when extracted facts are absent', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'dispatch',
        confidence: 0.93,
        extractedFacts: {},
      }),
    );
    const telegramUserId = 25213;

    await expect(postTelegramMessage(telegramUserId, 'update dispatch task status', 'DispatchNoFacts')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Choose an incident before updating dispatch tasks'),
    });
    expect(classifier).toHaveBeenCalledTimes(1);
  });

  it('routes natural SOS messages to SOS context without creating alerts or persisting sensitive facts', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'sos',
        confidence: 0.96,
        extractedFacts: {
          severity: 'medical',
          locationHint: 'refugio norte',
          medicalNeed: 'ayuda médica urgente',
          peopleCount: 3,
          hazardHint: 'humo',
        },
      }),
    );
    const telegramUserId = 25214;
    const rawMessage = 'necesito ayuda médica urgente en el refugio norte, somos 3 y hay humo';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const beforeAlerts = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM sos_alerts').first<{ count: number }>();
      const result = await postTelegramMessage(telegramUserId, rawMessage, 'SosNatural', 'es');

      expect(result).toMatchObject({
        accepted: true,
        command: null,
        responseText: expect.stringContaining('Elige un incidente antes de iniciar SOS'),
      });
      expect(result.responseText).toContain('Resumen seguro detectado');
      expect(result.responseText).toContain('Ubicación aproximada: refugio norte');
      expect(result.responseText).toContain('Necesidad médica: ayuda médica urgente');
      expect(result.responseText).toContain('Personas afectadas: 3');
      expect(result.responseText).toContain('Riesgo: humo');
      expect(classifier).toHaveBeenCalledTimes(1);

      const afterAlerts = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM sos_alerts').first<{ count: number }>();
      expect(afterAlerts?.count).toBe(beforeAlerts?.count);

      const state = await (env as Env).DB.prepare('SELECT step, state_json AS stateJson FROM telegram_conversation_states WHERE state_key = ?')
        .bind(`flow:sos:chat:${telegramUserId}:from:${telegramUserId}`)
        .first<{ step: string; stateJson: string }>();
      expect(state).toMatchObject({ step: 'awaitingIncident' });
      expect(state?.stateJson).not.toMatch(/ayuda médica urgente|refugio norte|humo|medicalNeed|hazardHint|locationHint|peopleCount/i);

      const logs = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(logs).toContain('classification:sos:confidence_high');
      expect(logs).not.toMatch(/ayuda médica urgente|refugio norte|humo|medicalNeed|hazardHint|locationHint|peopleCount/i);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('derives ephemeral SOS facts when the classifier routes SOS without extracted facts', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'sos',
        confidence: 0.94,
        extractedFacts: {},
      }),
    );
    const telegramUserId = 25215;
    const rawMessage = 'necesito ayuda médica urgente en el refugio norte, somos 3 personas afectadas y hay humo';

    const result = await postTelegramMessage(telegramUserId, rawMessage, 'SosFallback', 'es');

    expect(result).toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Elige un incidente antes de iniciar SOS'),
    });
    expect(result.responseText).toContain('Resumen seguro detectado');
    expect(result.responseText).toContain('Ubicación aproximada: refugio norte');
    expect(result.responseText).toContain('Necesidad médica: ayuda médica urgente');
    expect(result.responseText).toContain('Personas afectadas: 3');
    expect(result.responseText).toContain('Riesgo: humo');
    expect(classifier).toHaveBeenCalledTimes(1);

    const state = await (env as Env).DB.prepare('SELECT step, state_json AS stateJson FROM telegram_conversation_states WHERE state_key = ?')
      .bind(`flow:sos:chat:${telegramUserId}:from:${telegramUserId}`)
      .first<{ step: string; stateJson: string }>();
    expect(state).toMatchObject({ step: 'awaitingIncident' });
    expect(state?.stateJson).not.toMatch(/ayuda médica urgente|refugio norte|humo|medicalNeed|hazardHint|locationHint|peopleCount/i);
  });

  it('routes SOS safely when extracted facts are invalid without sensitive prefill', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({
        intent: 'sos',
        confidence: 0.96,
        extractedFacts: {
          severity: 'medical',
          locationHint: 'refugio norte',
          rawText: 'necesito ayuda médica urgente en el refugio norte',
        },
      }),
    );
    const telegramUserId = 25215;

    await expect(postTelegramMessage(telegramUserId, 'necesito ayuda médica urgente en el refugio norte', 'InvalidSosFacts', 'es')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('Elige un incidente antes de iniciar SOS'),
    });
    expect(classifier).toHaveBeenCalledTimes(1);

    const state = await (env as Env).DB.prepare('SELECT step, state_json AS stateJson FROM telegram_conversation_states WHERE state_key = ?')
      .bind(`flow:sos:chat:${telegramUserId}:from:${telegramUserId}`)
      .first<{ step: string; stateJson: string }>();
    expect(state).toMatchObject({ step: 'awaitingIncident' });
    expect(state?.stateJson).not.toMatch(/ayuda médica urgente|refugio norte|rawText|locationHint/i);

    const alerts = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM sos_alerts').first<{ count: number }>();
    expect(alerts?.count).toBe(0);
  });

  it('asks for clarification instead of falling back to incident join on ambiguous or low-confidence intent', async () => {
    const classifier = enableTelegramIntentClassifier(
      vi.fn().mockResolvedValue({ intent: 'resource', confidence: 0.42, extractedFacts: {} }),
    );
    const telegramUserId = 25205;

    await expect(postTelegramMessage(telegramUserId, 'Necesitamos ayuda con esto', 'Ambiguous')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('No estoy seguro de qué operación necesitas'),
    });
    expect(classifier).toHaveBeenCalledTimes(1);

    const state = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key LIKE ?')
      .bind(`%chat:${telegramUserId}:from:${telegramUserId}`)
      .first<{ count: number }>();
    expect(state?.count).toBe(0);
  });

  it('degrades safely when the Telegram intent classifier fails', async () => {
    const classifier = enableTelegramIntentClassifier(vi.fn().mockRejectedValue(new Error('AI unavailable')));
    const telegramUserId = 25206;

    await expect(postTelegramMessage(telegramUserId, 'Quiero reportar algo', 'Failure')).resolves.toMatchObject({
      accepted: true,
      command: null,
      responseText: expect.stringContaining('No estoy seguro de qué operación necesitas'),
    });
    expect(classifier).toHaveBeenCalledTimes(1);

    const state = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM telegram_conversation_states WHERE state_key LIKE ?')
      .bind(`%chat:${telegramUserId}:from:${telegramUserId}`)
      .first<{ count: number }>();
    expect(state?.count).toBe(0);
  });

  [
    { name: 'missing', arrange: async () => {}, expected: 'Channel limitation: backend freshness is missing for this scope.' },
    {
      name: 'stale',
      arrange: async () => seedTelegramFreshnessChange('op-telegram-stale', new Date(Date.now() - 20 * 60 * 1000).toISOString()),
      expected: 'Channel limitation: backend freshness is stale for this scope.',
    },
    {
      name: 'expired',
      arrange: async () => seedTelegramFreshnessChange('op-telegram-expired', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()),
      expected: 'Channel limitation: backend freshness is expired for this scope.',
    },
    {
      name: 'conflict',
      arrange: async () => {
        await seedTelegramFreshnessChange('op-telegram-conflict-base', new Date().toISOString());
        await seedTelegramFreshnessConflict('op-telegram-conflict-rejected');
      },
      expected: 'Channel limitation: backend freshness is stale for this scope.',
      detail: 'sync conflicts need coordinator review',
    },
  ].forEach((testCase, index) => {
    it(`includes ${testCase.name} channel limitation in the real Telegram webhook workcenter flow`, async () => {
      const telegramUserId = 25100 + index;
      await request('/incidents/incident-zc-demo/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: String(telegramUserId), displayName: `Freshness Reporter ${index}` }),
      });
      await testCase.arrange();

      await expect(postTelegramMessage(telegramUserId, '/workcenter', 'Freshness')).resolves.toMatchObject({
        accepted: true,
        command: '/workcenter',
        responseText: expect.stringContaining('Choose an incident before reporting a work center'),
      });

      const selected = await postTelegramMessage(telegramUserId, '1', 'Freshness');
      expect(selected).toMatchObject({ accepted: true, command: null });
      expect(selected.responseText).toContain(testCase.expected);
      if ('detail' in testCase && testCase.detail) {
        expect(selected.responseText).toContain(testCase.detail);
      }
      expect(selected.responseText).toContain('Send the work center name. Use /cancel to stop.');
    });
  });

  it('clears denied /workcenter state so /start incident join replies are not hijacked', async () => {
    const telegramUserId = 25002;

    await postTelegramMessage(telegramUserId, '/workcenter', 'NoMember');
    await postTelegramMessage(telegramUserId, '1', 'NoMember');
    await postTelegramMessage(telegramUserId, 'Unjoined staging center', 'NoMember');

    const denied = await postTelegramMessage(telegramUserId, 'yes', 'NoMember');
    expect(denied).toMatchObject({ accepted: true, command: null, responseText: expect.stringContaining('Permission denied') });
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
    expect(joined).toMatchObject({ accepted: true, command: null, responseText: expect.stringContaining('Joined Zona Cero Demo Incident as volunteer.') });

    const membership = await (env as Env).DB.prepare('SELECT role FROM incident_memberships WHERE incident_id = ? AND channel_identity_id = ?')
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
    await expect(response.json()).resolves.toMatchObject({ accepted: true, command: '/start', responseText: expect.stringContaining('incident-zc-demo') });

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
    await expect(response.json()).resolves.toMatchObject({ accepted: true, command: '/start', responseText: expect.stringContaining('incident-zc-demo') });

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
    await expect(response.json()).resolves.toMatchObject({ accepted: true, command: '/start', responseText: expect.stringContaining('incident-zc-demo') });

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

  it('issues private family reunification links only for incident members', async () => {
    const issued = await issueFamilyReunificationLink();
    expect(issued).toMatchObject({
      scope: 'family_reunification.search',
      incidentId: 'incident-zc-demo',
      correlationId: privateFamilyReunificationIssueRequestFixture.correlationId,
      maxUses: 1,
    });
    expect(issued.token).toHaveLength(64);

    const persisted = await (env as Env).DB.prepare('SELECT token_hash AS tokenHash, metadata_json AS metadataJson FROM private_web_links WHERE link_id = ?')
      .bind(issued.linkId)
      .first<{ tokenHash: string; metadataJson: string }>();
    expect(persisted?.tokenHash).not.toBe(issued.token);
    expect(JSON.parse(persisted?.metadataJson ?? '{}')).toMatchObject({ returnState: 'web:family-reunification:search' });

    const audit = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE audit_event_id = ?')
      .bind(issued.audit.auditEventId)
      .first<{ count: number }>();
    expect(audit?.count).toBe(1);

    const denied = await request('/incidents/incident-zc-demo/private-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...privateFamilyReunificationIssueRequestFixture, externalId: 'unknown-web-user' }),
    });
    expect(denied.status).toBe(403);
    await expect(denied.json()).resolves.toEqual({ error: 'permission_denied' });

    const invalidScope = await request('/incidents/incident-zc-demo/private-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...privateFamilyReunificationIssueRequestFixture, scope: 'work_center.detail' }),
    });
    expect(invalidScope.status).toBe(400);
    await expect(invalidScope.json()).resolves.toEqual({ error: 'invalid_link_scope' });
  });

  it('caps family private link TTL and max uses server-side', async () => {
    const requestedAt = Date.now();
    const issued = await issueFamilyReunificationLink({ ttlSeconds: 86_400, maxUses: 5, correlationId: 'corr-family-policy-cap' });

    expect(issued.maxUses).toBe(1);
    expect(Date.parse(issued.expiresAt)).toBeLessThanOrEqual(requestedAt + 910 * 1000);
    expect(Date.parse(issued.expiresAt)).toBeGreaterThan(requestedAt);

    const persisted = await (env as Env).DB.prepare(
      `SELECT max_uses AS maxUses, expires_at AS expiresAt
       FROM private_web_links
       WHERE link_id = ?`,
    )
      .bind(issued.linkId)
      .first<{ maxUses: number; expiresAt: string }>();
    expect(persisted?.maxUses).toBe(1);
    expect(Date.parse(persisted?.expiresAt ?? '')).toBeLessThanOrEqual(requestedAt + 910 * 1000);

    const audit = await (env as Env).DB.prepare('SELECT payload_json AS payloadJson FROM audit_events WHERE audit_event_id = ?')
      .bind(issued.audit.auditEventId)
      .first<{ payloadJson: string }>();
    expect(JSON.parse(audit?.payloadJson ?? '{}')).toMatchObject({ maxUses: 1 });
  });

  it('validates, audits and consumes private family reunification links without sensitive data', async () => {
    const issued = await issueFamilyReunificationLink();
    const validatePayload = {
      token: issued.token,
      scope: 'family_reunification.search',
      correlationId: issued.correlationId,
      fingerprint: 'browser-fingerprint-private-flow',
    };

    const active = await request('/private-links/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'vitest-private-web' },
      body: JSON.stringify(validatePayload),
    });
    expect(active.status).toBe(200);
    const activeBody = PrivateWebLinkValidateResponseSchema.parse(await active.json());
    expect(activeBody).toMatchObject({ valid: true, linkId: issued.linkId, nextAction: 'in_person_verification', remainingUses: 1 });

    const mismatch = await request('/private-links/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validatePayload, correlationId: 'wrong-correlation' }),
    });
    expect(mismatch.status).toBe(400);
    await expect(mismatch.json()).resolves.toEqual({ error: 'link_correlation_mismatch' });

    const consume = await request('/private-links/consume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validatePayload, referralReason: 'family_reunification_in_person_verification' }),
    });
    expect(consume.status).toBe(200);
    const consumeBody = PrivateWebLinkConsumeResponseSchema.parse(await consume.json());
    expect(consumeBody).toMatchObject({
      accepted: true,
      linkId: issued.linkId,
      referral: {
        type: 'in_person_verification',
        reasonCode: 'family_reunification_in_person_verification',
        messageCode: 'family_reunification.referral.in_person_verification',
      },
    });
    expect(JSON.stringify(consumeBody)).not.toMatch(/photo|fullName|latitude|longitude|exactLocation/i);
    expect(JSON.stringify(consumeBody)).not.toMatch(/continue with in-person verification|family desk|visit the family reunification desk/i);

    const consumed = await request('/private-links/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validatePayload),
    });
    expect(consumed.status).toBe(410);
    await expect(consumed.json()).resolves.toEqual({ error: 'link_expired' });

    const attempts = await (env as Env).DB.prepare(
      'SELECT result, error_code AS errorCode, ip_hash AS ipHash, user_agent_hash AS userAgentHash FROM private_web_link_attempts WHERE link_id = ? ORDER BY created_at ASC',
    )
      .bind(issued.linkId)
      .all<{ result: string; errorCode: string | null; ipHash: string | null; userAgentHash: string | null }>();
    expect(attempts.results.map((attempt) => attempt.result)).toContain('accepted');
    expect(attempts.results.map((attempt) => attempt.errorCode)).toContain('link_correlation_mismatch');
    expect(attempts.results.map((attempt) => attempt.errorCode)).toContain('link_expired');
    expect(attempts.results.some((attempt) => attempt.userAgentHash && attempt.userAgentHash !== 'vitest-private-web')).toBe(true);
  });

  it('debits family reunification search links and rejects repeated search or consume attempts', async () => {
    const issued = await issueFamilyReunificationLink({ correlationId: 'corr-family-search-consumes-link' });
    const searchPayload = {
      token: issued.token,
      correlationId: issued.correlationId,
      fingerprint: 'browser-fingerprint-search-consumes',
      query: { ageBand: 'child', relationHint: 'parent looking for child', lastKnownAreaLabel: 'north gate area' },
    };

    const search = await request('/private-links/family-reunification/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(searchPayload),
    });
    expect(search.status).toBe(200);
    const searchBody = FamilyReunificationSearchResponseSchema.parse(await search.json());
    expect(JSON.stringify(searchBody)).not.toMatch(/photo|fullName|latitude|longitude|exactLocation/i);
    expect(JSON.stringify(searchBody)).not.toMatch(/family desk|visit the family reunification desk/i);
    expect(searchBody.matches[0]?.reasonCode).toBe('family_reunification.match.family_desk_compare_details');
    expect(searchBody.referral.type).toBe('in_person_verification');
    expect(searchBody.referral.reasonCode).toBe('family_reunification_in_person_verification');
    expect(searchBody.referral.messageCode).toBe('family_reunification.referral.in_person_verification');

    const persisted = await (env as Env).DB.prepare(
      `SELECT use_count AS useCount, consumed_at AS consumedAt
       FROM private_web_links
       WHERE link_id = ?`,
    )
      .bind(issued.linkId)
      .first<{ useCount: number; consumedAt: string | null }>();
    expect(persisted).toMatchObject({ useCount: 1 });
    expect(persisted?.consumedAt).toBeTruthy();

    const repeatedSearch = await request('/private-links/family-reunification/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(searchPayload),
    });
    expect(repeatedSearch.status).toBe(410);
    await expect(repeatedSearch.json()).resolves.toEqual({ error: 'link_expired' });

    const consumeAfterSearch = await request('/private-links/consume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: issued.token,
        scope: 'family_reunification.search',
        correlationId: issued.correlationId,
        fingerprint: 'browser-fingerprint-search-consumes',
        referralReason: 'family_reunification_in_person_verification',
      }),
    });
    expect(consumeAfterSearch.status).toBe(410);
    await expect(consumeAfterSearch.json()).resolves.toEqual({ error: 'link_expired' });

    const attempts = await (env as Env).DB.prepare(
      `SELECT result, error_code AS errorCode, metadata_json AS metadataJson
       FROM private_web_link_attempts
       WHERE link_id = ?
       ORDER BY created_at ASC`,
    )
      .bind(issued.linkId)
      .all<{ result: string; errorCode: string | null; metadataJson: string }>();
    const attemptSummaries = attempts.results.map((attempt) => ({
      result: attempt.result,
      errorCode: attempt.errorCode,
      action: JSON.parse(attempt.metadataJson).action,
    }));
    expect(attemptSummaries).toContainEqual({ result: 'accepted', errorCode: null, action: 'family_reunification.search' });
    expect(attemptSummaries).toContainEqual({ result: 'rejected', errorCode: 'link_expired', action: 'family_reunification.search' });
  });

  it('rejects expired private links and anti-abuses repeated failed attempts', async () => {
    const expired = await issueFamilyReunificationLink({ ttlSeconds: 1, correlationId: 'corr-expired-private-link' });
    await (env as Env).DB.prepare('UPDATE private_web_links SET expires_at = ? WHERE link_id = ?')
      .bind('2000-01-01T00:00:00.000Z', expired.linkId)
      .run();

    const expiredResponse = await request('/private-links/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: expired.token,
        scope: 'family_reunification.search',
        correlationId: expired.correlationId,
        fingerprint: 'browser-fingerprint-expired',
      }),
    });
    expect(expiredResponse.status).toBe(410);
    await expect(expiredResponse.json()).resolves.toEqual({ error: 'link_expired' });

    for (let index = 0; index < 5; index += 1) {
      const failed = await request('/private-links/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: `bad-token-${index}`,
          scope: 'family_reunification.search',
          correlationId: 'corr-abuse-private-link',
          fingerprint: 'browser-fingerprint-abuse',
        }),
      });
      expect(failed.status).toBe(403);
      await expect(failed.json()).resolves.toEqual({ error: 'permission_denied' });
    }

    const limited = await request('/private-links/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: expired.token,
        scope: 'family_reunification.search',
        correlationId: expired.correlationId,
        fingerprint: 'browser-fingerprint-abuse',
      }),
    });
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toEqual({ error: 'rate_limited' });

    const attempts = await (env as Env).DB.prepare(
      "SELECT COUNT(*) AS count FROM private_web_link_attempts WHERE fingerprint_hash IS NOT NULL AND result = 'rejected'",
    ).first<{ count: number }>();
    expect(attempts?.count).toBeGreaterThanOrEqual(6);

    const rateLimitAudit = await (env as Env).DB.prepare(
      "SELECT event_type AS eventType, result, error_code AS errorCode, metadata_json AS metadataJson FROM operational_audit_events WHERE scope = 'private_link.validate' AND error_code = 'rate_limited'",
    ).first<{ eventType: string; result: string; errorCode: string; metadataJson: string }>();
    expect(rateLimitAudit).toMatchObject({ eventType: 'rate_limit.checked', result: 'rejected', errorCode: 'rate_limited' });
    expect(rateLimitAudit?.metadataJson).not.toContain('browser-fingerprint-abuse');
  });

  it('does not block private link validation when operational audit persistence fails', async () => {
    const link = await issueFamilyReunificationLink({ correlationId: 'corr-audit-insert-fails' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const prepareSpy = mockOperationalAuditInsertFailure();
    try {
      const response = await request('/private-links/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: link.token,
          scope: 'family_reunification.search',
          correlationId: link.correlationId,
          fingerprint: 'browser-fingerprint-audit-fails',
        }),
      });

      expect(response.status).toBe(200);
      expect(PrivateWebLinkValidateResponseSchema.parse(await response.json()).valid).toBe(true);
    } finally {
      prepareSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it('writes minimized operational audit without raw private-link secrets', async () => {
    const link = await issueFamilyReunificationLink({ correlationId: 'corr-audit-minimized' });
    const response = await request('/private-links/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Sensitive Browser Agent' },
      body: JSON.stringify({
        token: link.token,
        scope: 'family_reunification.search',
        correlationId: link.correlationId,
        fingerprint: 'raw-browser-fingerprint-secret',
      }),
    });
    expect(response.status).toBe(200);

    const audits = await (env as Env).DB.prepare(
      "SELECT event_type AS eventType, subject_ref_hash AS subjectRefHash, metadata_json AS metadataJson FROM operational_audit_events WHERE scope = 'family_reunification.search'",
    ).all<{ eventType: string; subjectRefHash: string | null; metadataJson: string }>();
    const serialized = JSON.stringify(audits.results);
    expect(serialized).toContain('private_link.attempted');
    expect(serialized).not.toContain(link.token);
    expect(serialized).not.toContain('raw-browser-fingerprint-secret');
    expect(serialized).not.toContain('Sensitive Browser Agent');
    expect(audits.results.some((row) => row.subjectRefHash && row.subjectRefHash.length === 64)).toBe(true);
  });

  it('keeps structured sync logs minimized without operation identifiers or payloads', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let logged = '';
    try {
      const response = await request('/sync/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operations: [createSignedOperationFixture({ opId: 'op-secret-log-id' })] }),
      });
      expect(response.status).toBe(200);
      logged = spy.mock.calls.map((call) => String(call[0])).join('\n');
    } finally {
      spy.mockRestore();
    }

    expect(logged).toContain('operation.processed');
    expect(logged).not.toContain('op-secret-log-id');
    expect(logged).not.toContain('incident-fixture');
    expect(logged).not.toMatch(/payload|signature|fingerprint|token/i);
  });

  it('allows Turnstile siteverify network failures in observe rollout', async () => {
    const link = await issueFamilyReunificationLink({ correlationId: 'corr-turnstile-observe-fetch-fails' });
    const mutableEnv = env as Env;
    const previousRollout = mutableEnv.TURNSTILE_ROLLOUT;
    const previousSecret = mutableEnv.TURNSTILE_SECRET_KEY;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('siteverify unavailable'));
    mutableEnv.TURNSTILE_ROLLOUT = 'observe';
    mutableEnv.TURNSTILE_SECRET_KEY = 'test-secret';
    try {
      const response = await request('/private-links/family-reunification/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-turnstile-token': 'test-token' },
        body: JSON.stringify({
          token: link.token,
          correlationId: link.correlationId,
          fingerprint: 'turnstile-observe-fetch-fails',
          query: { ageBand: 'adult' },
        }),
      });

      expect(response.status).toBe(200);
      expect(FamilyReunificationSearchResponseSchema.parse(await response.json()).matches).toHaveLength(1);
    } finally {
      fetchSpy.mockRestore();
      mutableEnv.TURNSTILE_ROLLOUT = previousRollout;
      mutableEnv.TURNSTILE_SECRET_KEY = previousSecret;
    }
  });

  it('fails closed when Turnstile siteverify rejects in enforce rollout', async () => {
    const link = await issueFamilyReunificationLink({ correlationId: 'corr-turnstile-enforce-fetch-fails' });
    const mutableEnv = env as Env;
    const previousRollout = mutableEnv.TURNSTILE_ROLLOUT;
    const previousSecret = mutableEnv.TURNSTILE_SECRET_KEY;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('siteverify unavailable'));
    mutableEnv.TURNSTILE_ROLLOUT = 'enforce';
    mutableEnv.TURNSTILE_SECRET_KEY = 'test-secret';
    try {
      const response = await request('/private-links/family-reunification/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-turnstile-token': 'test-token' },
        body: JSON.stringify({
          token: link.token,
          correlationId: link.correlationId,
          fingerprint: 'turnstile-enforce-fetch-fails',
          query: { ageBand: 'adult' },
        }),
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'turnstile_failed' });
    } finally {
      fetchSpy.mockRestore();
      mutableEnv.TURNSTILE_ROLLOUT = previousRollout;
      mutableEnv.TURNSTILE_SECRET_KEY = previousSecret;
    }
  });

  it('requires Turnstile only when enforcement is explicitly configured', async () => {
    const link = await issueFamilyReunificationLink({ correlationId: 'corr-turnstile-enforced' });
    const mutableEnv = env as Env;
    const previousRollout = mutableEnv.TURNSTILE_ROLLOUT;
    const previousSecret = mutableEnv.TURNSTILE_SECRET_KEY;
    mutableEnv.TURNSTILE_ROLLOUT = 'enforce';
    mutableEnv.TURNSTILE_SECRET_KEY = 'test-secret';
    try {
      const challenged = await request('/private-links/family-reunification/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: link.token, correlationId: link.correlationId, fingerprint: 'turnstile-fingerprint', query: { ageBand: 'adult' } }),
      });
      expect(challenged.status).toBe(403);
      await expect(challenged.json()).resolves.toEqual({ error: 'security_challenge_required' });
    } finally {
      mutableEnv.TURNSTILE_ROLLOUT = previousRollout;
      mutableEnv.TURNSTILE_SECRET_KEY = previousSecret;
    }
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
      workCenter: { name: 'North triage point', sourceChannel: 'telegram', activationState: 'pending_corroboration', status: 'reported', signalCount: 1 },
      idempotent: false,
    });

    const audit = await (env as Env).DB.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE audit_event_id = ?')
      .bind(body.audit.auditEventId)
      .first<{ count: number }>();
    expect(audit?.count).toBe(1);
  });

  it('rejects connected-channel work center creation for non-members', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let logged = '';
    let response!: Response;
    try {
      response = await request('/incidents/incident-zc-demo/work-centers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(telegramWorkCenterCreateRequestFixture),
      });
      logged = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
    } finally {
      logSpy.mockRestore();
    }

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'permission_denied' });
    expect(logged).toContain('"errorCode":"permission_denied"');
    expect(logged).not.toContain('"errorCode":"rate_limited"');
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

  it('persists canonical preferred locale for joined channel identities', async () => {
    const response = await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: 'telegram-user-locale-en', preferredLocale: 'en' }),
    });

    expect(response.status).toBe(200);
    const body = IncidentJoinResponseSchema.parse(await response.json());
    expect(body.channelIdentity.preferredLocale).toBe('en');

    const persisted = await (env as Env).DB.prepare('SELECT preferred_locale AS preferredLocale FROM channel_identities WHERE channel_identity_id = ?')
      .bind(body.channelIdentity.channelIdentityId)
      .first<{ preferredLocale: string | null }>();
    expect(persisted?.preferredLocale).toBe('en');
  });

  it('rejects arbitrary preferred locale values at the API boundary', async () => {
    const response = await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, preferredLocale: 'fr' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_payload' });
  });

  it('falls back to the pilot locale for legacy channel identities without a stored preference', async () => {
    const response = await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: 'telegram-user-locale-default' }),
    });

    expect(response.status).toBe(200);
    const body = IncidentJoinResponseSchema.parse(await response.json());
    expect(body.channelIdentity.preferredLocale).toBe('es');

    const persisted = await (env as Env).DB.prepare('SELECT preferred_locale AS preferredLocale FROM channel_identities WHERE channel_identity_id = ?')
      .bind(body.channelIdentity.channelIdentityId)
      .first<{ preferredLocale: string | null }>();
    expect(persisted?.preferredLocale).toBeNull();
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
        JSON.stringify({ canReadIncident: true, canJoinIncident: true, canManageIncident: false, canManageLogistics: false, canManageMedical: false }),
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
    expect(body).toMatchObject({ membership: { incidentMembershipId }, audit: { auditEventId }, idempotent: true });

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
        operations: [
          {
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
          },
        ],
      }),
    });

    const list = ResourceReportListResponseSchema.parse(await (await request('/incidents/incident-zc-demo/resource-reports')).json());
    expect(list.resourceReports.map((report) => report.reportKind).sort()).toEqual(['needed', 'surplus']);

    const matches = ResourceReportMatchResponseSchema.parse(await (await request('/incidents/incident-zc-demo/resource-reports/matches')).json());
    expect(matches.matches).toHaveLength(1);
    expect(matches.matches[0]).toMatchObject({ need: { reportKind: 'needed' }, surplus: { reportKind: 'surplus' } });
  });


  it('returns Telegram need recommendations ranked by urgency and normalized medicamentos category', async () => {
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(telegramIncidentJoinRequestFixture),
    });

    const workCenterResponse = await request('/incidents/incident-zc-demo/work-centers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel: 'telegram',
        externalId: 'telegram-user-1001',
        payload: {
          name: 'Medical Tent North',
          priority: 'high',
          initialNeed: 'medicamentos',
          location: { latitude: 40.42, longitude: -3.7 },
        },
      }),
    });
    expect(workCenterResponse.status).toBe(200);
    const workCenter = WorkCenterCreateResponseSchema.parse(await workCenterResponse.json()).workCenter;

    for (const payload of [
      { category: 'medicina', quantityApprox: '10 boxes', urgency: 'medium', constraints: ['sealed'], reportKind: 'needed', workCenterId: workCenter.workCenterId },
      { category: 'fármacos', quantityApprox: '5 boxes', urgency: 'critical', constraints: ['cold chain'], reportKind: 'needed' },
      { category: 'food', quantityApprox: '20 meals', urgency: 'critical', constraints: [], reportKind: 'needed' },
    ] as const) {
      const response = await request('/incidents/incident-zc-demo/resource-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channel: 'telegram', externalId: 'telegram-user-1001', payload }),
      });
      expect(response.status).toBe(200);
    }

    const recommendations = await recommendTelegramResourceNeeds((env as Env).DB, {
      resourceLabel: 'medicamentos',
      incidentId: 'incident-zc-demo',
    });

    expect(recommendations.map((recommendation) => recommendation.category)).toEqual(['fármacos', 'medicina']);
    expect(recommendations.filter((recommendation) => recommendation.workCenterId === workCenter.workCenterId)).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({ incidentId: 'incident-zc-demo', incidentName: 'Zona Cero Demo Incident', urgency: 'critical' });
    expect(recommendations[1]).toMatchObject({
      workCenterId: workCenter.workCenterId,
      workCenterName: 'Medical Tent North',
      workCenterLocation: { latitude: 40.42, longitude: -3.7 },
      reasons: expect.arrayContaining(['linked_work_center']),
    });
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
    const first = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operations: [createOperation] }),
    });
    const duplicate = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operations: [createOperation] }),
    });
    expect(SyncPushResponseSchema.parse(await first.json()).results[0]).toMatchObject({ status: 'accepted' });
    expect(SyncPushResponseSchema.parse(await duplicate.json()).results[0]).toMatchObject({ status: 'accepted' });

    const conflict = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operations: [{ ...createOperation, opId: 'op-dispatch-create-conflict-1', payload: { category: 'medical', quantityApprox: '12 kits' } }],
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
      body: JSON.stringify({
        operations: [
          {
            ...createOperation,
            opId: 'op-dispatch-update-1',
            entityId: 'dt-mobile-water-1',
            opType: 'dispatch_event.update',
            payload: { dispatchTaskId: 'dt-mobile-water-1', status: 'delivered' },
          },
        ],
      }),
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

  it('drives Telegram webhook /familia through private-link issuance without exposing sensitive data', async () => {
    const telegramUserId = 28001;
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: String(telegramUserId), displayName: 'Family Reporter' }),
    });

    await expect(postTelegramMessage(telegramUserId, '/familia', 'Family')).resolves.toMatchObject({
      accepted: true,
      command: '/familia',
      responseText: expect.stringContaining('Do not send names'),
    });

    const stateKey = `flow:family-reunification:chat:${telegramUserId}:from:${telegramUserId}`;
    await expect(
      (env as Env).DB.prepare('SELECT step FROM telegram_conversation_states WHERE state_key = ?').bind(stateKey).first<{ step: string }>(),
    ).resolves.toMatchObject({ step: 'awaitingIncident' });

    const linked = await postTelegramMessage(telegramUserId, '1', 'Family');
    expect(linked.responseText).toContain('Open this private web link');
    expect(linked.responseText).toContain('/family-reunification?token=');
    expect(linked.responseText).toContain('Do not send names');
    expect(linked.responseText).toContain('identifying traits');
    expect(linked.responseText).toContain('phone numbers');
    expect(linked.responseText).toContain('exact locations');
    expect(linked.responseText).toContain('complete descriptions');
    expect(linked.responseText).toContain('in-person verification');
    expect(linked.responseText).not.toMatch(/fullName|latitude|longitude|exactLocation/i);

    await expect(
      (env as Env).DB.prepare('SELECT step FROM telegram_conversation_states WHERE state_key = ?').bind(stateKey).first<{ step: string }>(),
    ).resolves.toBeNull();

    const issued = await (env as Env).DB.prepare(
      `SELECT l.scope, l.max_uses AS maxUses, l.correlation_id AS correlationId, i.channel, i.external_id AS externalId, l.metadata_json AS metadataJson
       FROM private_web_links l
       JOIN channel_identities i ON i.channel_identity_id = l.channel_identity_id
       WHERE i.external_id = ?`,
    )
      .bind(String(telegramUserId))
      .first<{ scope: string; maxUses: number; correlationId: string; channel: string; externalId: string; metadataJson: string }>();
    expect(issued).toMatchObject({ scope: 'family_reunification.search', maxUses: 1, channel: 'telegram', externalId: String(telegramUserId) });
    expect(issued?.correlationId).toMatch(/^telegram-family-incident-zc-demo-/);
    expect(JSON.parse(issued?.metadataJson ?? '{}')).toMatchObject({ returnState: 'web:family-reunification:search' });
  });

  it('returns a safe Telegram family reunification fallback when private-link issuance is denied', async () => {
    const telegramUserId = 28002;

    await expect(postTelegramMessage(telegramUserId, '/reunificacion', 'NoMember')).resolves.toMatchObject({
      accepted: true,
      command: '/reunificacion',
      responseText: expect.stringContaining('Do not send names'),
    });

    const fallback = await postTelegramMessage(telegramUserId, '1', 'NoMember');
    expect(fallback.responseText).toContain('Could not create a private family reunification link');
    expect(fallback.responseText).toContain('in-person help');
    expect(fallback.responseText).not.toMatch(/token=|fullName|latitude|longitude|exactLocation/i);
  });

  it('drives Telegram webhook /sos through persisted state and exact confirmation', async () => {
    const telegramUserId = 27001;
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: String(telegramUserId), displayName: 'SOS Reporter' }),
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
    expect(created).toMatchObject({ accepted: true, responseText: expect.stringContaining('Backend recording confirmed only') });

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
        operations: [{ ...validSosCreateOperationFixture, payload: { ...validSosCreateOperationFixture.payload, message: 'Changed critical details' } }],
      }),
    });
    const entityConflict = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operations: [{ ...validSosCreateOperationFixture, opId: 'op-sos-create-conflict-entity' }] }),
    });
    const invalidPayload = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operations: [{ ...validSosCreateOperationFixture, opId: 'op-sos-invalid', entityId: 'sos-invalid', payload: { severity: 'handled' } }],
      }),
    });
    const cancel = await request('/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mobileSosCancelSyncPushFixture),
    });

    expect(SyncPushResponseSchema.parse(await first.json()).results[0]).toMatchObject({ opId: 'op-sos-create-1', status: 'accepted' });
    expect(SyncPushResponseSchema.parse(await duplicate.json()).results[0]).toMatchObject({ opId: 'op-sos-create-1', status: 'accepted' });
    expect(SyncPushResponseSchema.parse(await sameOpConflict.json()).results[0]).toMatchObject({
      opId: 'op-sos-create-1',
      status: 'rejected',
      code: 'operation_conflict',
    });
    expect(SyncPushResponseSchema.parse(await entityConflict.json()).results[0]).toMatchObject({
      opId: 'op-sos-create-conflict-entity',
      status: 'rejected',
      code: 'operation_conflict',
    });
    expect(SyncPushResponseSchema.parse(await invalidPayload.json()).results[0]).toMatchObject({
      opId: 'op-sos-invalid',
      status: 'rejected',
      code: 'invalid_payload',
    });
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

    expect(SyncPushResponseSchema.parse(await response.json()).results[0]).toMatchObject({ opId: 'op-sos-cancel-1', status: 'rejected', code: 'not_found' });
  });

  it('drives Telegram webhook /resource through persisted state and clears terminal state', async () => {
    const telegramUserId = 26001;
    await request('/incidents/incident-zc-demo/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: String(telegramUserId), displayName: 'Resource Reporter' }),
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
    await expect(postTelegramMessage(telegramUserId, 'needed', 'Resource')).resolves.toMatchObject({
      responseText: expect.stringContaining('resource category'),
    });
    await expect(postTelegramMessage(telegramUserId, 'water', 'Resource')).resolves.toMatchObject({
      responseText: expect.stringContaining('approximate quantity'),
    });
    await expect(postTelegramMessage(telegramUserId, '20 boxes', 'Resource')).resolves.toMatchObject({ responseText: expect.stringContaining('urgency') });
    await expect(postTelegramMessage(telegramUserId, 'high', 'Resource')).resolves.toMatchObject({
      responseText: expect.stringContaining('optional restrictions'),
    });
    await expect(postTelegramMessage(telegramUserId, 'sealed', 'Resource')).resolves.toMatchObject({ responseText: expect.stringContaining('work center id') });
    await expect(postTelegramMessage(telegramUserId, 'skip', 'Resource')).resolves.toMatchObject({
      responseText: expect.stringContaining('Confirm resource report'),
    });

    const created = await postTelegramMessage(telegramUserId, 'yes', 'Resource');
    expect(created).toMatchObject({ accepted: true, command: null, responseText: expect.stringContaining('Resource needed reported: water (20 boxes).') });

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
      body: JSON.stringify({ ...telegramIncidentJoinRequestFixture, externalId: String(telegramUserId), displayName: 'Dispatch Reporter' }),
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

    await expect(postTelegramMessage(telegramUserId, '1', 'Dispatch')).resolves.toMatchObject({
      responseText: expect.stringContaining('Choose a dispatch task'),
    });
    await expect(postTelegramMessage(telegramUserId, '1', 'Dispatch')).resolves.toMatchObject({ responseText: expect.stringContaining('new status') });
    await expect(postTelegramMessage(telegramUserId, 'en_route', 'Dispatch')).resolves.toMatchObject({
      responseText: expect.stringContaining('Confirm dispatch task update'),
    });

    const updated = await postTelegramMessage(telegramUserId, 'yes', 'Dispatch');
    expect(updated).toMatchObject({ accepted: true, command: null, responseText: expect.stringContaining(`Dispatch task updated: ${task.dispatchTaskId}.`) });

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

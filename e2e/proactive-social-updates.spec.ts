import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { expect, test, type APIRequestContext } from '@playwright/test';

const execFileAsync = promisify(execFile);
const apiBaseUrl = 'http://127.0.0.1:8787';
const incidentId = 'incident-zc-demo';
const cellId = 'connected-telegram';

type Channel = 'telegram' | 'mobile' | 'web-ui';
type IncidentRole = 'volunteer' | 'coordinator' | 'logistics' | 'medical';
type OperationalUpdateType = 'sos_alert' | 'resource_need' | 'resource_offer' | 'trust_signal' | 'dispute' | 'system_notice';
type OperationalUpdateActionType = 'ack' | 'read' | 'open' | 'corroborate' | 'dispute' | 'link';
type TrustSubjectEntityType = 'channel_identity' | 'incident_membership' | 'work_center' | 'resource_report' | 'dispatch_task' | 'sos_alert' | 'custom';

type PermissionSnapshot = {
  canReadIncident: boolean;
  canJoinIncident: boolean;
  canManageIncident: boolean;
  canManageLogistics: boolean;
  canManageMedical: boolean;
};

type IncidentJoinResponse = {
  membership: { permissions: PermissionSnapshot };
};

type TrustSubject = {
  entityType: TrustSubjectEntityType;
  entityId: string;
  incidentId: string;
  displayRef?: string;
};

type TrustState = {
  subject: TrustSubject;
  status: string;
  visibility: string;
  score: number;
  signalCount: number;
  disputeCount: number;
};

type OperationalUpdate = {
  updateId: string;
  incidentId: string;
  cellId: string;
  type: OperationalUpdateType;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  summary: string;
  source: { kind: 'sos_alert' | 'resource_report' | 'trust_signal' | 'dispute' | 'system'; entityId?: string };
  subject?: TrustSubject;
  actions: { type: OperationalUpdateActionType; label: string; messageCode: string }[];
  reasonCode?: 'resource.match.offer_for_open_need' | 'resource.match.need_for_open_offer' | 'resource.report.cell_broadcast';
  metadata?: Record<string, unknown>;
};

type OperationalUpdatePullResponse = {
  updates: OperationalUpdate[];
  cursor: string | null;
  hasMore: boolean;
};

type OperationalUpdateActionResponse = {
  update: OperationalUpdate;
  action: { actionId: string; updateId: string; actionType: OperationalUpdateActionType; status: string; idempotent: boolean; createdAt: string };
  trustState?: TrustState;
  audit?: { auditEventId: string };
};

type OperationalUpdateLinkResponse = OperationalUpdateActionResponse & {
  link: { href: string; scope: string; expiresAt: string };
};

type DryRunResult = {
  marker: string;
  proactiveUpdatesMarker?: string;
  dryRun: true;
  sentSteps: { label: string; message: string; skipped?: boolean; botReplyPreview?: string }[];
};

test.describe('Slice 21 proactive social updates E2E', () => {
  test('command/API flow creates, pulls, acts, audits trust, and does not escalate permissions', async ({ request }) => {
    const unique = `${Date.now()}-${test.info().workerIndex}`;
    const externalId = `slice21-e2e-telegram-${unique}`;
    const outsiderExternalId = `slice21-e2e-outsider-${unique}`;
    const resourceMarker = `slice21-proactive-water-${unique}`;

    const joined = await joinIncident(request, {
      channel: 'telegram',
      externalId,
      role: 'volunteer',
      displayName: 'Slice 21 E2E volunteer',
    });
    expect(joined.membership.permissions).toMatchObject(noSensitiveManagementPermissions());

    await createResourceNeed(request, externalId, resourceMarker);
    await createSosAlert(request, externalId);

    const firstPage = await listUpdates(request, externalId, { limit: 1 });
    expect(firstPage.updates).toHaveLength(1);
    if (firstPage.hasMore) {
      expect(firstPage.cursor).toEqual(expect.any(String));
      const nextPage = await listUpdates(request, externalId, { limit: 1, cursor: firstPage.cursor });
      expect(nextPage.updates.length).toBeGreaterThanOrEqual(1);
    }

    const updates = await pullUpdatesUntil(request, externalId, (update) => update.summary.includes(resourceMarker));
    const resourceUpdate = updates.find((update) => update.summary.includes(resourceMarker));
    if (!resourceUpdate) throw new Error(`Expected a resource operational update containing ${resourceMarker}.`);
    expect(resourceUpdate).toMatchObject({ type: 'resource_need', source: { kind: 'resource_report' } });
    expect(resourceUpdate.actions.map((action) => action.type)).toEqual(expect.arrayContaining(['ack', 'open', 'link', 'corroborate', 'dispute']));

    const sosUpdate = updates.find((update) => update.type === 'sos_alert');
    expect(sosUpdate?.source.kind).toBe('sos_alert');

    const serializedUpdates = JSON.stringify(updates);
    expect(serializedUpdates).not.toMatch(/slice21-e2e-telegram|Private medical details|latitude|longitude/i);

    const forbiddenAck = await postUpdateAction(request, resourceUpdate.updateId, 'ack', {
      channel: 'telegram',
      externalId: outsiderExternalId,
      idempotencyKey: `forbidden-ack-${unique}`,
    });
    expect(forbiddenAck.status()).toBe(403);

    const ack = await expectActionOk(postUpdateAction(request, resourceUpdate.updateId, 'ack', actionRequest(externalId, `ack-${unique}`)));
    expect(ack.action).toMatchObject({ actionType: 'ack', idempotent: false });

    const duplicateAck = await expectActionOk(postUpdateAction(request, resourceUpdate.updateId, 'ack', actionRequest(externalId, `ack-${unique}`)));
    expect(duplicateAck.action).toMatchObject({ actionType: 'ack', idempotent: true });

    const open = await expectActionOk(postUpdateAction(request, resourceUpdate.updateId, 'open', actionRequest(externalId, `open-${unique}`)));
    expect(open.action.actionType).toBe('open');

    const link = await expectLinkOk(postUpdateAction(request, resourceUpdate.updateId, 'links', actionRequest(externalId, `link-${unique}`)));
    expect(link.link).toMatchObject({ scope: 'operational_update.detail' });
    expect(link.link.href).toContain('/operational-updates/private-detail#');

    const corroborate = await expectActionOk(postUpdateAction(request, resourceUpdate.updateId, 'corroborate', {
      ...actionRequest(externalId, `corroborate-${unique}`),
      confidence: 0.8,
      note: 'Slice 21 E2E corroboration adds context only.',
    }));
    expect(corroborate).toMatchObject({ action: { actionType: 'corroborate' }, audit: { auditEventId: expect.any(String) } });
    expect(corroborate.trustState).toMatchObject({ subject: resourceUpdate.subject, signalCount: 1 });

    const dispute = await expectActionOk(postUpdateAction(request, resourceUpdate.updateId, 'dispute', {
      ...actionRequest(externalId, `dispute-${unique}`),
      reason: 'context_mismatch',
      note: 'Slice 21 E2E dispute asks for review before action.',
    }));
    expect(dispute).toMatchObject({
      action: { actionType: 'dispute' },
      audit: { auditEventId: expect.any(String) },
      trustState: { status: 'disputed', disputeCount: 1 },
    });

    if (!resourceUpdate.subject) throw new Error('Expected resource update to expose a trust subject.');
    const trustState = await fetchTrustState(request, resourceUpdate.subject);
    expect(trustState).toMatchObject({
      subject: {
        entityType: resourceUpdate.subject.entityType,
        entityId: resourceUpdate.subject.entityId,
        incidentId: resourceUpdate.subject.incidentId,
      },
      status: 'disputed',
      visibility: 'limited',
    });

    const joinedAfterActions = await joinIncident(request, {
      channel: 'telegram',
      externalId,
      role: 'volunteer',
      displayName: 'Slice 21 E2E volunteer',
    });
    expect(joinedAfterActions.membership.permissions).toMatchObject(noSensitiveManagementPermissions());
    expect(JSON.stringify({ ack, duplicateAck, open, link, corroborate, dispute, trustState })).not.toMatch(/canManageIncident|canManageLogistics|canManageMedical/i);
  });

  test('natural-language Telegram dry-run covers proactive updates copy and action boundaries', async () => {
    const result = await runTelegramDryRun('proactive-updates');
    const labels = result.sentSteps.map((step) => step.label);

    expect(labels).toEqual([
      'proactive-updates-command-list',
      'proactive-updates-command-ack',
      'proactive-updates-command-open',
      'proactive-updates-command-corroborate',
      'proactive-updates-command-dispute',
      'proactive-updates-natural-request',
      'proactive-updates-natural-boundary',
    ]);
    expect(result.marker).toContain('proactive-updates');
    expect(result.proactiveUpdatesMarker).toContain('proactive-updates');
    expect(result.sentSteps[0]?.message).toMatch(/^\/updates\s+incident-zc-demo\s+connected-telegram/);
    expect(result.sentSteps[3]?.message).toMatch(/^\/corroborate\s+incident-zc-demo\s+upd_/);
    expect(result.sentSteps[4]?.message).toMatch(/context_mismatch/);
    expect(result.sentSteps[5]?.message).toMatch(/actualizaciones operativas|proactive updates/i);
    expect(result.sentSteps[6]?.message).toMatch(/no concede permisos sensibles|no sustituye rescate|no asigna respondedores/i);
    expect(JSON.stringify(result)).not.toMatch(/TELEGRAM_E2E_API_HASH|SESSION|secret/i);
  });

  test('Slice 21.1: a resource offer is directed to the matching demander and not to unrelated members', async ({ request }) => {
    const unique = `${Date.now()}-${test.info().workerIndex}`;
    const demander = `slice21_1-demander-${unique}`;
    const supplier = `slice21_1-supplier-${unique}`;
    const outsider = `slice21_1-outsider-${unique}`;
    // Categoría compartida y única por corrida: garantiza el match need<->surplus sin ruido.
    const category = `water-${unique}`;

    for (const externalId of [demander, supplier, outsider]) {
      const joined = await joinIncident(request, { channel: 'telegram', externalId, role: 'volunteer', displayName: `S21.1 ${externalId}` });
      expect(joined.membership.permissions).toMatchObject(noSensitiveManagementPermissions());
    }

    // El demandante pide primero (aún sin oferta -> no hay match, cae a broadcast de celda).
    await createResourceReport(request, demander, category, 'needed');
    // El proveedor ofrece lo mismo -> debe emitir un resource_offer DIRIGIDO al demandante.
    await createResourceReport(request, supplier, category, 'surplus');

    const demanderUpdates = await pullUpdatesUntil(request, demander, (update) => update.reasonCode === 'resource.match.offer_for_open_need');
    const matchUpdate = demanderUpdates.find((update) => update.type === 'resource_offer' && update.reasonCode === 'resource.match.offer_for_open_need');
    if (!matchUpdate) throw new Error('El demandante debería recibir la update de oferta dirigida con reasonCode de match.');

    // Un miembro no relacionado (outsider) NO debe recibir la update dirigida.
    const outsiderUpdates = await pullUpdatesUntil(request, outsider, () => false);
    expect(outsiderUpdates.some((update) => update.updateId === matchUpdate.updateId)).toBe(false);

    // Privacidad: el targeting no debe filtrar identidades de reportantes en el payload.
    expect(JSON.stringify(demanderUpdates)).not.toMatch(new RegExp(`${demander}|${supplier}`, 'i'));
  });

  test('Slice 21.1 Fase 2: an opted-out demander does not receive the targeted match update', async ({ request }) => {
    const unique = `${Date.now()}-${test.info().workerIndex}`;
    const demander = `slice21_2-demander-${unique}`;
    const supplier = `slice21_2-supplier-${unique}`;
    const category = `blankets-${unique}`;

    for (const externalId of [demander, supplier]) {
      await joinIncident(request, { channel: 'telegram', externalId, role: 'volunteer', displayName: `S21.2 ${externalId}` });
    }

    await createResourceReport(request, demander, category, 'needed');

    // El demandante silencia las updates proactivas de match.
    const preference = await request.post(`${apiBaseUrl}/incidents/${incidentId}/updates/preferences`, {
      data: { channel: 'telegram', externalId: demander, quietProactiveUpdates: true },
    });
    await expect(preference).toBeOK();

    // El proveedor ofrece lo mismo -> normalmente dirigiría al demandante, pero está silenciado.
    await createResourceReport(request, supplier, category, 'surplus');

    const demanderUpdates = await pullUpdatesUntil(request, demander, () => false);
    expect(demanderUpdates.some((update) => update.reasonCode === 'resource.match.offer_for_open_need')).toBe(false);
  });
});

type JoinIncidentInput = {
  channel: Channel;
  externalId: string;
  role: IncidentRole;
  displayName: string;
};

async function joinIncident(request: APIRequestContext, input: JoinIncidentInput): Promise<IncidentJoinResponse> {
  const response = await request.post(`${apiBaseUrl}/incidents/${incidentId}/join`, {
    data: {
      channel: input.channel,
      externalId: input.externalId,
      role: input.role,
      displayName: input.displayName,
      preferredLocale: 'en',
    },
  });

  await expect(response).toBeOK();
  return (await response.json()) as IncidentJoinResponse;
}

async function createResourceNeed(request: APIRequestContext, externalId: string, marker: string): Promise<void> {
  await createResourceReport(request, externalId, marker, 'needed');
}

async function createResourceReport(
  request: APIRequestContext,
  externalId: string,
  category: string,
  reportKind: 'needed' | 'surplus',
): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/incidents/${incidentId}/resource-reports`, {
    data: {
      channel: 'telegram',
      externalId,
      payload: {
        category,
        quantityApprox: `20 sealed bottles for ${category}`,
        urgency: 'high',
        constraints: ['sealed'],
        reportKind,
      },
    },
  });

  await expect(response).toBeOK();
}

async function createSosAlert(request: APIRequestContext, externalId: string): Promise<void> {
  const response = await request.post(`${apiBaseUrl}/incidents/${incidentId}/sos`, {
    data: {
      channel: 'telegram',
      externalId,
      payload: {
        severity: 'critical',
        message: 'Private medical details must not leak into proactive updates.',
        location: { latitude: 41.38, longitude: 2.17, accuracyMeters: 10 },
      },
    },
  });

  await expect(response).toBeOK();
}

async function listUpdates(request: APIRequestContext, externalId: string, options: { limit?: number; cursor?: string | null } = {}): Promise<OperationalUpdatePullResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.cursor) params.set('cursor', options.cursor);
  params.set('channel', 'telegram');
  params.set('externalId', externalId);
  const query = params.toString();
  const response = await request.get(`${apiBaseUrl}/incidents/${incidentId}/cells/${cellId}/updates${query ? `?${query}` : ''}`);

  await expect(response).toBeOK();
  return (await response.json()) as OperationalUpdatePullResponse;
}

async function pullUpdatesUntil(request: APIRequestContext, externalId: string, predicate: (update: OperationalUpdate) => boolean): Promise<OperationalUpdate[]> {
  const pulled: OperationalUpdate[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 6; page += 1) {
    const response = await listUpdates(request, externalId, { limit: 10, cursor });
    pulled.push(...response.updates);
    if (pulled.some(predicate) || !response.hasMore || !response.cursor || response.cursor === cursor) {
      return pulled;
    }
    cursor = response.cursor;
  }

  return pulled;
}

async function postUpdateAction(request: APIRequestContext, updateId: string, action: 'ack' | 'open' | 'corroborate' | 'dispute' | 'links', data: Record<string, unknown>) {
  return request.post(`${apiBaseUrl}/incidents/${incidentId}/updates/${encodeURIComponent(updateId)}/${action}`, { data });
}

async function expectActionOk(responsePromise: Promise<Awaited<ReturnType<APIRequestContext['post']>>>): Promise<OperationalUpdateActionResponse> {
  const response = await responsePromise;
  await expect(response).toBeOK();
  return (await response.json()) as OperationalUpdateActionResponse;
}

async function expectLinkOk(responsePromise: Promise<Awaited<ReturnType<APIRequestContext['post']>>>): Promise<OperationalUpdateLinkResponse> {
  const response = await responsePromise;
  await expect(response).toBeOK();
  return (await response.json()) as OperationalUpdateLinkResponse;
}

async function fetchTrustState(request: APIRequestContext, subject: TrustSubject): Promise<TrustState> {
  const params = new URLSearchParams({ entityType: subject.entityType, entityId: subject.entityId });
  const response = await request.get(`${apiBaseUrl}/incidents/${incidentId}/trust-state?${params.toString()}`);
  await expect(response).toBeOK();
  return ((await response.json()) as { trustState: TrustState }).trustState;
}

function actionRequest(externalId: string, idempotencyKey: string) {
  return {
    channel: 'telegram',
    externalId,
    idempotencyKey,
    occurredAt: new Date().toISOString(),
  };
}

function noSensitiveManagementPermissions(): Partial<PermissionSnapshot> {
  return {
    canManageIncident: false,
    canManageLogistics: false,
    canManageMedical: false,
  };
}

async function runTelegramDryRun(scenario: 'proactive-updates'): Promise<DryRunResult> {
  const { stdout } = await execFileAsync('pnpm', ['exec', 'tsx', 'e2e/telegram/staging-telegram-runner.ts', 'dry-run', '--scenario', scenario, '--json'], {
    cwd: process.cwd().endsWith('/e2e') ? '..' : process.cwd(),
    env: process.env,
    maxBuffer: 1024 * 1024,
  });
  const resultLine = stdout
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.startsWith('TELEGRAM_E2E_RESULT_JSON='));

  if (!resultLine) {
    throw new Error(`Telegram dry-run did not emit JSON. Last stdout lines:\n${stdout.split(/\r?\n/).slice(-8).join('\n')}`);
  }

  const parsed = JSON.parse(resultLine.slice('TELEGRAM_E2E_RESULT_JSON='.length)) as DryRunResult;
  if (parsed.dryRun !== true || !Array.isArray(parsed.sentSteps)) {
    throw new Error('Telegram dry-run result did not include dry-run sent steps.');
  }
  return parsed;
}

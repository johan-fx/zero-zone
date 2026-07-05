import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { expect, test, type APIRequestContext } from '@playwright/test';

const execFileAsync = promisify(execFile);

// Keep these E2E payload mirrors local: e2e/tsconfig.json is intentionally
// standalone and the root package does not declare @zona-cero/contracts as a
// direct dependency. Update these unions with the shared contract vocabulary.
type Channel = 'telegram' | 'mobile' | 'web-ui';
type TrustSubjectEntityType = 'channel_identity' | 'incident_membership' | 'work_center' | 'resource_report' | 'dispatch_task' | 'sos_alert' | 'custom';
type TrustStatus = 'pending_corroboration' | 'self_declared' | 'field_attested' | 'trusted_by_context' | 'disputed' | 'degraded';
type TrustVisibility = 'normal' | 'elevated' | 'limited' | 'blocked';

type TrustSubject = {
  entityType: TrustSubjectEntityType;
  entityId: string;
  incidentId: string;
  displayRef?: string;
};

type TrustState = {
  status: TrustStatus;
  visibility: TrustVisibility;
  score: number;
  signalCount: number;
  disputeCount: number;
};

type TrustSignalCreateRequest = {
  channel: Channel;
  externalId: string;
  subject: TrustSubject;
  signalType: 'self_declaration' | 'presence_observed' | 'field_attestation' | 'context_corroboration' | 'reputation_reference' | 'negative_report';
  sourceKind?: 'self' | 'peer' | 'field_actor' | 'system_context' | 'coordinator';
  reason?: string;
  confidence?: number;
  occurredAt?: string;
};

type DisputeCreateRequest = {
  channel: Channel;
  externalId: string;
  subject: TrustSubject;
  reason: 'false_claim' | 'outdated' | 'unsafe_actor' | 'duplicate_identity' | 'context_mismatch' | 'other';
  description?: string;
  occurredAt?: string;
};

type IncidentJoinResponse = {
  membership: { permissions: { canManageIncident: boolean; canManageLogistics: boolean; canManageMedical: boolean } };
};

type TrustSignalCreateResponse = {
  trustSignal: { signalType: TrustSignalCreateRequest['signalType'] };
  trustState: TrustState;
  audit: { auditEventId: string };
  idempotent: boolean;
};

type DisputeCreateResponse = { trustState: TrustState };
type TrustStateResponse = { trustState: TrustState };

const apiBaseUrl = 'http://127.0.0.1:8787';
const incidentId = 'incident-zc-demo';

test.describe('Slice 20 social trust lifecycle', () => {
  test('command/API flow creates, corroborates, disputes, degrades trust without granting sensitive permissions', async ({ request }) => {
    const unique = `${Date.now()}-${test.info().workerIndex}`;
    const volunteerExternalId = `slice20-e2e-volunteer-${unique}`;
    const peerExternalId = `slice20-e2e-peer-${unique}`;

    const volunteer = await joinIncident(request, {
      channel: 'web-ui',
      externalId: volunteerExternalId,
      role: 'volunteer',
      displayName: 'Slice 20 E2E volunteer',
    });
    await joinIncident(request, {
      channel: 'web-ui',
      externalId: peerExternalId,
      role: 'logistics',
      displayName: 'Slice 20 E2E peer',
    });

    expect(volunteer.membership.permissions).toMatchObject({
      canManageIncident: false,
      canManageLogistics: false,
      canManageMedical: false,
    });

    const subject = trustSubject('work_center', `slice20-e2e-work-center-${unique}`, 'Slice 20 E2E work center');

    const created = await createTrustSignal(request, {
      channel: 'web-ui',
      externalId: volunteerExternalId,
      subject,
      signalType: 'self_declaration',
      reason: 'Command/API E2E creation path for Slice 20 social trust.',
      occurredAt: `2026-07-05T10:00:${String(test.info().workerIndex).padStart(2, '0')}.000Z`,
    });
    expect(created.trustSignal.signalType).toBe('self_declaration');
    expect(created.trustState.status).toBe('self_declared');
    expect(created.idempotent).toBe(false);

    const corroborated = await createTrustSignal(request, {
      channel: 'web-ui',
      externalId: peerExternalId,
      subject,
      signalType: 'field_attestation',
      sourceKind: 'field_actor',
      confidence: 0.95,
      reason: 'Peer corroborated the work center from the command/API E2E path.',
      occurredAt: '2026-07-05T10:01:00.000Z',
    });
    expect(corroborated.trustState.signalCount).toBeGreaterThanOrEqual(2);
    expect(corroborated.trustState.score).toBeGreaterThan(created.trustState.score);

    const disputed = await createDispute(request, {
      channel: 'web-ui',
      externalId: volunteerExternalId,
      subject,
      reason: 'false_claim',
      description: 'Command/API E2E dispute path; context must be checked before acting.',
      occurredAt: '2026-07-05T10:02:00.000Z',
    });
    expect(disputed.trustState).toMatchObject({ status: 'disputed', visibility: 'limited', disputeCount: 1 });

    const degradedSubject = trustSubject('work_center', `slice20-e2e-degraded-${unique}`, 'Slice 20 E2E degraded work center');
    const degraded = await createTrustSignal(request, {
      channel: 'web-ui',
      externalId: peerExternalId,
      subject: degradedSubject,
      signalType: 'negative_report',
      confidence: 0.9,
      reason: 'Command/API E2E degradation path.',
      occurredAt: '2026-07-05T10:03:00.000Z',
    });
    expect(degraded.trustState).toMatchObject({ status: 'degraded', visibility: 'limited' });
    expect(degraded.audit.auditEventId).toContain('trust_signal_degraded');

    const finalState = await fetchTrustState(request, subject);
    expect(finalState.trustState).toMatchObject({ status: 'disputed', visibility: 'limited' });

    const serializedTrustResponses = JSON.stringify({ created, corroborated, disputed, degraded, finalState });
    expect(serializedTrustResponses).not.toMatch(/canManageIncident|canManageLogistics|canManageMedical/i);

    const volunteerAfterTrust = await joinIncident(request, {
      channel: 'web-ui',
      externalId: volunteerExternalId,
      role: 'volunteer',
      displayName: 'Slice 20 E2E volunteer',
    });
    expect(volunteerAfterTrust.membership.permissions).toMatchObject({
      canManageIncident: false,
      canManageLogistics: false,
      canManageMedical: false,
    });
  });

  test('natural-language Telegram dry-run covers Slice 20 trust and dispute wording without secrets or staging mutation', async () => {
    const result = await runTelegramDryRun('social-trust');
    const labels = result.sentSteps.map((step) => step.label);

    expect(labels).toEqual([
      'social-trust-natural-corroboration',
      'social-trust-natural-dispute',
      'social-trust-context-boundary',
    ]);
    expect(result.marker).toContain('social-trust');
    expect(result.sentSteps[0]?.message).toMatch(/corroborar|confianza contextual/i);
    expect(result.sentSteps[1]?.message).toMatch(/disputo|verificar antes de actuar/i);
    expect(result.sentSteps[2]?.message).toMatch(/no concede permisos|no sustituye coordinación/i);
    expect(JSON.stringify(result)).not.toMatch(/TELEGRAM_E2E_API_HASH|SESSION|secret/i);
  });
});

type JoinIncidentInput = {
  channel: Channel;
  externalId: string;
  role: 'volunteer' | 'coordinator' | 'logistics' | 'medical';
  displayName: string;
};

type DryRunScenario = 'social-trust';

type DryRunResult = {
  marker: string;
  dryRun: true;
  sentSteps: { label: string; message: string; skipped?: boolean; botReplyPreview?: string }[];
};

async function joinIncident(request: APIRequestContext, input: JoinIncidentInput) {
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

async function createTrustSignal(request: APIRequestContext, payload: TrustSignalCreateRequest) {
  const response = await request.post(`${apiBaseUrl}/incidents/${incidentId}/trust-signals`, { data: payload });
  await expect(response).toBeOK();
  return (await response.json()) as TrustSignalCreateResponse;
}

async function createDispute(request: APIRequestContext, payload: DisputeCreateRequest) {
  const response = await request.post(`${apiBaseUrl}/incidents/${incidentId}/disputes`, { data: payload });
  await expect(response).toBeOK();
  return (await response.json()) as DisputeCreateResponse;
}

async function fetchTrustState(request: APIRequestContext, subject: TrustSubject) {
  const params = new URLSearchParams({ entityType: subject.entityType, entityId: subject.entityId });
  const response = await request.get(`${apiBaseUrl}/incidents/${incidentId}/trust-state?${params.toString()}`);
  await expect(response).toBeOK();
  return (await response.json()) as TrustStateResponse;
}

function trustSubject(entityType: TrustSubject['entityType'], entityId: string, displayRef: string): TrustSubject {
  return { entityType, entityId, incidentId, displayRef };
}

async function runTelegramDryRun(scenario: DryRunScenario): Promise<DryRunResult> {
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

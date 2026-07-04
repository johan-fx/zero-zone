import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';

type RequiredEnv = {
  TELEGRAM_E2E_API_ID: string;
  TELEGRAM_E2E_API_HASH: string;
  TELEGRAM_E2E_PHONE: string;
  TELEGRAM_E2E_BOT_USERNAME: string;
  TELEGRAM_E2E_SESSION_FILE: string;
  E2E_API_BASE_URL: string;
  E2E_WEB_UI_URL: string;
  E2E_INCIDENT_ID: string;
  E2E_CELL_ID: string;
};

type RunnerOptions = {
  dryRun?: boolean;
  includeSensitiveFlows?: boolean;
  marker?: string;
  scenario?: RunnerScenario;
  waitMs?: number;
};

type RunnerScenario = 'full' | 'natural-sos' | 'family-reunification' | 'dispatch' | 'incident-join';

type SentStep = {
  label: string;
  message: string;
  skipped?: boolean;
  botReplyPreview?: string;
};

type TelegramStep = SentStep & {
  expectedReplyPattern?: RegExp;
  settleAfterMs?: number;
};

type RunnerResult = {
  marker: string;
  commandWorkCenterMarker: string;
  naturalWorkCenterMarker: string;
  naturalSosMarker: string;
  familyReunificationMarker: string;
  dispatchMarker: string;
  incidentJoinMarker: string;
  dispatchTaskId?: string;
  preConfirmationMarkerVisible?: boolean;
  botUsername: string;
  incidentId: string;
  cellId: string;
  dryRun: boolean;
  sentSteps: SentStep[];
};

type DispatchEventCreatePayload = {
  category: string;
  quantityApprox: string;
  status?: 'pending';
  notes?: string;
};

type PendingSyncOperation = {
  version: 1;
  actorKeyId: string;
  deviceId: string;
  incidentId: string;
  cellId: string;
  entityId: string;
  entityType: 'dispatch_event';
  opType: 'dispatch_event.create';
  payload: DispatchEventCreatePayload;
  hlc: string;
  createdAtDevice: string;
  opId: string;
  signature: string;
  syncState: 'pending';
};

type SyncPushResult = {
  opId?: string;
  status: 'accepted' | 'rejected';
  code?: string;
};

type SyncPushResponseBody = {
  results: SyncPushResult[];
};

const requiredEnvKeys = [
  'TELEGRAM_E2E_API_ID',
  'TELEGRAM_E2E_API_HASH',
  'TELEGRAM_E2E_PHONE',
  'TELEGRAM_E2E_BOT_USERNAME',
  'TELEGRAM_E2E_SESSION_FILE',
  'E2E_API_BASE_URL',
  'E2E_WEB_UI_URL',
  'E2E_INCIDENT_ID',
  'E2E_CELL_ID',
] as const;

export async function authenticateTelegramSession(): Promise<void> {
  const env = readRunnerEnv();
  const client = await createTelegramClient(env, { requireInteractiveAuth: true });
  await persistSession(env, client);
  await client.disconnect();
  console.log('Telegram E2E session is ready. No secret values were printed.');
}

export async function runTelegramStagingFlow(options: RunnerOptions = {}): Promise<RunnerResult> {
  const env = readRunnerEnv({ allowPlaceholders: options.dryRun === true });
  const marker = options.marker ?? `e2e-${Date.now()}`;
  const commandWorkCenterMarker = `${marker}-command-wc`;
  const naturalWorkCenterMarker = `${marker}-natural-wc`;
  const naturalSosMarker = `${marker}-natural-sos`;
  const familyReunificationMarker = `${marker}-family-reunification`;
  const dispatchMarker = `${marker}-dispatch`;
  const incidentJoinMarker = `${marker}-incident-join`;
  const scenario = options.scenario ?? 'full';
  const dispatchTaskId = scenario === 'dispatch' ? buildDispatchTaskId(marker) : undefined;
  const resultMarker = scenario === 'natural-sos' ? naturalSosMarker : scenario === 'family-reunification' ? familyReunificationMarker : scenario === 'dispatch' ? dispatchMarker : scenario === 'incident-join' ? incidentJoinMarker : naturalWorkCenterMarker;
  const safeSteps = scenario === 'natural-sos'
    ? buildNaturalSosTelegramSequence(env, { marker })
    : scenario === 'family-reunification'
      ? buildFamilyReunificationTelegramSequence(env)
      : scenario === 'dispatch'
        ? buildDispatchTelegramSequence(env, { marker })
        : scenario === 'incident-join'
          ? buildIncidentJoinTelegramSequence(env, { marker, incidentJoinMarker })
          : buildSafeTelegramSequence(env, { marker, commandWorkCenterMarker, naturalWorkCenterMarker });
  const sensitiveSteps = scenario === 'full' ? buildSensitiveTelegramHelpers(marker).map((step) => ({ ...step, skipped: !options.includeSensitiveFlows })) : [];
  const steps: TelegramStep[] = [...safeSteps, ...sensitiveSteps];

  if (options.dryRun) {
    return {
      marker: resultMarker,
      commandWorkCenterMarker,
      naturalWorkCenterMarker,
      naturalSosMarker,
      familyReunificationMarker,
      dispatchMarker,
      incidentJoinMarker,
      ...(dispatchTaskId ? { dispatchTaskId } : {}),
      botUsername: env.TELEGRAM_E2E_BOT_USERNAME,
      incidentId: env.E2E_INCIDENT_ID,
      cellId: env.E2E_CELL_ID,
      dryRun: true,
      sentSteps: steps.map(toSentStep),
    };
  }

  if (scenario === 'dispatch') {
    await ensureDispatchTaskForStagingFlow(env, { marker, dispatchMarker });
  }

  const client = await createTelegramClient(env, { requireInteractiveAuth: false });
  const bot = await client.getEntity(env.TELEGRAM_E2E_BOT_USERNAME);
  const sentSteps: SentStep[] = [];
  let preConfirmationMarkerVisible: boolean | undefined;

  try {
    for (const step of steps) {
      if (step.skipped) {
        sentSteps.push(step);
        continue;
      }

      if (step.label === 'natural-workcenter-confirmation') {
        preConfirmationMarkerVisible = await findMarkerInStagingApi(naturalWorkCenterMarker, env);
      }

      const botReplyPreview = await sendMessageAndReadReply(client, bot, step.message, options.waitMs ?? 8_000, step.expectedReplyPattern);
      sentSteps.push(toSentStep({ ...step, botReplyPreview }));
      if (step.settleAfterMs) {
        await new Promise((resolve) => setTimeout(resolve, step.settleAfterMs));
      }
    }

    await persistSession(env, client);
  } finally {
    await client.disconnect();
  }

  return {
    marker: resultMarker,
    commandWorkCenterMarker,
    naturalWorkCenterMarker,
    naturalSosMarker,
    familyReunificationMarker,
    dispatchMarker,
    incidentJoinMarker,
    ...(dispatchTaskId ? { dispatchTaskId } : {}),
    preConfirmationMarkerVisible,
    botUsername: env.TELEGRAM_E2E_BOT_USERNAME,
    incidentId: env.E2E_INCIDENT_ID,
    cellId: env.E2E_CELL_ID,
    dryRun: false,
    sentSteps,
  };
}

export async function findMarkerInStagingApi(marker: string, env: Pick<RequiredEnv, 'E2E_API_BASE_URL' | 'E2E_INCIDENT_ID'> = readRunnerEnv()): Promise<boolean> {
  const baseUrl = env.E2E_API_BASE_URL.replace(/\/$/, '');
  const paths = [
    `/incidents/${encodeURIComponent(env.E2E_INCIDENT_ID)}/work-centers`,
    `/incidents/${encodeURIComponent(env.E2E_INCIDENT_ID)}/resource-reports`,
  ];

  for (const path of paths) {
    const response = await fetch(`${baseUrl}${path}`);
    if (!response.ok) continue;
    const body = await response.text();
    if (body.includes(marker)) return true;
  }

  return false;
}

async function ensureDispatchTaskForStagingFlow(env: RequiredEnv, markers: { marker: string; dispatchMarker: string }): Promise<void> {
  const baseUrl = env.E2E_API_BASE_URL.replace(/\/$/, '');
  const dispatchTaskId = buildDispatchTaskId(markers.marker);
  const createdAt = new Date().toISOString();
  const payload: DispatchEventCreatePayload = {
    category: `agua ${markers.marker}`,
    quantityApprox: `1 staging dispatch task ${markers.marker}`,
    notes: `Telegram dispatch E2E setup ${markers.dispatchMarker}`,
    status: 'pending',
  };
  const operation = createE2eDispatchTaskOperation({
    actorKeyId: 'e2e-telegram-staging',
    deviceId: 'e2e-telegram-runner',
    incidentId: env.E2E_INCIDENT_ID,
    cellId: env.E2E_CELL_ID,
    entityId: dispatchTaskId,
    opType: 'dispatch_event.create',
    payload,
    hlc: `${createdAt}:e2e-telegram-staging`,
    createdAtDevice: createdAt,
  });
  const response = await fetch(`${baseUrl}/incidents/${encodeURIComponent(env.E2E_INCIDENT_ID)}/cells/${encodeURIComponent(env.E2E_CELL_ID)}/sync/push`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operations: [operation], cursor: null }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create dispatch E2E task via sync push: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as SyncPushResponseBody;
  const result = body.results.find((candidate) => candidate.opId === operation.opId);
  if (!result || result.status !== 'accepted') {
    throw new Error(`Dispatch E2E task setup was not accepted: ${JSON.stringify(result ?? body.results)}`);
  }

  const visible = await findDispatchTaskInStagingApi(baseUrl, env.E2E_INCIDENT_ID, dispatchTaskId);
  if (!visible) {
    throw new Error(`Dispatch E2E task setup did not appear in staging API: ${dispatchTaskId}`);
  }
}

function createE2eDispatchTaskOperation(input: Omit<PendingSyncOperation, 'version' | 'opId' | 'entityType' | 'signature' | 'syncState'>): PendingSyncOperation {
  return {
    ...input,
    version: 1,
    opId: `op_${slugForE2eId(input.entityId)}`,
    entityType: 'dispatch_event',
    signature: `e2e-signature:${input.actorKeyId}:${input.entityId}`,
    syncState: 'pending',
  };
}

function buildDispatchTaskId(marker: string): string {
  return `dt_e2e_${slugForE2eId(marker)}`;
}

function slugForE2eId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

async function findDispatchTaskInStagingApi(apiBaseUrl: string, incidentId: string, dispatchTaskId: string): Promise<boolean> {
  const response = await fetch(`${apiBaseUrl}/incidents/${encodeURIComponent(incidentId)}/dispatch-tasks`);
  if (!response.ok) return false;
  const body = await response.text();
  return body.includes(dispatchTaskId);
}

function readRunnerEnv(options: { allowPlaceholders?: boolean } = {}): RequiredEnv {
  const missing = requiredEnvKeys.filter((key) => !process.env[key]);
  if (missing.length > 0 && !options.allowPlaceholders) {
    throw new Error(`Missing required E2E environment variables: ${missing.join(', ')}. Source e2e/telegram-e2e.local before running this command.`);
  }

  const env = Object.fromEntries(requiredEnvKeys.map((key) => [key, process.env[key] ?? dryRunEnvDefaults[key]])) as RequiredEnv;
  const apiId = env.TELEGRAM_E2E_API_ID;
  if (!/^\d+$/.test(apiId)) {
    throw new Error('TELEGRAM_E2E_API_ID must be a numeric Telegram API id.');
  }

  return env;
}

const dryRunEnvDefaults: RequiredEnv = {
  TELEGRAM_E2E_API_ID: '0',
  TELEGRAM_E2E_API_HASH: 'dry-run-api-hash',
  TELEGRAM_E2E_PHONE: '+10000000000',
  TELEGRAM_E2E_BOT_USERNAME: 'Zona_Cero_Bot_DRY_RUN',
  TELEGRAM_E2E_SESSION_FILE: 'e2e/.telegram-e2e.session.dry-run',
  E2E_API_BASE_URL: 'https://api.example.invalid',
  E2E_WEB_UI_URL: 'https://web.example.invalid',
  E2E_INCIDENT_ID: 'incident-zc-demo',
  E2E_CELL_ID: 'cell-zc-demo',
};

async function createTelegramClient(env: RequiredEnv, options: { requireInteractiveAuth: boolean }): Promise<TelegramClient> {
  const sessionText = await readSessionText(env.TELEGRAM_E2E_SESSION_FILE);
  const session = new StringSession(sessionText);
  const client = new TelegramClient(session, Number(env.TELEGRAM_E2E_API_ID), env.TELEGRAM_E2E_API_HASH, { connectionRetries: 5 });

  if (sessionText) {
    await client.connect();
    return client;
  }

  if (!options.requireInteractiveAuth) {
    throw new Error('Telegram E2E session is missing. Run pnpm e2e:telegram:auth first from a shell that has sourced e2e/telegram-e2e.local.');
  }

  const rl = readline.createInterface({ input, output });
  try {
    await client.start({
      phoneNumber: async () => env.TELEGRAM_E2E_PHONE,
      phoneCode: async () => rl.question('Telegram login code: '),
      password: async () => rl.question('Telegram 2FA password, if requested: '),
      onError: (error) => console.error('Telegram authentication error:', error.message),
    });
  } finally {
    rl.close();
  }

  return client;
}

async function readSessionText(path: string): Promise<string> {
  try {
    return (await readFile(path, 'utf8')).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

async function persistSession(env: RequiredEnv, client: TelegramClient): Promise<void> {
  const session = client.session.save() as unknown as string;
  if (!session) throw new Error('Telegram session was empty after authentication.');
  await mkdir(dirname(env.TELEGRAM_E2E_SESSION_FILE), { recursive: true });
  await writeFile(env.TELEGRAM_E2E_SESSION_FILE, `${session}\n`, { mode: 0o600 });
}

function buildSafeTelegramSequence(env: RequiredEnv, markers: { marker: string; commandWorkCenterMarker: string; naturalWorkCenterMarker: string }): TelegramStep[] {
  const { marker, commandWorkCenterMarker, naturalWorkCenterMarker } = markers;
  return [
    { label: 'start', message: '/start' },
    { label: 'join-incident', message: env.E2E_INCIDENT_ID },
    { label: 'join-pseudonym', message: `${marker} telegram e2e` },
    { label: 'join-role', message: 'logistics' },
    { label: 'language-command', message: '/idioma' },
    { label: 'language-selection', message: 'es' },
    { label: 'workcenter-command', message: '/workcenter' },
    { label: 'workcenter-incident', message: env.E2E_INCIDENT_ID },
    { label: 'workcenter-name', message: `${commandWorkCenterMarker} staging logistics point` },
    { label: 'workcenter-confirmation', message: 'yes' },
    { label: 'natural-workcenter-phrase', message: `El centro de trabajo se llama ${naturalWorkCenterMarker}. Está en la escuela, prioridad alta, y necesita medicamentos.` },
    { label: 'natural-workcenter-incident', message: env.E2E_INCIDENT_ID },
    { label: 'natural-workcenter-name-correction', message: `name: ${naturalWorkCenterMarker} medical post` },
    { label: 'natural-workcenter-confirmation', message: 'yes' },
    { label: 'resource-command', message: '/resource' },
    { label: 'resource-incident', message: env.E2E_INCIDENT_ID },
    { label: 'resource-kind', message: 'surplus' },
    { label: 'resource-category', message: `water ${marker}` },
    { label: 'resource-quantity', message: `5 sealed boxes ${marker}` },
    { label: 'resource-urgency', message: 'low' },
    { label: 'resource-constraints', message: 'none' },
    { label: 'resource-workcenter', message: 'skip' },
    { label: 'resource-confirmation', message: 'yes' },
    { label: 'natural-resource-phrase', message: `Tengo agua potable ${marker} disponible para entregar en staging.` },
    { label: 'natural-resource-incident', message: env.E2E_INCIDENT_ID },
    { label: 'natural-resource-kind', message: 'surplus' },
    { label: 'natural-resource-category', message: `agua potable ${marker}` },
    { label: 'natural-resource-quantity', message: `10 botellas selladas ${marker}` },
    { label: 'natural-resource-urgency', message: 'low' },
    { label: 'natural-resource-constraints', message: 'none' },
    { label: 'natural-resource-workcenter', message: 'skip' },
    { label: 'natural-resource-confirmation', message: 'yes' },
  ];
}

function buildSensitiveTelegramHelpers(marker: string): TelegramStep[] {
  return [
    { label: 'sos-helper-opt-in', message: `/sos drill ${marker}` },
    { label: 'natural-sos-helper-opt-in', message: 'Necesito ayuda médica urgente en el refugio norte. Hay humo y 3 personas afectadas.' },
    { label: 'family-reunification-helper-opt-in', message: `/reunificacion dry-run ${marker}` },
  ];
}

function buildNaturalSosTelegramSequence(env: RequiredEnv, markers: { marker: string }): TelegramStep[] {
  const { marker } = markers;
  return [
    { label: 'reset-cancel', message: '/cancel' },
    { label: 'start', message: '/start' },
    { label: 'join-incident', message: env.E2E_INCIDENT_ID },
    { label: 'join-pseudonym', message: `${marker} telegram sos e2e` },
    { label: 'join-role', message: 'medical' },
    { label: 'language-selection', message: '/idioma es' },
    {
      label: 'natural-sos-phrase',
      message: 'Necesito ayuda médica urgente en el refugio norte. Hay humo y 3 personas afectadas.',
    },
    { label: 'natural-sos-incident', message: env.E2E_INCIDENT_ID },
    { label: 'natural-sos-weak-confirmation', message: 'confirm' },
    { label: 'natural-sos-confirmation', message: 'CONFIRM SOS' },
  ];
}

function buildFamilyReunificationTelegramSequence(env: RequiredEnv): TelegramStep[] {
  return [
    { label: 'reset-cancel', message: '/cancel' },
    { label: 'language-selection', message: '/idioma es' },
    { label: 'family-reunification-command', message: '/reunificacion' },
    { label: 'family-reunification-command-incident', message: env.E2E_INCIDENT_ID },
    {
      label: 'family-reunification-natural-phrase',
      message: 'Necesito ayuda de reunificación familiar para encontrar a mi familiar.',
    },
    { label: 'family-reunification-natural-incident', message: env.E2E_INCIDENT_ID },
  ];
}

function buildDispatchTelegramSequence(env: RequiredEnv, markers: { marker: string }): TelegramStep[] {
  const { marker } = markers;
  return [
    { label: 'reset-cancel', message: '/cancel' },
    { label: 'language-selection', message: '/idioma es' },
    { label: 'dispatch-command', message: '/dispatch' },
    { label: 'dispatch-command-incident', message: env.E2E_INCIDENT_ID },
    { label: 'dispatch-command-task', message: '1' },
    { label: 'dispatch-command-status', message: 'en_route', expectedReplyPattern: /Confirm dispatch task update|Confirma|Reply yes to update/i },
    { label: 'dispatch-command-cancel', message: 'no', expectedReplyPattern: /cancelled|cancelada|cancelado/i },
    {
      label: 'dispatch-command-isolation-reset',
      message: '/cancel',
      expectedReplyPattern: /cancelled|cancelada|cancelado|No active|No hay/i,
      settleAfterMs: 2_000,
    },
    {
      label: 'dispatch-natural-phrase',
      message: `El equipo de despacho está en camino para la tarea de agua ${marker} hacia el centro norte.`,
      expectedReplyPattern: /Choose an incident|Elige un incidente|Choose a dispatch task|tarea de despacho/i,
    },
    { label: 'dispatch-natural-incident', message: env.E2E_INCIDENT_ID },
    { label: 'dispatch-natural-task', message: '1' },
    { label: 'dispatch-natural-cancel', message: 'no', expectedReplyPattern: /cancelled|cancelada|cancelado/i },
  ];
}

function buildIncidentJoinTelegramSequence(env: RequiredEnv, markers: { marker: string; incidentJoinMarker: string }): TelegramStep[] {
  const { marker, incidentJoinMarker } = markers;
  return [
    { label: 'incident-join-reset-cancel', message: '/cancel' },
    { label: 'incident-join-command-start', message: '/start', expectedReplyPattern: /Choose an incident|Elige un incidente/i },
    { label: 'incident-join-command-incident', message: env.E2E_INCIDENT_ID, expectedReplyPattern: /pseudonym|seudónimo/i },
    { label: 'incident-join-command-pseudonym', message: `${incidentJoinMarker} command pseudonym`, expectedReplyPattern: /Choose your role|Elige tu rol|Suggested role|Rol sugerido/i },
    { label: 'incident-join-command-role', message: 'volunteer', expectedReplyPattern: /Joined|Te uniste/i },
    {
      label: 'incident-join-natural-phrase',
      message: `I want to join incident ${env.E2E_INCIDENT_ID} as medical. Use ${marker} natural join as my display name and English as language.`,
      expectedReplyPattern: /Detected pseudonym|seudónimo|Choose an incident|Elige un incidente/i,
    },
    { label: 'incident-join-natural-pseudonym-confirmation', message: 'yes', expectedReplyPattern: /Suggested role|Rol sugerido|Choose your role|Elige tu rol/i },
    { label: 'incident-join-natural-role-confirmation', message: 'yes', expectedReplyPattern: /Joined|Te uniste/i },
  ];
}

async function sendMessageAndReadReply(client: TelegramClient, entity: any, message: string, waitMs: number, expectedReplyPattern?: RegExp): Promise<string | undefined> {
  const lastSeenId = await readLatestIncomingMessageId(client, entity);
  await client.sendMessage(entity, { message });

  const deadline = Date.now() + waitMs;
  let latestReply: string | undefined;
  while (Date.now() < deadline) {
    const messages = (await client.getMessages(entity, { limit: 5 })) as unknown[];
    const replies = messages
      .map(asTelegramMessage)
      .filter((candidate) => !candidate.out && candidate.id > lastSeenId && candidate.message.trim().length > 0);
    const repliesToInspect = expectedReplyPattern ? [...replies].sort((a, b) => a.id - b.id) : replies;

    for (const reply of repliesToInspect) {
      latestReply = preview(reply.message);
      if (!expectedReplyPattern || expectedReplyPattern.test(reply.message)) {
        return latestReply;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return latestReply;
}

async function readLatestIncomingMessageId(client: TelegramClient, entity: any): Promise<number> {
  const messages = (await client.getMessages(entity, { limit: 5 })) as unknown[];
  return messages.map(asTelegramMessage).filter((message) => !message.out).reduce((max, message) => Math.max(max, message.id), 0);
}

function asTelegramMessage(value: unknown): { id: number; out: boolean; message: string } {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id: typeof record.id === 'number' ? record.id : 0,
    out: record.out === true,
    message: typeof record.message === 'string' ? record.message : '',
  };
}

function preview(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function toSentStep(step: TelegramStep): SentStep {
  return {
    label: step.label,
    message: step.message,
    ...(step.skipped ? { skipped: true } : {}),
    ...(step.botReplyPreview ? { botReplyPreview: step.botReplyPreview } : {}),
  };
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'dry-run';
  const scenario = readScenarioArg(process.argv);

  if (command === 'auth') {
    await authenticateTelegramSession();
    return;
  }

  if (command === 'run' || command === 'dry-run') {
    const result = await runTelegramStagingFlow({
      dryRun: command === 'dry-run',
      includeSensitiveFlows: process.argv.includes('--include-sensitive-flows'),
      scenario,
    });
    if (process.argv.includes('--json')) {
      console.log(`TELEGRAM_E2E_RESULT_JSON=${JSON.stringify(result)}`);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log('Usage: tsx e2e/telegram/staging-telegram-runner.ts <auth|dry-run|run> [--scenario full|natural-sos|family-reunification|dispatch|incident-join] [--include-sensitive-flows] [--json]');
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function readScenarioArg(argv: string[]): RunnerScenario {
  const index = argv.indexOf('--scenario');
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (value === undefined) return 'full';
  if (value === 'full' || value === 'natural-sos' || value === 'family-reunification' || value === 'dispatch' || value === 'incident-join') return value;
  throw new Error(`Unknown Telegram E2E scenario: ${value}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

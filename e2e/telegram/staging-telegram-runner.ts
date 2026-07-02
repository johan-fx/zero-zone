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

type RunnerScenario = 'full' | 'natural-sos';

type SentStep = {
  label: string;
  message: string;
  skipped?: boolean;
  botReplyPreview?: string;
};

type RunnerResult = {
  marker: string;
  commandWorkCenterMarker: string;
  naturalWorkCenterMarker: string;
  naturalSosMarker: string;
  preConfirmationMarkerVisible?: boolean;
  botUsername: string;
  incidentId: string;
  cellId: string;
  dryRun: boolean;
  sentSteps: SentStep[];
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
  const scenario = options.scenario ?? 'full';
  const resultMarker = scenario === 'natural-sos' ? naturalSosMarker : naturalWorkCenterMarker;
  const safeSteps = scenario === 'natural-sos'
    ? buildNaturalSosTelegramSequence(env, { marker })
    : buildSafeTelegramSequence(env, { marker, commandWorkCenterMarker, naturalWorkCenterMarker });
  const sensitiveSteps = scenario === 'full' ? buildSensitiveTelegramHelpers(marker).map((step) => ({ ...step, skipped: !options.includeSensitiveFlows })) : [];
  const steps = [...safeSteps, ...sensitiveSteps];

  if (options.dryRun) {
    return {
      marker: resultMarker,
      commandWorkCenterMarker,
      naturalWorkCenterMarker,
      naturalSosMarker,
      botUsername: env.TELEGRAM_E2E_BOT_USERNAME,
      incidentId: env.E2E_INCIDENT_ID,
      cellId: env.E2E_CELL_ID,
      dryRun: true,
      sentSteps: steps.map((step) => ({ ...step, botReplyPreview: undefined })),
    };
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

      const botReplyPreview = await sendMessageAndReadReply(client, bot, step.message, options.waitMs ?? 8_000);
      sentSteps.push({ ...step, botReplyPreview });
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

function buildSafeTelegramSequence(env: RequiredEnv, markers: { marker: string; commandWorkCenterMarker: string; naturalWorkCenterMarker: string }): SentStep[] {
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

function buildSensitiveTelegramHelpers(marker: string): SentStep[] {
  return [
    { label: 'sos-helper-opt-in', message: `/sos drill ${marker}` },
    { label: 'natural-sos-helper-opt-in', message: 'Necesito ayuda médica urgente en el refugio norte. Hay humo y 3 personas afectadas.' },
    { label: 'family-reunification-helper-opt-in', message: `/reunificacion dry-run ${marker}` },
  ];
}

function buildNaturalSosTelegramSequence(env: RequiredEnv, markers: { marker: string }): SentStep[] {
  const { marker } = markers;
  return [
    { label: 'start', message: '/start' },
    { label: 'join-incident', message: env.E2E_INCIDENT_ID },
    { label: 'join-pseudonym', message: `${marker} telegram sos e2e` },
    { label: 'join-role', message: 'medical' },
    { label: 'language-command', message: '/idioma' },
    { label: 'language-selection', message: 'es' },
    { label: 'sos-command', message: '/sos' },
    { label: 'sos-command-incident', message: env.E2E_INCIDENT_ID },
    { label: 'sos-command-cancel', message: '/cancel' },
    {
      label: 'natural-sos-phrase',
      message: 'Necesito ayuda médica urgente en el refugio norte. Hay humo y 3 personas afectadas.',
    },
    { label: 'natural-sos-incident', message: env.E2E_INCIDENT_ID },
    { label: 'natural-sos-weak-confirmation', message: 'confirm' },
    { label: 'natural-sos-confirmation', message: 'CONFIRM SOS' },
  ];
}

async function sendMessageAndReadReply(client: TelegramClient, entity: any, message: string, waitMs: number): Promise<string | undefined> {
  const lastSeenId = await readLatestIncomingMessageId(client, entity);
  await client.sendMessage(entity, { message });

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const messages = (await client.getMessages(entity, { limit: 5 })) as unknown[];
    const reply = messages
      .map(asTelegramMessage)
      .find((candidate) => !candidate.out && candidate.id > lastSeenId && candidate.message.trim().length > 0);

    if (reply) return preview(reply.message);
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return undefined;
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
    console.log('Usage: tsx e2e/telegram/staging-telegram-runner.ts <auth|dry-run|run> [--scenario full|natural-sos] [--include-sensitive-flows] [--json]');
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function readScenarioArg(argv: string[]): RunnerScenario {
  const index = argv.indexOf('--scenario');
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (value === undefined) return 'full';
  if (value === 'full' || value === 'natural-sos') return value;
  throw new Error(`Unknown Telegram E2E scenario: ${value}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { chromium, expect, test } from '@playwright/test';

const execFileAsync = promisify(execFile);
const realStagingEnabled = process.env.E2E_STAGING_TELEGRAM_REAL === '1';

test.skip(!realStagingEnabled, 'Set E2E_STAGING_TELEGRAM_REAL=1 and source e2e/telegram-e2e.local to run the real staging Telegram E2E flow.');

test('staging Telegram -> API/D1 -> Web UI exposes the E2E marker', async ({ request }) => {
  const webUrl = requiredEnv('E2E_WEB_UI_URL');
  const apiBaseUrl = requiredEnv('E2E_API_BASE_URL').replace(/\/$/, '');
  const incidentId = requiredEnv('E2E_INCIDENT_ID');

  await ensureTelegramSessionExists();

  const health = await request.get(`${apiBaseUrl}/health`);
  await expect(health).toBeOK();

  const result = await runTelegramRunner();

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(webUrl, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    const markerInUi = await waitForMarkerInUi(page, result.marker);
    if (markerInUi) return;
  } finally {
    await browser.close();
  }

  await expect
    .poll(async () => findMarkerInStagingApi(apiBaseUrl, incidentId, result.marker), {
      timeout: 30_000,
      intervals: [1_000, 2_000, 5_000],
      message: `Expected staging API fallback to expose marker ${result.marker}`,
    })
    .toBe(true);
});

async function ensureTelegramSessionExists(): Promise<void> {
  const sessionFile = requiredEnv('TELEGRAM_E2E_SESSION_FILE');
  try {
    await access(sessionFile, constants.R_OK);
  } catch {
    throw new Error('Telegram E2E session is missing. Run `set -a; source e2e/telegram-e2e.local; set +a; pnpm e2e:telegram:auth` before the real staging test.');
  }
}

async function runTelegramRunner(): Promise<{ marker: string }> {
  const { stdout } = await execFileAsync('pnpm', ['tsx', 'e2e/telegram/staging-telegram-runner.ts', 'run', '--json'], {
    cwd: process.cwd().endsWith('/e2e') ? '..' : process.cwd(),
    env: process.env,
    maxBuffer: 1024 * 1024,
  });
  const parsed = parseRunnerResult(stdout);
  if (typeof parsed.marker !== 'string' || !parsed.marker.startsWith('e2e-')) {
    throw new Error('Telegram runner did not return a valid E2E marker.');
  }
  return { marker: parsed.marker };
}

function parseRunnerResult(stdout: string): { marker?: unknown } {
  const resultLine = stdout
    .split(/\r?\n/)
    .reverse()
    .find((line) => line.startsWith('TELEGRAM_E2E_RESULT_JSON='));

  if (!resultLine) {
    throw new Error(`Telegram runner did not emit TELEGRAM_E2E_RESULT_JSON. Last stdout lines:\n${stdout.split(/\r?\n/).slice(-8).join('\n')}`);
  }

  return JSON.parse(resultLine.slice('TELEGRAM_E2E_RESULT_JSON='.length)) as { marker?: unknown };
}

async function waitForMarkerInUi(page: import('@playwright/test').Page, marker: string): Promise<boolean> {
  try {
    await page.getByText(marker, { exact: false }).first().waitFor({ state: 'visible', timeout: 7_500 });
    return true;
  } catch {
    return false;
  }
}

async function findMarkerInStagingApi(apiBaseUrl: string, incidentId: string, marker: string): Promise<boolean> {
  const paths = [
    `/incidents/${encodeURIComponent(incidentId)}/work-centers`,
    `/incidents/${encodeURIComponent(incidentId)}/resource-reports`,
  ];

  for (const path of paths) {
    const response = await fetch(`${apiBaseUrl}${path}`);
    if (!response.ok) continue;
    const body = await response.text();
    if (body.includes(marker)) return true;
  }

  return false;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

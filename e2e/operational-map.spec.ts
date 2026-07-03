import { expect, test, type APIRequestContext } from '@playwright/test';

const apiBaseUrl = 'http://127.0.0.1:8787';
const screenshotPath = 'test-results/operational-map-dashboard.png';
const barcelonaLocation = { latitude: 41.39021, longitude: 2.15401 };
const publicBarcelonaLocation = roundPublicLocation(barcelonaLocation);

test('operational map shows a Telegram work center with native location', async ({ page, request }) => {
  const uniqueSuffix = `${Date.now()}-${test.info().workerIndex}`;
  const workCenterName = `E2E Barcelona work center ${uniqueSuffix}`;
  const telegramUserId = Number(`89${uniqueSuffix.replace(/\D/g, '').slice(-7).padStart(7, '0')}`);

  await joinIncidentAsLogistics(request, telegramUserId);

  await expectTelegramResponse(sendTelegramMessage(request, telegramUserId, '/workcenter', 10), /Choose an incident/);
  await expectTelegramResponse(sendTelegramMessage(request, telegramUserId, '1', 11), /Send the work center name/);
  await expectTelegramResponse(sendTelegramMessage(request, telegramUserId, workCenterName, 12), /Confirm work center report/);
  await expectTelegramResponse(sendTelegramLocation(request, telegramUserId, barcelonaLocation, 13), /Approximate coordinates/);
  await expectTelegramResponse(sendTelegramMessage(request, telegramUserId, 'yes', 14), /Work center reported/);

  await expect
    .poll(async () => findWorkCenterMarker(request, workCenterName), {
      timeout: 15_000,
      intervals: [500, 1_000, 2_000],
      message: `Expected ${workCenterName} to appear in the ES operational map`,
    })
    .toMatchObject({
      name: workCenterName,
      location: {
        latitude: publicBarcelonaLocation.latitude,
        longitude: publicBarcelonaLocation.longitude,
      },
    });

  await page.goto('/#/map');

  await expect(page.getByRole('heading', { name: 'Map overview' })).toBeVisible();
  await expect(page.getByLabel('Country')).toBeVisible();
  await page.getByLabel('Country').selectOption('ES');

  const mapPanel = page.getByTestId('operations-map-panel');
  await expect(mapPanel.getByLabel('Operational map counts')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Map items' })).toBeVisible();

  const workCenterItem = page.getByRole('listitem').filter({ hasText: workCenterName });
  await expect(workCenterItem).toContainText('work center');
  await expect(workCenterItem).toContainText(publicBarcelonaLocation.latitude.toFixed(4));
  await expect(workCenterItem).toContainText(publicBarcelonaLocation.longitude.toFixed(4));

  await mapPanel.screenshot({ path: screenshotPath });
});


type TelegramWebhookResponse = {
  accepted: true;
  command: string | null;
  responseText: string;
};

async function joinIncidentAsLogistics(request: APIRequestContext, userId: number) {
  await expectTelegramResponse(sendTelegramMessage(request, userId, '/start', 1), /Choose an incident/);
  await expectTelegramResponse(sendTelegramMessage(request, userId, '1', 2), /What pseudonym should we show/);
  await expectTelegramResponse(sendTelegramMessage(request, userId, 'E2E Logistics Operator', 3), /Choose your role/);
  await expectTelegramResponse(sendTelegramMessage(request, userId, 'logistics', 4), /Joined .* as logistics/);
}

async function sendTelegramMessage(request: APIRequestContext, userId: number, text: string, messageId: number): Promise<TelegramWebhookResponse> {
  const response = await request.post(`${apiBaseUrl}/telegram/webhook`, {
    data: telegramUpdate(userId, messageId, { text }),
  });

  await expect(response).toBeOK();
  const body = await response.json() as TelegramWebhookResponse;
  expect(body).toMatchObject({ accepted: true });
  return body;
}

async function sendTelegramLocation(
  request: APIRequestContext,
  userId: number,
  location: { latitude: number; longitude: number },
  messageId: number,
): Promise<TelegramWebhookResponse> {
  const response = await request.post(`${apiBaseUrl}/telegram/webhook`, {
    data: telegramUpdate(userId, messageId, { location }),
  });

  await expect(response).toBeOK();
  const body = await response.json() as TelegramWebhookResponse;
  expect(body).toMatchObject({ accepted: true });
  return body;
}

async function expectTelegramResponse(response: Promise<TelegramWebhookResponse>, expectedResponseText: RegExp) {
  await expect((await response).responseText).toMatch(expectedResponseText);
}

function telegramUpdate(
  userId: number,
  messageId: number,
  message: { text?: string; location?: { latitude: number; longitude: number } },
) {
  return {
    update_id: userId * 10 + messageId,
    message: {
      message_id: messageId,
      date: Math.floor(Date.now() / 1_000),
      chat: { id: userId, type: 'private' },
      from: { id: userId, first_name: 'E2E Operator', language_code: 'en' },
      ...message,
    },
  };
}

async function findWorkCenterMarker(request: APIRequestContext, workCenterName: string) {
  const response = await request.get(`${apiBaseUrl}/map?countryCode=ES`);
  await expect(response).toBeOK();
  const map = await response.json();

  return map.workCenters.find((workCenter: { name: string }) => workCenter.name === workCenterName) ?? null;
}

function roundPublicLocation(location: { latitude: number; longitude: number }) {
  return {
    latitude: Number(location.latitude.toFixed(2)),
    longitude: Number(location.longitude.toFixed(2)),
  };
}

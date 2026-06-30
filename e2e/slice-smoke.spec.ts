import { expect, test } from '@playwright/test';

import { telegramStartUpdateFixture } from '@zona-cero/testing';

test('slice smoke: web ui, api health, and telegram webhook are wired together', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /work centers live operations panel/i })).toBeVisible();
  await expect(page.getByTestId('api-health')).toContainText('zona-cero-api is online');
  await expect(page.getByRole('heading', { name: /^work centers$/i })).toBeVisible();

  const health = await request.get('http://127.0.0.1:8787/health');
  await expect(health).toBeOK();

  const webhook = await request.post('http://127.0.0.1:8787/telegram/webhook', {
    data: telegramStartUpdateFixture,
  });
  await expect(webhook).toBeOK();
  await expect(await webhook.json()).toMatchObject({ accepted: true, command: '/start' });
});

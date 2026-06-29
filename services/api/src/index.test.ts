import { describe, expect, it } from 'vitest';

import { createSignedOperationFixture, telegramStartUpdateFixture } from '@zona-cero/testing';
import { app } from './index';

const env = { API_VERSION: 'test-version' } as Env;

describe('api worker', () => {
  it('serves a stable health response', async () => {
    const response = await app.request('/health', {}, env);

    await expect(response.json()).resolves.toEqual({ service: 'zona-cero-api', ok: true, version: 'test-version' });
  });

  it('accepts contract-valid sync push operations', async () => {
    const response = await app.request(
      '/sync/push',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operations: [createSignedOperationFixture({ opId: 'op-api-1' })] }),
      },
      env,
    );

    await expect(response.json()).resolves.toEqual({ results: [{ opId: 'op-api-1', status: 'accepted' }] });
  });

  it('routes Telegram webhook updates through the telegram-channel workspace', async () => {
    const response = await app.request(
      '/telegram/webhook',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(telegramStartUpdateFixture),
      },
      env,
    );

    await expect(response.json()).resolves.toMatchObject({ accepted: true, command: '/start' });
  });
});

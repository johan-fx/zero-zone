import { describe, expect, it } from 'vitest';

import { telegramStartUpdateFixture } from '@zona-cero/testing';
import { handleTelegramWebhookUpdate, resolveTelegramCommand } from './index';

describe('telegram channel flows', () => {
  it('resolves slash commands without owning a runtime server', () => {
    expect(resolveTelegramCommand(telegramStartUpdateFixture)).toBe('/start');
  });

  it('returns a stable start flow response for API webhook integration', () => {
    expect(handleTelegramWebhookUpdate(telegramStartUpdateFixture)).toMatchObject({
      accepted: true,
      command: '/start',
      responseText: expect.stringContaining('Zona Cero'),
    });
  });
});

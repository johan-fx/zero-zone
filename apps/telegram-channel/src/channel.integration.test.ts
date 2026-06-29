import { describe, expect, it } from 'vitest';

import { TelegramWebhookResultSchema } from '@zona-cero/contracts';
import { telegramStartUpdateFixture } from '@zona-cero/testing';
import { handleTelegramWebhookUpdate } from './index';

describe('telegram channel contract integration', () => {
  it('emits webhook results accepted by shared contracts', () => {
    expect(TelegramWebhookResultSchema.parse(handleTelegramWebhookUpdate(telegramStartUpdateFixture)).accepted).toBe(true);
  });
});

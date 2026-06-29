import { describe, expect, it } from 'vitest';

import { SignedOperationSchema } from '@zona-cero/contracts';
import { createSignedOperationFixture, telegramStartUpdateFixture } from './index';

describe('testing package', () => {
  it('creates contract-valid signed operation fixtures', () => {
    expect(SignedOperationSchema.parse(createSignedOperationFixture({ opId: 'op-custom' })).opId).toBe('op-custom');
  });

  it('exposes a Telegram start update fixture for integration and e2e tests', () => {
    expect(telegramStartUpdateFixture.message.text).toBe('/start');
  });
});

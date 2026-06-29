import { describe, expect, it } from 'vitest';

import { HealthResponseSchema } from '@zona-cero/contracts';
import { app } from './index';

const env = { API_VERSION: 'integration-test' } as Env;

describe('api contract integration', () => {
  it('returns health payloads accepted by shared contracts', async () => {
    const response = await app.request('/health', {}, env);
    expect(HealthResponseSchema.parse(await response.json()).version).toBe('integration-test');
  });
});

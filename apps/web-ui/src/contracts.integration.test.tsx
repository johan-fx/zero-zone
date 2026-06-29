import { describe, expect, it, vi } from 'vitest';

import { fetchApiHealth } from './api';

describe('web ui contract integration', () => {
  it('parses API health through the shared health contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ service: 'zona-cero-api', ok: true, version: 'integration' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(fetchApiHealth(fetcher)).resolves.toEqual({ service: 'zona-cero-api', ok: true, version: 'integration' });
  });
});

import { describe, expect, it } from 'vitest';

import { canonicalizePayload, sha256Hex } from './index';

describe('crypto package', () => {
  it('canonicalizes payload key order before signing', () => {
    expect(canonicalizePayload({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it('hashes canonical payloads with WebCrypto-compatible APIs', async () => {
    await expect(sha256Hex('zona-cero')).resolves.toHaveLength(64);
  });
});

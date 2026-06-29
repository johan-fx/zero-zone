import { describe, expect, it } from 'vitest';

import { zonaCeroWorkspaceConfig } from './index';

describe('workspace config package', () => {
  it('documents the shared TypeScript and test baseline', () => {
    expect(zonaCeroWorkspaceConfig).toMatchObject({ typescript: 'strict', testRunner: 'vitest' });
  });
});

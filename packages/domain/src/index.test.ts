import { describe, expect, it } from 'vitest';

import { canAccessRestrictedIncidentData, canChannelSubmitOperation, isCriticalOperation } from './index';

describe('domain package', () => {
  it('keeps sensitive permissions behind org verification', () => {
    expect(canAccessRestrictedIncidentData('field_attested')).toBe(false);
    expect(canAccessRestrictedIncidentData('org_verified')).toBe(true);
  });

  it('prevents web-ui from inventing native presence operations', () => {
    expect(canChannelSubmitOperation('web-ui', 'presence.check_in')).toBe(false);
    expect(canChannelSubmitOperation('telegram', 'resource_report.create')).toBe(true);
  });

  it('marks SOS as a critical operation family', () => {
    expect(isCriticalOperation('sos.create')).toBe(true);
  });
});

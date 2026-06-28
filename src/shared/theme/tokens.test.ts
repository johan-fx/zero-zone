/// <reference types="jest" />
import { operationalControlHeights, operationalRadii } from './tokens';

describe('operational visual fidelity tokens', () => {
  it('uses compact radii calibrated against the mockups', () => {
    expect(operationalRadii.control).toBe(12);
    expect(operationalRadii.card).toBe(18);
    expect(operationalRadii.panel).toBe(24);
    expect(operationalRadii.pill).toBe(999);
  });

  it('separates normal and critical action heights', () => {
    expect(operationalControlHeights.action).toBe(44);
    expect(operationalControlHeights.criticalAction).toBe(48);
    expect(operationalControlHeights.badge).toBe(30);
  });
});

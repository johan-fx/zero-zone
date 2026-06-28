/// <reference types="jest" />
import { operationalControlHeights, operationalRadii, operationalThemePalettes } from './tokens';

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

  it('uses a deep critical surface and light critical text for night SOS states', () => {
    expect(operationalThemePalettes.dark.criticalSurface).toBe('#3A070A');
    expect(operationalThemePalettes.dark.criticalText).toBe('#FFF1F2');
    expect(operationalThemePalettes.dark.sosSurface).not.toBe('#FF4D4F');
  });
});

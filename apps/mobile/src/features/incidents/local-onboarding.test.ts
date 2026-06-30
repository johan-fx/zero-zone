import { IncidentConfigResponseSchema, IncidentJoinRequestSchema } from '@zona-cero/contracts';
import { incidentConfigHappyFixture, mobileIncidentJoinRequestFixture, mobileIncidentJoinResponseFixture } from '@zona-cero/testing';

import { createInMemoryLocalOnboardingStore, createLocalOnboardingService } from './local-onboarding';

describe('local onboarding', () => {
  const fixedNow = '2026-06-30T10:00:00.000Z';

  function createService() {
    return createLocalOnboardingService({
      store: createInMemoryLocalOnboardingStore(),
      generateLocalActorId: () => mobileIncidentJoinRequestFixture.externalId,
      generateLocalIncidentId: () => 'incident-zc-demo',
      now: () => fixedNow,
    });
  }

  it('creates a local identity offline without network input', async () => {
    const service = createService();

    const state = await service.start({ pseudonym: ' Field Mobile ', selfDeclaredRole: 'medical', incidentName: 'Demo incident' });

    expect(state).toMatchObject({
      localActorId: 'mobile-device-1001',
      pseudonym: 'Field Mobile',
      selfDeclaredRole: 'medical',
      selectedIncidentId: 'incident-zc-demo',
      sync: { status: 'local_pending' },
    });
    expect(state.localIncidentView).toMatchObject({ incidentId: 'incident-zc-demo', name: 'Demo incident', status: 'local_pending' });
  });

  it('preserves the local identity and self-declared role through persisted reloads', async () => {
    const store = createInMemoryLocalOnboardingStore();
    const service = createLocalOnboardingService({
      store,
      generateLocalActorId: () => 'local-actor-original',
      generateLocalIncidentId: () => 'incident-local-original',
      now: () => fixedNow,
    });

    await service.start({ pseudonym: 'Marta', selfDeclaredRole: 'logistics' });
    const reloadedService = createLocalOnboardingService({
      store,
      generateLocalActorId: () => 'local-actor-should-not-replace',
      now: () => '2026-06-30T11:00:00.000Z',
    });

    const reloaded = await reloadedService.load();

    expect(reloaded?.localActorId).toBe('local-actor-original');
    expect(reloaded?.selfDeclaredRole).toBe('logistics');
  });

  it('prepares a mobile join/config request compatible with shared contracts', async () => {
    const service = createService();
    const state = await service.start({ pseudonym: 'Field Mobile', selfDeclaredRole: 'medical' });

    const joinRequest = service.prepareJoinRequest(state);

    expect(IncidentJoinRequestSchema.parse(joinRequest)).toEqual(mobileIncidentJoinRequestFixture);
    expect(service.prepareConfigRequest(state)).toEqual({ incidentId: 'incident-zc-demo' });
  });

  it('applies remote config and stores the received permission snapshot without recalculating permissions', async () => {
    const service = createService();
    const state = await service.start({ pseudonym: 'Field Mobile', selfDeclaredRole: 'medical' });
    const config = IncidentConfigResponseSchema.parse(incidentConfigHappyFixture);

    const reconciled = service.applyIncidentConfig(state, config, '2026-06-30T10:05:00.000Z');

    expect(reconciled.sync.status).toBe('config_loaded');
    expect(reconciled.sync.permissionSnapshot).toBe(config.permissionSnapshots.medical);
    expect(reconciled.localIncidentView).toMatchObject({ incidentId: 'incident-zc-demo', status: 'remote_confirmed' });
  });

  it('rejects remote config for a different incident', async () => {
    const service = createService();
    const state = await service.start({ pseudonym: 'Field Mobile', selfDeclaredRole: 'medical' });
    const config = IncidentConfigResponseSchema.parse({
      ...incidentConfigHappyFixture,
      incident: { ...incidentConfigHappyFixture.incident, incidentId: 'incident-zc-other' },
    });

    expect(() => service.applyIncidentConfig(state, config, '2026-06-30T10:05:00.000Z')).toThrow(
      'Remote incident incident-zc-other does not match selected incident incident-zc-demo',
    );
  });

  it('applies join confirmation using backend membership permissions', async () => {
    const service = createService();
    const state = await service.start({ pseudonym: 'Field Mobile', selfDeclaredRole: 'medical' });

    const confirmed = service.applyJoinResponse(state, mobileIncidentJoinResponseFixture, '2026-06-30T10:10:00.000Z');

    expect(confirmed.sync.status).toBe('remote_confirmed');
    expect(confirmed.sync.permissionSnapshot).toBe(mobileIncidentJoinResponseFixture.membership.permissions);
    expect(confirmed.sync.confirmedMembershipId).toBe(mobileIncidentJoinResponseFixture.membership.incidentMembershipId);
  });

  it('rejects join confirmation for a different incident', async () => {
    const service = createService();
    const state = await service.start({ pseudonym: 'Field Mobile', selfDeclaredRole: 'medical' });
    const response = {
      ...mobileIncidentJoinResponseFixture,
      incident: { ...mobileIncidentJoinResponseFixture.incident, incidentId: 'incident-zc-other' },
    };

    expect(() => service.applyJoinResponse(state, response, '2026-06-30T10:10:00.000Z')).toThrow(
      'Remote incident incident-zc-other does not match selected incident incident-zc-demo',
    );
  });
});

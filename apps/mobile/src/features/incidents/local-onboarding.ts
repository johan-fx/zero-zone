import { useCallback, useEffect, useMemo, useState } from 'react';

import type { IncidentConfigResponse, IncidentJoinRequest, IncidentJoinResponse, IncidentRole, IncidentSummary, PermissionSnapshot } from '@zona-cero/contracts';

export type LocalIncidentView = {
  incidentId: string;
  name: string;
  status: 'local_pending' | 'remote_confirmed';
  startsAt?: string;
  locationName?: string;
  createdAtDevice: string;
};

export type LocalOnboardingSyncState =
  | { status: 'local_pending'; permissionSnapshot?: undefined; config?: undefined; confirmedMembershipId?: undefined }
  | { status: 'remote_confirmed'; permissionSnapshot: PermissionSnapshot; config?: undefined; confirmedMembershipId: string }
  | { status: 'config_loaded'; permissionSnapshot: PermissionSnapshot; config: IncidentConfigResponse; confirmedMembershipId?: string };

export type LocalOnboardingState = {
  localActorId: string;
  pseudonym: string;
  selfDeclaredRole: IncidentRole;
  selectedIncidentId: string;
  localIncidentView: LocalIncidentView;
  sync: LocalOnboardingSyncState;
  updatedAtDevice: string;
};

export type StartLocalOnboardingInput = {
  pseudonym: string;
  selfDeclaredRole: IncidentRole;
  selectedIncidentId?: string;
  incidentName?: string;
  now?: string;
};

export type LocalOnboardingStore = {
  load(): Promise<LocalOnboardingState | null>;
  save(state: LocalOnboardingState): Promise<void>;
};

export type LocalOnboardingService = {
  start(input: StartLocalOnboardingInput): Promise<LocalOnboardingState>;
  load(): Promise<LocalOnboardingState | null>;
  prepareJoinRequest(state: LocalOnboardingState): IncidentJoinRequest;
  prepareConfigRequest(state: LocalOnboardingState): { incidentId: string };
  applyIncidentConfig(state: LocalOnboardingState, config: IncidentConfigResponse, now?: string): LocalOnboardingState;
  applyJoinResponse(state: LocalOnboardingState, response: IncidentJoinResponse, now?: string): LocalOnboardingState;
  save(state: LocalOnboardingState): Promise<void>;
};

export type CreateLocalOnboardingServiceOptions = {
  store: LocalOnboardingStore;
  generateLocalActorId?: () => string;
  generateLocalIncidentId?: () => string;
  now?: () => string;
};

export type UseLocalOnboardingResult = {
  state: LocalOnboardingState | null;
  isLoading: boolean;
  start(input: StartLocalOnboardingInput): Promise<LocalOnboardingState>;
  prepareJoinRequest(): IncidentJoinRequest | null;
  prepareConfigRequest(): { incidentId: string } | null;
  applyIncidentConfig(config: IncidentConfigResponse): LocalOnboardingState | null;
  applyJoinResponse(response: IncidentJoinResponse): LocalOnboardingState | null;
};

export function useLocalOnboarding(service: LocalOnboardingService): UseLocalOnboardingResult {
  const [state, setState] = useState<LocalOnboardingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    service.load().then((loadedState) => {
      if (active) {
        setState(loadedState);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [service]);

  const start = useCallback(
    async (input: StartLocalOnboardingInput) => {
      const nextState = await service.start(input);
      setState(nextState);
      return nextState;
    },
    [service],
  );

  const prepareJoinRequest = useCallback(() => (state ? service.prepareJoinRequest(state) : null), [service, state]);
  const prepareConfigRequest = useCallback(() => (state ? service.prepareConfigRequest(state) : null), [service, state]);

  const applyIncidentConfig = useCallback(
    (config: IncidentConfigResponse) => {
      if (!state) {
        return null;
      }

      const nextState = service.applyIncidentConfig(state, config);
      setState(nextState);
      void service.save(nextState);
      return nextState;
    },
    [service, state],
  );

  const applyJoinResponse = useCallback(
    (response: IncidentJoinResponse) => {
      if (!state) {
        return null;
      }

      const nextState = service.applyJoinResponse(state, response);
      setState(nextState);
      void service.save(nextState);
      return nextState;
    },
    [service, state],
  );

  return useMemo(
    () => ({ state, isLoading, start, prepareJoinRequest, prepareConfigRequest, applyIncidentConfig, applyJoinResponse }),
    [state, isLoading, start, prepareJoinRequest, prepareConfigRequest, applyIncidentConfig, applyJoinResponse],
  );
}

export function createInMemoryLocalOnboardingStore(initialState: LocalOnboardingState | null = null): LocalOnboardingStore {
  let state = initialState;

  return {
    async load() {
      return state;
    },
    async save(nextState) {
      state = nextState;
    },
  };
}

export function createLocalOnboardingService(options: CreateLocalOnboardingServiceOptions): LocalOnboardingService {
  const now = options.now ?? (() => new Date().toISOString());
  const generateLocalActorId = options.generateLocalActorId ?? (() => `local-actor-${cryptoSafeRandomId()}`);
  const generateLocalIncidentId = options.generateLocalIncidentId ?? (() => `local-incident-${cryptoSafeRandomId()}`);

  return {
    async start(input) {
      const existing = await options.store.load();
      const timestamp = input.now ?? now();
      const selectedIncidentId = input.selectedIncidentId ?? existing?.selectedIncidentId ?? generateLocalIncidentId();
      const state: LocalOnboardingState = {
        localActorId: existing?.localActorId ?? generateLocalActorId(),
        pseudonym: normalizeRequiredText(input.pseudonym, 'pseudonym'),
        selfDeclaredRole: input.selfDeclaredRole,
        selectedIncidentId,
        localIncidentView: existing?.localIncidentView.incidentId === selectedIncidentId
          ? { ...existing.localIncidentView, name: input.incidentName ?? existing.localIncidentView.name }
          : {
              incidentId: selectedIncidentId,
              name: input.incidentName ?? 'Local incident',
              status: 'local_pending',
              createdAtDevice: timestamp,
            },
        sync: existing?.selectedIncidentId === selectedIncidentId ? existing.sync : { status: 'local_pending' },
        updatedAtDevice: timestamp,
      };

      await options.store.save(state);
      return state;
    },
    load() {
      return options.store.load();
    },
    prepareJoinRequest(state) {
      return {
        channel: 'mobile',
        externalId: state.localActorId,
        displayName: state.pseudonym,
        role: state.selfDeclaredRole,
      };
    },
    prepareConfigRequest(state) {
      return { incidentId: state.selectedIncidentId };
    },
    applyIncidentConfig(state, config, loadedAt = now()) {
      assertSameIncident(state.selectedIncidentId, config.incident);
      const permissionSnapshot = config.permissionSnapshots[state.selfDeclaredRole];

      return {
        ...state,
        selectedIncidentId: config.incident.incidentId,
        localIncidentView: remoteIncidentToLocalView(config.incident, state.localIncidentView.createdAtDevice),
        sync: { status: 'config_loaded', permissionSnapshot, config },
        updatedAtDevice: loadedAt,
      };
    },
    applyJoinResponse(state, response, confirmedAt = now()) {
      assertSameIncident(state.selectedIncidentId, response.incident);

      return {
        ...state,
        selectedIncidentId: response.incident.incidentId,
        selfDeclaredRole: response.membership.role,
        localIncidentView: remoteIncidentToLocalView(response.incident, state.localIncidentView.createdAtDevice),
        sync: {
          status: 'remote_confirmed',
          permissionSnapshot: response.membership.permissions,
          confirmedMembershipId: response.membership.incidentMembershipId,
        },
        updatedAtDevice: confirmedAt,
      };
    },
    save(state) {
      return options.store.save(state);
    },
  };
}

function remoteIncidentToLocalView(incident: IncidentSummary, createdAtDevice: string): LocalIncidentView {
  return {
    incidentId: incident.incidentId,
    name: incident.name,
    status: 'remote_confirmed',
    startsAt: incident.startsAt,
    locationName: incident.locationName,
    createdAtDevice,
  };
}

function assertSameIncident(selectedIncidentId: string, incident: IncidentSummary): void {
  if (selectedIncidentId !== incident.incidentId) {
    throw new Error(`Remote incident ${incident.incidentId} does not match selected incident ${selectedIncidentId}`);
  }
}

function normalizeRequiredText(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
}

function cryptoSafeRandomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Paragraph, Text, XStack, YStack } from 'tamagui';

import { createInMemoryLocalOperationDatabase, type LocalOperationDatabase, type PresenceLocalView, type WorkCenterView } from '@/infrastructure/local-db/local-db';
import { resolveMapRenderState, type MapPackMetadata } from '@/infrastructure/maps';
import { appendSignedOperationAndMaterialize } from '@/infrastructure/oplog/outbox-service';
import { FakeOperationSigner, type OperationSigner } from '@/infrastructure/security';
import { ActionButton, OperationalCard, StatusBadge } from '@/shared/ui';

const DEFAULT_ACTOR_KEY_ID = 'actor-key-local';
const DEFAULT_DEVICE_ID = 'device-local';
const DEFAULT_CELL_ID = 'cell-a7';
const DEFAULT_INCIDENT_ID = 'incident-local';
const DEFAULT_CENTER_ID = 'center-local-1';
const DEFAULT_TIMESTAMP = '2026-06-29T09:00:00.000Z';
const DEFAULT_PRESENCE_ID = `presence-${DEFAULT_ACTOR_KEY_ID}`;
const MISSING_INCIDENT_ID = 'incident-missing';
const STALE_INCIDENT_ID = 'incident-stale';
const MAP_PREPARATION_INCIDENT_ID = 'incident-map-prep';
const MAP_PREPARATION_CELL_IDS = ['cell-a7', 'cell-a8', 'cell-a9', 'cell-b1'];

export type LiveOperationsDevScenario = 'missing-local-data' | 'stale-center-data' | 'map-preparation';

export function resolveLiveOperationsDevScenario(value: unknown): LiveOperationsDevScenario | undefined {
  return value === 'missing-local-data' || value === 'stale-center-data' || value === 'map-preparation' ? value : undefined;
}

export type LiveOperationalEntryScreenProps = {
  database?: LocalOperationDatabase;
  devScenario?: LiveOperationsDevScenario;
  signer?: OperationSigner;
  initialIncidentId?: string;
  networkAvailable?: boolean;
};

type LiveOperationalState = {
  incident: Awaited<ReturnType<LocalOperationDatabase['views']['incidents']['findById']>>;
  centers: WorkCenterView[];
  selectedCenter: WorkCenterView | null;
  selectedPresence: PresenceLocalView | null;
  mapPack: MapPackMetadata | null;
  mapPacks: MapPackMetadata[];
  pendingOperations: number;
};

type MapPreparationSummary = {
  availableCellIds: string[];
  unavailableCellIds: string[];
  canContinue: boolean;
  continueCellIds: string[];
  explanation: string;
};

type WorkCenterPayload = {
  name: string;
  centerType: string;
  description: string;
  priority: string;
  initialNeed: string;
  confidence: string;
  risk: string;
  surplus: string;
  roleCount: number;
  staleFields: string[];
  location: { latitude: number; longitude: number };
};

type PresenceAction = 'check_in' | 'pause' | 'check_out';

export async function createOfflineIncident(input: {
  database: LocalOperationDatabase;
  signer: OperationSigner;
  incidentId?: string;
  cellId?: string;
  title?: string;
}) {
  const incidentId = input.incidentId ?? DEFAULT_INCIDENT_ID;
  const cellId = input.cellId ?? DEFAULT_CELL_ID;

  return appendSignedOperationAndMaterialize({
    database: input.database,
    signer: input.signer,
    input: {
      actorKeyId: DEFAULT_ACTOR_KEY_ID,
      deviceId: DEFAULT_DEVICE_ID,
      incidentId,
      cellId,
      entityId: incidentId,
      opType: 'incident.create',
      payload: { title: input.title ?? 'Local flood response', status: 'unverified' },
      hlc: `${DEFAULT_TIMESTAMP}-incident-${DEFAULT_DEVICE_ID}`,
      createdAtDevice: DEFAULT_TIMESTAMP,
    },
  });
}

export async function createOfflineWorkCenter(input: {
  database: LocalOperationDatabase;
  signer: OperationSigner;
  incidentId: string;
  cellId: string;
  centerId?: string;
  payload?: Partial<WorkCenterPayload>;
}) {
  const centerId = input.centerId ?? DEFAULT_CENTER_ID;
  const payload = createDefaultWorkCenterPayload(input.payload);

  return appendSignedOperationAndMaterialize({
    database: input.database,
    signer: input.signer,
    input: {
      actorKeyId: DEFAULT_ACTOR_KEY_ID,
      deviceId: DEFAULT_DEVICE_ID,
      incidentId: input.incidentId,
      cellId: input.cellId,
      entityId: centerId,
      opType: 'work_center.create',
      payload,
      hlc: `${DEFAULT_TIMESTAMP}-center-${DEFAULT_DEVICE_ID}`,
      createdAtDevice: DEFAULT_TIMESTAMP,
    },
  });
}

export async function createPresenceOperation(input: { database: LocalOperationDatabase; signer: OperationSigner; incidentId: string; cellId: string; centerId: string; action: PresenceAction }) {
  const opType = `presence.${input.action}` as const;
  const sequence = input.action === 'check_in' ? '0003' : input.action === 'pause' ? '0004' : '0005';

  return appendSignedOperationAndMaterialize({
    database: input.database,
    signer: input.signer,
    input: {
      actorKeyId: DEFAULT_ACTOR_KEY_ID,
      deviceId: DEFAULT_DEVICE_ID,
      incidentId: input.incidentId,
      cellId: input.cellId,
      entityId: `${DEFAULT_PRESENCE_ID}-${input.centerId}`,
      opType,
      payload: { actorId: DEFAULT_ACTOR_KEY_ID, centerId: input.centerId, role: 'volunteer' },
      hlc: `${DEFAULT_TIMESTAMP}-${sequence}-${DEFAULT_DEVICE_ID}`,
      createdAtDevice: DEFAULT_TIMESTAMP,
    },
  });
}

export async function loadLiveOperationalState(database: LocalOperationDatabase, incidentId: string): Promise<LiveOperationalState> {
  const incident = await database.views.incidents.findById(incidentId);
  const cellId = incident?.cellId ?? DEFAULT_CELL_ID;
  const [centers, mapPacks, operations, presenceSessions] = await Promise.all([
    database.views.workCenters.findByIncident(incidentId),
    database.views.mapPacks.findByIncident(incidentId),
    database.syncOps.findByIncident(incidentId),
    database.views.presence.findByIncident(incidentId),
  ]);
  const pendingOperations = operations.filter((operation) => 'syncState' in operation && operation.syncState === 'pending').length;
  const selectedCenter = centers[centers.length - 1] ?? null;
  const mapPack = mapPacks.find((pack) => pack.cellId === cellId) ?? null;

  return {
    incident,
    centers,
    selectedCenter,
    selectedPresence: selectedCenter ? presenceSessions.find((session) => session.centerId === selectedCenter.centerId) ?? null : null,
    mapPack,
    mapPacks,
    pendingOperations,
  };
}

export function LiveOperationalEntryScreen({
  database: providedDatabase,
  devScenario,
  signer = new FakeOperationSigner('live-operational-entry'),
  initialIncidentId,
  networkAvailable = false,
}: LiveOperationalEntryScreenProps) {
  const database = useMemo(() => providedDatabase ?? createInMemoryLocalOperationDatabase(), [providedDatabase]);
  const [activeIncidentId, setActiveIncidentId] = useState(resolveInitialIncidentId(devScenario, initialIncidentId));
  const [seededScenario, setSeededScenario] = useState<LiveOperationsDevScenario | null>(null);
  const [state, setState] = useState<LiveOperationalState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (incidentId: string) => {
      if (!incidentId) {
        setState(null);
        return;
      }

      setState(await loadLiveOperationalState(database, incidentId));
    },
    [database],
  );

  useEffect(() => {
    void refresh(activeIncidentId);
  }, [activeIncidentId, refresh]);

  useEffect(() => {
    if (!devScenario || seededScenario === devScenario) {
      return;
    }

    const scenario = devScenario;
    let isMounted = true;

    async function seedScenario() {
      try {
        const incidentId = await seedDevScenario({ database, signer, scenario });

        if (!isMounted) {
          return;
        }

        setActiveIncidentId(incidentId);
        setSeededScenario(scenario);
        await refresh(incidentId);
      } catch (caughtError) {
        if (isMounted) {
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to seed dev scenario');
        }
      }
    }

    void seedScenario();

    return () => {
      isMounted = false;
    };
  }, [database, devScenario, refresh, seededScenario, signer]);

  const handleCreateIncident = useCallback(async () => {
    setError(null);
    try {
      await createOfflineIncident({ database, signer });
      setActiveIncidentId(DEFAULT_INCIDENT_ID);
      await refresh(DEFAULT_INCIDENT_ID);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to create local incident');
    }
  }, [database, refresh, signer]);

  const handleCreateCenter = useCallback(async () => {
    if (!state?.incident) {
      return;
    }

    setError(null);
    try {
      await createOfflineWorkCenter({ database, signer, incidentId: state.incident.incidentId, cellId: state.incident.cellId });
      await refresh(state.incident.incidentId);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to create pending center');
    }
  }, [database, refresh, signer, state?.incident]);

  const handlePresenceAction = useCallback(
    async (action: PresenceAction) => {
      if (!state?.incident || !state.selectedCenter) {
        return;
      }

      setError(null);
      try {
        await createPresenceOperation({ database, signer, incidentId: state.incident.incidentId, cellId: state.incident.cellId, centerId: state.selectedCenter.centerId, action });
        await refresh(state.incident.incidentId);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to update presence tracking');
      }
    },
    [database, refresh, signer, state?.incident, state?.selectedCenter],
  );

  const handleDevScenario = useCallback(
    async (scenario: LiveOperationsDevScenario) => {
      setError(null);
      try {
        const incidentId = await seedDevScenario({ database, signer, scenario });
        setActiveIncidentId(incidentId);
        await refresh(incidentId);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to seed dev scenario');
      }
    },
    [database, refresh, signer],
  );

  const mapState = resolveMapRenderState({ pack: state?.mapPack ?? null, networkAvailable });
  const missingRequestedIncident = Boolean(activeIncidentId && state && !state.incident);
  const mapPreparation = state?.incident && state.mapPacks.length > 0 ? resolveMapPreparationSummary({ incidentId: state.incident.incidentId, networkAvailable, packs: state.mapPacks, requestedCellIds: MAP_PREPARATION_CELL_IDS }) : null;

  return (
    <YStack bg="$background" testID="live-operational-entry">
      <YStack gap="$4" p="$4">
        <OperationalCard>
          <YStack gap="$3">
            <XStack items="center" justify="space-between" gap="$3">
              <YStack grow={1} gap="$1">
                <Text color="$primary" fontSize="$xs" fontWeight="900" letterSpacing={1} textTransform="uppercase">
                  Live operational entry
                </Text>
                <Text color="$text" fontSize="$xxl" fontWeight="900">
                  Offline-first operations
                </Text>
                <Paragraph color="$textMuted" fontSize="$sm" lineHeight={20}>
                  Signed local operations materialize immediately and remain pending until backend transport exists.
                </Paragraph>
              </YStack>
              <StatusBadge tone="pending" label={`Outbox: ${state?.pendingOperations ?? 0} pending`} />
            </XStack>

            {state?.incident ? (
              <YStack gap="$2">
                <Text color="$text" fontSize="$lg" fontWeight="900">
                  Incident: {state.incident.title}
                </Text>
                <Text color="$textMuted" fontSize="$sm" fontWeight="700">
                  Cell: {state.incident.cellId}
                </Text>
                <Text color="$textMuted" fontSize="$sm" fontWeight="700">
                  Status: {state.incident.status}
                </Text>
                <Text color="$textMuted" fontSize="$sm" fontWeight="700">
                  Operational data is local pending
                </Text>
                <Text color="$textMuted" fontSize="$sm" fontWeight="700">
                  Local outbox: {state.pendingOperations} pending
                </Text>
              </YStack>
            ) : missingRequestedIncident ? (
              <YStack gap="$2">
                <StatusBadge tone="stale" label={`Incident ${activeIncidentId} is not available locally for offline use.`} />
                <Text color="$textMuted" fontSize="$sm" fontWeight="700">
                  Prepare this incident and cell before deployment or reconnect to fetch it.
                </Text>
              </YStack>
            ) : (
              <Text color="$textMuted" fontSize="$sm" fontWeight="700">
                No local incident selected.
              </Text>
            )}

            {error ? <StatusBadge tone="risk" label={error} /> : null}

            <XStack flexWrap="wrap" gap="$2">
              <ActionButton label="Create local incident" onPress={handleCreateIncident} testID="create_local_incident_button" />
              <ActionButton disabled={!state?.incident} label="Create pending center" onPress={handleCreateCenter} testID="create_pending_center_button" tone="warning" />
              <ActionButton label="Show missing local data" onPress={() => handleDevScenario('missing-local-data')} testID="show_missing_local_data_button" tone="stale" />
              <ActionButton label="Seed stale center" onPress={() => handleDevScenario('stale-center-data')} testID="seed_stale_center_button" tone="warning" />
              <ActionButton label="Open map preparation" onPress={() => handleDevScenario('map-preparation')} testID="open_map_preparation_button" tone="info" />
            </XStack>
          </YStack>
        </OperationalCard>

        <LiveMapLibreSurface centers={state?.centers ?? []} indicator={mapState.indicator} />

        {mapPreparation ? <MapPreparationPanel preparation={mapPreparation} /> : null}

        {state?.selectedCenter ? <LiveSelectedCenterPanel center={state.selectedCenter} onPresenceAction={handlePresenceAction} presence={state.selectedPresence} /> : null}
      </YStack>
    </YStack>
  );
}

function LiveMapLibreSurface({ centers, indicator }: { centers: WorkCenterView[]; indicator: string }) {
  return (
    <OperationalCard testID="maplibre-operational-map">
      <YStack gap="$3">
        <XStack items="center" justify="space-between" gap="$3">
          <Text color="$text" fontSize="$lg" fontWeight="900">
            MapLibre operational map
          </Text>
          <StatusBadge tone={indicator.includes('Offline') ? 'success' : indicator.includes('Missing') ? 'stale' : 'info'} label={indicator} />
        </XStack>
        <View accessibilityLabel="MapLibre native surface placeholder" testID="maplibre-native-surface" />
        {centers.map((center) => (
          <XStack key={center.centerId} items="center" gap="$2">
            <StatusBadge tone="pending" label="Pending sync" />
            <Text color="$text" fontSize="$sm" fontWeight="800">
              {center.name}
            </Text>
          </XStack>
        ))}
      </YStack>
    </OperationalCard>
  );
}

function LiveSelectedCenterPanel({ center, onPresenceAction, presence }: { center: WorkCenterView; onPresenceAction: (action: PresenceAction) => void; presence: PresenceLocalView | null }) {
  const centerRecord = center as WorkCenterView & Partial<WorkCenterPayload> & { activationState?: string };
  const staleFields = centerRecord.staleFields ?? [];
  const hasStaleFields = staleFields.length > 0;
  const trackingLabel = presence?.status === 'active' ? 'Tracking: active' : presence?.status === 'paused' ? 'Tracking: paused' : presence?.status === 'checked_out' ? 'Tracking: stopped' : 'Tracking: stopped';
  const roleSummary = resolveRoleSummary(centerRecord.roleCount ?? 0, presence);

  return (
    <OperationalCard testID="live-selected-center-panel">
      <YStack gap="$3">
        <XStack items="center" justify="space-between" gap="$3">
          <YStack grow={1} gap="$1">
            <Text color="$text" fontSize="$xl" fontWeight="900">
              {center.name}
            </Text>
            <Text color="$textMuted" fontSize="$xs" fontWeight="700">
              {centerRecord.centerType ?? 'Work center'}
            </Text>
          </YStack>
          <StatusBadge tone="pending" label="Pending sync" />
        </XStack>

        <StatusBadge tone="pending" label="Activation requires sufficient evidence" />
        {hasStaleFields ? <StatusBadge tone="stale" label={`Stale center data: ${staleFields.join(', ')} need verification before action`} /> : null}
        <StatusBadge tone={presence?.status === 'active' ? 'success' : presence?.status === 'paused' ? 'warning' : 'stale'} label={trackingLabel} />
        <Text color="$text" fontSize="$sm" fontWeight="800">
          State: {center.status}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          {formatMaybeStaleField('Confidence', centerRecord.confidence ?? 'local estimate', staleFields.includes('confidence'))}
        </Text>
        {hasStaleFields ? (
          <Text color="$stale" fontSize="$sm" fontWeight="800">
            Freshness: stale fields require verification
          </Text>
        ) : (
          <Text color="$text" fontSize="$sm" fontWeight="800">
            Freshness: local pending
          </Text>
        )}
        <Text color="$text" fontSize="$sm" fontWeight="800">
          Risk: {centerRecord.risk ?? 'precaution'}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          {formatMaybeStaleField('Need', centerRecord.initialNeed ?? 'Water', staleFields.includes('need'))}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          {formatMaybeStaleField('Surplus', centerRecord.surplus ?? 'none reported', staleFields.includes('surplus'))}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          {formatMaybeStaleField('Roles', roleSummary.value, staleFields.includes('roles') || roleSummary.isStale)}
        </Text>

        <XStack flexWrap="wrap" gap="$2">
          <ActionButton label="Check in" onPress={() => onPresenceAction('check_in')} testID="presence_check_in_button" tone="success" />
          <ActionButton disabled={presence?.status !== 'active'} label="Pause tracking" onPress={() => onPresenceAction('pause')} testID="presence_pause_button" tone="warning" />
          <ActionButton disabled={!presence || presence.status === 'checked_out'} label="Check out" onPress={() => onPresenceAction('check_out')} testID="presence_check_out_button" tone="stale" />
          <ActionButton label="Report need" tone="warning" />
          <ActionButton label="Report surplus" tone="info" />
        </XStack>
      </YStack>
    </OperationalCard>
  );
}

function MapPreparationPanel({ preparation }: { preparation: MapPreparationSummary }) {
  return (
    <OperationalCard testID="map_preparation_panel">
      <YStack gap="$3">
        <Text color="$text" fontSize="$lg" fontWeight="900">
          Map preparation
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          Local available packs: {formatCellList(preparation.availableCellIds)}
        </Text>
        <Text color="$stale" fontSize="$sm" fontWeight="800">
          Unavailable packs: {formatCellList(preparation.unavailableCellIds)}
        </Text>
        <Text color="$textMuted" fontSize="$sm" fontWeight="700">
          {preparation.explanation}
        </Text>
        <Text color="$textMuted" fontSize="$sm" fontWeight="700">
          Continuing cells: {formatCellList(preparation.continueCellIds)}
        </Text>
        <ActionButton disabled={!preparation.canContinue} label="Continue with local coverage" testID="continue_with_local_coverage_button" tone="success" />
      </YStack>
    </OperationalCard>
  );
}

function createDefaultWorkCenterPayload(overrides: Partial<WorkCenterPayload> = {}): WorkCenterPayload {
  return {
    name: 'North triage point',
    centerType: 'Medical post',
    description: 'Triage and water distribution near the north gate.',
    priority: 'high',
    initialNeed: 'Water',
    confidence: 'local estimate',
    risk: 'precaution',
    surplus: 'none reported',
    roleCount: 0,
    staleFields: [],
    location: { latitude: 41.38, longitude: 2.17 },
    ...overrides,
  };
}

function formatMaybeStaleField(label: string, value: string, isStale: boolean): string {
  return `${label}: ${value}${isStale ? ' — stale, verify before acting' : ''}`;
}

function resolveRoleSummary(baseRoleCount: number, presence: PresenceLocalView | null): { value: string; isStale: boolean } {
  if (presence?.status === 'active') {
    return { value: '1 active', isStale: false };
  }

  if (presence?.status === 'paused') {
    return { value: '1 paused', isStale: true };
  }

  if (presence?.status === 'checked_out') {
    return { value: '0 active', isStale: false };
  }

  return { value: `${baseRoleCount} active`, isStale: false };
}

function resolveInitialIncidentId(devScenario: LiveOperationsDevScenario | undefined, initialIncidentId: string | undefined): string {
  if (devScenario === 'missing-local-data') {
    return MISSING_INCIDENT_ID;
  }

  if (devScenario === 'stale-center-data') {
    return STALE_INCIDENT_ID;
  }

  if (devScenario === 'map-preparation') {
    return MAP_PREPARATION_INCIDENT_ID;
  }

  return initialIncidentId ?? '';
}

async function seedDevScenario(input: { database: LocalOperationDatabase; signer: OperationSigner; scenario: LiveOperationsDevScenario }): Promise<string> {
  if (input.scenario === 'missing-local-data') {
    return MISSING_INCIDENT_ID;
  }

  if (input.scenario === 'stale-center-data') {
    await seedStaleCenterData(input.database, input.signer);

    return STALE_INCIDENT_ID;
  }

  await seedMapPreparationData(input.database, input.signer);

  return MAP_PREPARATION_INCIDENT_ID;
}

async function seedStaleCenterData(database: LocalOperationDatabase, signer: OperationSigner) {
  await createOfflineIncident({ database, signer, incidentId: STALE_INCIDENT_ID, title: 'Prepared stale response' });
  await createOfflineWorkCenter({
    database,
    signer,
    incidentId: STALE_INCIDENT_ID,
    cellId: DEFAULT_CELL_ID,
    centerId: 'center-stale-1',
    payload: {
      name: 'Stale logistics point',
      centerType: 'Supply point',
      initialNeed: 'Water',
      confidence: 'local estimate',
      surplus: 'blankets reported',
      roleCount: 3,
      staleFields: ['confidence', 'roles', 'need', 'surplus'],
    },
  });
}

async function seedMapPreparationData(database: LocalOperationDatabase, signer: OperationSigner) {
  await createOfflineIncident({ database, signer, incidentId: MAP_PREPARATION_INCIDENT_ID, title: 'Map preparation drill' });

  await database.views.mapPacks.upsert(createScenarioMapPack(MAP_PREPARATION_INCIDENT_ID, 'cell-a7', 'downloaded', 1, 42000));
  await database.views.mapPacks.upsert(createScenarioMapPack(MAP_PREPARATION_INCIDENT_ID, 'cell-a8', 'partial', 0.35, 14700));
  await database.views.mapPacks.upsert(createScenarioMapPack(MAP_PREPARATION_INCIDENT_ID, 'cell-a9', 'failed', 0, 0));
}

function createScenarioMapPack(incidentId: string, cellId: string, state: MapPackMetadata['state'], progress: number, downloadedBytes: number): MapPackMetadata {
  return {
    packId: `${incidentId}:${cellId}`,
    incidentId,
    cellId,
    bounds: { west: 2.1, south: 41.3, east: 2.2, north: 41.4 },
    state,
    progress,
    estimatedBytes: 42000,
    downloadedBytes,
    updatedAt: DEFAULT_TIMESTAMP,
  };
}

function resolveMapPreparationSummary(input: { incidentId: string; packs: MapPackMetadata[]; requestedCellIds: string[]; networkAvailable: boolean }): MapPreparationSummary {
  const packsByCell = new Map(input.packs.map((pack) => [pack.cellId, pack]));
  const availableCellIds: string[] = [];
  const unavailableCellIds: string[] = [];

  for (const cellId of input.requestedCellIds) {
    const pack = packsByCell.get(cellId);

    if (pack && isLocallyUsableMapPack(pack)) {
      availableCellIds.push(cellId);
    } else {
      unavailableCellIds.push(cellId);
    }
  }

  const continueCellIds = input.networkAvailable ? input.requestedCellIds : availableCellIds;

  return {
    availableCellIds,
    unavailableCellIds,
    canContinue: continueCellIds.length > 0,
    continueCellIds,
    explanation: resolveMapPreparationExplanation(input.networkAvailable, continueCellIds),
  };
}

function isLocallyUsableMapPack(pack: MapPackMetadata): boolean {
  return pack.state === 'downloaded' || pack.state === 'partial' || pack.downloadedBytes > 0 || pack.progress > 0;
}

function resolveMapPreparationExplanation(networkAvailable: boolean, continueCellIds: string[]): string {
  if (networkAvailable) {
    return 'Network available. Missing packs can be downloaded before continuing.';
  }

  if (continueCellIds.length === 0) {
    return 'Network unavailable. No local map coverage is available for the requested cells.';
  }

  return `Network unavailable. Continue only with locally available coverage: ${continueCellIds.join(', ')}.`;
}

function formatCellList(cellIds: string[]): string {
  return cellIds.length > 0 ? cellIds.join(', ') : 'none';
}

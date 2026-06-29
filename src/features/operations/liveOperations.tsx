import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Paragraph, ScrollView, Text, XStack, YStack } from 'tamagui';

import { createInMemoryLocalOperationDatabase, type LocalOperationDatabase, type WorkCenterView } from '@/infrastructure/local-db/local-db';
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

export type LiveOperationalEntryScreenProps = {
  database?: LocalOperationDatabase;
  signer?: OperationSigner;
  initialIncidentId?: string;
  networkAvailable?: boolean;
};

type LiveOperationalState = {
  incident: Awaited<ReturnType<LocalOperationDatabase['views']['incidents']['findById']>>;
  centers: WorkCenterView[];
  selectedCenter: WorkCenterView | null;
  mapPack: MapPackMetadata | null;
  pendingOperations: number;
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
  location: { latitude: number; longitude: number };
};

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

export async function loadLiveOperationalState(database: LocalOperationDatabase, incidentId: string): Promise<LiveOperationalState> {
  const incident = await database.views.incidents.findById(incidentId);
  const cellId = incident?.cellId ?? DEFAULT_CELL_ID;
  const [centers, mapPack, operations] = await Promise.all([
    database.views.workCenters.findByIncident(incidentId),
    database.views.mapPacks.findById(`${incidentId}:${cellId}`),
    database.syncOps.findByIncident(incidentId),
  ]);
  const pendingOperations = operations.filter((operation) => 'syncState' in operation && operation.syncState === 'pending').length;

  return {
    incident,
    centers,
    selectedCenter: centers[centers.length - 1] ?? null,
    mapPack,
    pendingOperations,
  };
}

export function LiveOperationalEntryScreen({
  database: providedDatabase,
  signer = new FakeOperationSigner('live-operational-entry'),
  initialIncidentId,
  networkAvailable = false,
}: LiveOperationalEntryScreenProps) {
  const database = useMemo(() => providedDatabase ?? createInMemoryLocalOperationDatabase(), [providedDatabase]);
  const [activeIncidentId, setActiveIncidentId] = useState(initialIncidentId ?? '');
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

  const mapState = resolveMapRenderState({ pack: state?.mapPack ?? null, networkAvailable });

  return (
    <ScrollView bg="$background" testID="live-operational-entry">
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
            </XStack>
          </YStack>
        </OperationalCard>

        <LiveMapLibreSurface centers={state?.centers ?? []} indicator={mapState.indicator} />

        {state?.selectedCenter ? <LiveSelectedCenterPanel center={state.selectedCenter} /> : null}
      </YStack>
    </ScrollView>
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

function LiveSelectedCenterPanel({ center }: { center: WorkCenterView }) {
  const centerRecord = center as WorkCenterView & Partial<WorkCenterPayload> & { activationState?: string };

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
        <Text color="$text" fontSize="$sm" fontWeight="800">
          State: {center.status}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          Confidence: {centerRecord.confidence ?? 'local estimate'}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          Freshness: local pending
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          Risk: {centerRecord.risk ?? 'precaution'}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          Need: {centerRecord.initialNeed ?? 'Water'}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          Surplus: {centerRecord.surplus ?? 'none reported'}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          Roles: {centerRecord.roleCount ?? 0} active
        </Text>

        <XStack flexWrap="wrap" gap="$2">
          <ActionButton label="Check in" tone="success" />
          <ActionButton label="Report need" tone="warning" />
          <ActionButton label="Report surplus" tone="info" />
        </XStack>
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
    location: { latitude: 41.38, longitude: 2.17 },
    ...overrides,
  };
}

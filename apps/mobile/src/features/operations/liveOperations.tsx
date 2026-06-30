import { ResourceReportPayloadSchema, WorkCenterCreatePayloadSchema, type ResourceReportKind, type ResourceReportPayload, type ResourceReportUrgency, type WorkCenterCreatePayload } from '@zona-cero/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Paragraph, Text, XStack, YStack } from 'tamagui';

import { createInMemoryLocalOperationDatabase, type DispatchEventLocalView, type LocalOperationDatabase, type PresenceLocalView, type ResourceReportLocalView, type WorkCenterView } from '@/infrastructure/local-db/local-db';
import { resolveMapPreparationCoverage, resolveMapRenderState, type MapPackMetadata } from '@/infrastructure/maps';
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
  resourceReports: ResourceReportLocalView[];
  dispatchEvents: DispatchEventLocalView[];
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

type WorkCenterPayload = WorkCenterCreatePayload;

type PresenceAction = 'check_in' | 'pause' | 'check_out';
type ResourceReportIntent = 'needed' | 'surplus';

let localOperationSequence = 0;

export async function createOfflineIncident(input: {
  database: LocalOperationDatabase;
  signer: OperationSigner;
  incidentId?: string;
  cellId?: string;
  title?: string;
}) {
  const incidentId = input.incidentId ?? DEFAULT_INCIDENT_ID;
  const cellId = input.cellId ?? DEFAULT_CELL_ID;
  const stamp = nextOperationStamp('incident');

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
      hlc: stamp.hlc,
      createdAtDevice: stamp.createdAtDevice,
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
  const centerId = input.centerId ?? (await createNextWorkCenterId(input.database, input.incidentId));
  const payload = createDefaultWorkCenterPayload(input.payload);
  const stamp = nextOperationStamp('center');

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
      hlc: stamp.hlc,
      createdAtDevice: stamp.createdAtDevice,
    },
  });
}

export async function createPresenceOperation(input: { database: LocalOperationDatabase; signer: OperationSigner; incidentId: string; cellId: string; centerId: string; action: PresenceAction }) {
  const opType = `presence.${input.action}` as const;
  const stamp = nextOperationStamp(`presence-${input.action}`);

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
      hlc: stamp.hlc,
      createdAtDevice: stamp.createdAtDevice,
    },
  });
}

export async function createOfflineResourceReport(input: {
  database: LocalOperationDatabase;
  signer: OperationSigner;
  incidentId: string;
  cellId: string;
  workCenterId: string;
  reportId?: string;
  payload: {
    category: string;
    quantityApprox: string;
    urgency: ResourceReportUrgency;
    constraints?: string[];
    reportKind: ResourceReportKind;
  };
}) {
  const reportId = input.reportId ?? (await createNextResourceReportId(input.database, input.incidentId));
  const payload = ResourceReportPayloadSchema.parse({
    ...input.payload,
    constraints: input.payload.constraints ?? [],
    workCenterId: input.workCenterId,
    reportedAt: nextOperationTimestamp(),
  });
  const stamp = nextOperationStamp(`resource-${input.payload.reportKind}`);

  return appendSignedOperationAndMaterialize({
    database: input.database,
    signer: input.signer,
    input: {
      actorKeyId: DEFAULT_ACTOR_KEY_ID,
      deviceId: DEFAULT_DEVICE_ID,
      incidentId: input.incidentId,
      cellId: input.cellId,
      entityId: reportId,
      opType: 'resource_report.create',
      payload,
      hlc: stamp.hlc,
      createdAtDevice: stamp.createdAtDevice,
    },
  });
}

export async function loadLiveOperationalState(database: LocalOperationDatabase, incidentId: string): Promise<LiveOperationalState> {
  const incident = await database.views.incidents.findById(incidentId);
  const cellId = incident?.cellId ?? DEFAULT_CELL_ID;
  const [centers, mapPacks, operations, presenceSessions, resourceReports, dispatchEvents] = await Promise.all([
    database.views.workCenters.findByIncident(incidentId),
    database.views.mapPacks.findByIncident(incidentId),
    database.syncOps.findByIncident(incidentId),
    database.views.presence.findByIncident(incidentId),
    database.views.resourceReports.findByIncident(incidentId),
    database.views.dispatchEvents.findByIncident(incidentId),
  ]);
  const pendingOperations = operations.filter((operation) => 'syncState' in operation && operation.syncState === 'pending').length;
  const selectedCenter = centers[centers.length - 1] ?? null;
  const mapPack = mapPacks.find((pack) => pack.cellId === cellId) ?? null;

  return {
    incident,
    centers,
    selectedCenter,
    selectedPresence: selectedCenter ? presenceSessions.find((session) => session.centerId === selectedCenter.centerId) ?? null : null,
    resourceReports,
    dispatchEvents,
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

  const handleResourceReport = useCallback(
    async (reportKind: ResourceReportIntent) => {
      if (!state?.incident || !state.selectedCenter) {
        return;
      }

      setError(null);
      try {
        await createOfflineResourceReport({
          database,
          signer,
          incidentId: state.incident.incidentId,
          cellId: state.incident.cellId,
          workCenterId: state.selectedCenter.centerId,
          payload: createDefaultResourceReportPayload(reportKind),
        });
        await refresh(state.incident.incidentId);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to create resource report');
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
  const mapPreparation = state?.incident?.incidentId === MAP_PREPARATION_INCIDENT_ID && state.mapPacks.length > 0 ? resolveMapPreparationSummary({ incidentId: state.incident.incidentId, networkAvailable, packs: state.mapPacks, requestedCellIds: MAP_PREPARATION_CELL_IDS }) : null;

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
                <Text color="$stale" fontSize="$xs" fontWeight="800">
                  Dev spike storage: in-memory route only
                </Text>
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

        {state?.selectedCenter ? <LiveSelectedCenterPanel center={state.selectedCenter} onPresenceAction={handlePresenceAction} onResourceReport={handleResourceReport} presence={state.selectedPresence} /> : null}

        {state?.selectedCenter ? <ResourceLogisticsPanel dispatchEvents={state.dispatchEvents} reports={state.resourceReports} selectedCenterId={state.selectedCenter.centerId} /> : null}
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
            <StatusBadge tone="pending" label={center.provisional ? 'Offline provisional' : 'Pending sync'} />
            <Text color="$text" fontSize="$sm" fontWeight="800">
              {center.name}
            </Text>
          </XStack>
        ))}
      </YStack>
    </OperationalCard>
  );
}

function LiveSelectedCenterPanel({
  center,
  onPresenceAction,
  onResourceReport,
  presence,
}: {
  center: WorkCenterView;
  onPresenceAction: (action: PresenceAction) => void;
  onResourceReport: (reportKind: ResourceReportIntent) => void;
  presence: PresenceLocalView | null;
}) {
  const centerRecord = center as WorkCenterView & Partial<WorkCenterPayload>;
  const trackingLabel = presence?.status === 'active' ? 'Tracking: active' : presence?.status === 'paused' ? 'Tracking: paused' : presence?.status === 'checked_out' ? 'Tracking: stopped' : 'Tracking: stopped';
  const roleSummary = resolveRoleSummary(presence);
  const activationLabel = center.activationState ? `Activation: ${formatCanonicalValue(center.activationState)}` : 'Activation: offline provisional';
  const freshnessLabel = center.freshness ? `Freshness: ${formatCanonicalValue(center.freshness)}` : 'Freshness: offline provisional';
  const confidenceLabel = center.confidence ? `Confidence: ${formatCanonicalValue(center.confidence)}` : 'Confidence: offline provisional';
  const riskLabel = center.risk ? `Risk: ${formatCanonicalValue(center.risk)}` : 'Risk: offline provisional';

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
          <StatusBadge tone="pending" label={center.provisional ? 'Offline provisional' : 'Pending sync'} />
        </XStack>

        <StatusBadge tone="pending" label={activationLabel} />
        <StatusBadge tone={presence?.status === 'active' ? 'success' : presence?.status === 'paused' ? 'warning' : 'stale'} label={trackingLabel} />
        <Text color="$text" fontSize="$sm" fontWeight="800">
          State: {center.status}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          {confidenceLabel}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          {freshnessLabel}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          {riskLabel}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          Need: {centerRecord.initialNeed ?? 'not reported'}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          Surplus: {centerRecord.surplus ?? 'not reported'}
        </Text>
        <Text color="$text" fontSize="$sm" fontWeight="800">
          {formatMaybeStaleField('Roles', roleSummary.value, roleSummary.isStale)}
        </Text>

        <XStack flexWrap="wrap" gap="$2">
          <ActionButton label="Check in" onPress={() => onPresenceAction('check_in')} testID="presence_check_in_button" tone="success" />
          <ActionButton disabled={presence?.status !== 'active'} label="Pause tracking" onPress={() => onPresenceAction('pause')} testID="presence_pause_button" tone="warning" />
          <ActionButton disabled={!presence || presence.status === 'checked_out'} label="Check out" onPress={() => onPresenceAction('check_out')} testID="presence_check_out_button" tone="stale" />
          <ActionButton label="Report need" onPress={() => onResourceReport('needed')} testID="report_need_button" tone="warning" />
          <ActionButton label="Report surplus" onPress={() => onResourceReport('surplus')} testID="report_surplus_button" tone="info" />
        </XStack>
      </YStack>
    </OperationalCard>
  );
}

function ResourceLogisticsPanel({ dispatchEvents, reports, selectedCenterId }: { dispatchEvents: DispatchEventLocalView[]; reports: ResourceReportLocalView[]; selectedCenterId: string }) {
  const centerReports = reports.filter((report) => report.workCenterId === selectedCenterId);
  const needs = centerReports.filter((report) => report.reportKind === 'needed');
  const surplus = centerReports.filter((report) => report.reportKind === 'surplus');

  return (
    <OperationalCard testID="resource-logistics-panel">
      <YStack gap="$3">
        <XStack items="center" justify="space-between" gap="$3">
          <YStack grow={1} gap="$1">
            <Text color="$text" fontSize="$lg" fontWeight="900">
              Resources + logistics
            </Text>
            <Text color="$textMuted" fontSize="$sm" fontWeight="700">
              Local reports are provisional until sync confirms them.
            </Text>
          </YStack>
          <StatusBadge tone={centerReports.length > 0 ? 'pending' : 'stale'} label={centerReports.length > 0 ? 'Local pending' : 'No local reports'} />
        </XStack>

        <ResourceReportList heading="Needs" reports={needs} />
        <ResourceReportList heading="Surplus" reports={surplus} />

        <YStack gap="$2">
          <Text color="$text" fontSize="$md" fontWeight="900">
            Dispatch tasks
          </Text>
          {dispatchEvents.length === 0 ? (
            <Text color="$textMuted" fontSize="$sm" fontWeight="700">
              No dispatch tasks available locally.
            </Text>
          ) : (
            dispatchEvents.map((event) => (
              <YStack key={event.dispatchEventId} gap="$1">
                <Text color="$text" fontSize="$sm" fontWeight="800">
                  {event.category} · {event.quantityApprox}
                </Text>
                <StatusBadge tone={event.provisional ? 'pending' : 'info'} label={`Dispatch: ${formatCanonicalValue(event.status)}${event.provisional ? ' · local pending' : ''}`} />
              </YStack>
            ))
          )}
        </YStack>
      </YStack>
    </OperationalCard>
  );
}

function ResourceReportList({ heading, reports }: { heading: string; reports: ResourceReportLocalView[] }) {
  return (
    <YStack gap="$2">
      <Text color="$text" fontSize="$md" fontWeight="900">
        {heading}
      </Text>
      {reports.length === 0 ? (
        <Text color="$textMuted" fontSize="$sm" fontWeight="700">
          No {heading.toLowerCase()} reported for this center.
        </Text>
      ) : (
        reports.map((report) => (
          <YStack key={report.reportId} gap="$1">
            <Text color="$text" fontSize="$sm" fontWeight="800">
              {report.category} · {report.quantityApprox} · {formatCanonicalValue(report.urgency)}
            </Text>
            <Text color="$textMuted" fontSize="$xs" fontWeight="700">
              Constraints: {report.constraints.length > 0 ? report.constraints.join(', ') : 'none'}
            </Text>
            <StatusBadge tone="pending" label={report.provisional ? 'Local pending · verify before acting' : 'Synced'} />
          </YStack>
        ))
      )}
    </YStack>
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
  return WorkCenterCreatePayloadSchema.parse({
    name: 'North triage point',
    centerType: 'Medical post',
    description: 'Triage and water distribution near the north gate.',
    priority: 'high',
    initialNeed: 'Water',
    surplus: 'none reported',
    location: { latitude: 41.38, longitude: 2.17 },
    reportedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  });
}

function createDefaultResourceReportPayload(reportKind: ResourceReportIntent): ResourceReportPayload {
  return ResourceReportPayloadSchema.parse({
    category: reportKind === 'needed' ? 'Water' : 'Blankets',
    quantityApprox: reportKind === 'needed' ? '24 boxes' : '12 units',
    urgency: reportKind === 'needed' ? 'high' : 'medium',
    constraints: reportKind === 'needed' ? ['sealed bottles preferred'] : [],
    reportKind,
  });
}

function formatMaybeStaleField(label: string, value: string, isStale: boolean): string {
  return `${label}: ${value}${isStale ? ' — stale, verify before acting' : ''}`;
}

function resolveRoleSummary(presence: PresenceLocalView | null): { value: string; isStale: boolean } {
  if (presence?.status === 'active') {
    return { value: '1 active', isStale: false };
  }

  if (presence?.status === 'paused') {
    return { value: '1 paused', isStale: true };
  }

  return { value: '0 active', isStale: false };
}

function formatCanonicalValue(value: string): string {
  return value.replaceAll('_', ' ');
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
      surplus: 'blankets reported',
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
  const coverage = resolveMapPreparationCoverage(input);

  return {
    availableCellIds: coverage.availableLocalPacks.map((pack) => pack.cellId),
    unavailableCellIds: coverage.unavailablePacks.map((pack) => pack.cellId),
    canContinue: coverage.canContinue,
    continueCellIds: coverage.continueCellIds,
    explanation: coverage.explanation,
  };
}

function formatCellList(cellIds: string[]): string {
  return cellIds.length > 0 ? cellIds.join(', ') : 'none';
}

function nextOperationStamp(label: string): { createdAtDevice: string; hlc: string } {
  localOperationSequence += 1;
  const sequence = String(localOperationSequence).padStart(6, '0');
  const createdAtDevice = new Date(Date.parse(DEFAULT_TIMESTAMP) + localOperationSequence).toISOString();

  return {
    createdAtDevice,
    hlc: `${createdAtDevice}-${sequence}-${label}-${DEFAULT_DEVICE_ID}`,
  };
}

function nextOperationTimestamp(): string {
  return new Date(Date.parse(DEFAULT_TIMESTAMP) + localOperationSequence + 1).toISOString();
}

async function createNextWorkCenterId(database: LocalOperationDatabase, incidentId: string): Promise<string> {
  const existingCenters = await database.views.workCenters.findByIncident(incidentId);

  return existingCenters.length === 0 ? DEFAULT_CENTER_ID : `center-local-${existingCenters.length + 1}`;
}

async function createNextResourceReportId(database: LocalOperationDatabase, incidentId: string): Promise<string> {
  const existingReports = await database.views.resourceReports.findByIncident(incidentId);

  return `resource-report-local-${existingReports.length + 1}`;
}

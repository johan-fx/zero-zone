/// <reference types="jest" />

import { WorkCenterCreatePayloadSchema } from '@zona-cero/contracts';
import { validWorkCenterCreatePayloadFixture } from '@zona-cero/testing';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Theme, TamaguiProvider } from 'tamagui';

import { createInMemoryLocalOperationDatabase } from '@/infrastructure/local-db/local-db';
import { appendSignedOperationAndMaterialize } from '@/infrastructure/oplog/outbox-service';
import { FakeOperationSigner } from '@/infrastructure/security';
import type { ScopedOperationSyncService } from '@/infrastructure/sync';
import type { MeshtasticSosAdapter } from '@/infrastructure/transport';
import { OperationalThemeProvider } from '@/shared/theme';
import { tamaguiConfig } from '../../../tamagui.config';
import { LiveOperationalEntryScreen, cancelOfflineSosSignal, createOfflineDispute, createOfflineResourceReport, createOfflineSosSignal, createOfflineTrustSignal, createOfflineWorkCenter } from './liveOperations';

async function renderLiveOperations(input: {
  database?: ReturnType<typeof createInMemoryLocalOperationDatabase>;
  devScenario?: 'missing-local-data' | 'stale-center-data' | 'map-preparation';
  initialIncidentId?: string;
  networkAvailable?: boolean;
  signingKey?: string;
  sosTransport?: MeshtasticSosAdapter;
  syncService?: ScopedOperationSyncService;
  syncUnavailableReason?: string;
} = {}) {
  const database = input.database ?? createInMemoryLocalOperationDatabase();
  const signer = new FakeOperationSigner(input.signingKey ?? 'slice-b-live-tests');

  const screen = await render(
    <OperationalThemeProvider>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Theme name="light">
          <LiveOperationalEntryScreen database={database} devScenario={input.devScenario} initialIncidentId={input.initialIncidentId} networkAvailable={input.networkAvailable} signer={signer} sosTransport={input.sosTransport} syncService={input.syncService} syncUnavailableReason={input.syncUnavailableReason} />
        </Theme>
      </TamaguiProvider>
    </OperationalThemeProvider>,
  );

  return { screen, database };
}

async function seedPreparedIncident(database: ReturnType<typeof createInMemoryLocalOperationDatabase>) {
  await appendSignedOperationAndMaterialize({
    database,
    signer: new FakeOperationSigner('prepared-incident-tests'),
    input: {
      actorKeyId: 'actor-key-1',
      deviceId: 'device-1',
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      entityId: 'incident-prepared',
      opType: 'incident.create',
      payload: { title: 'Prepared flood response', status: 'unverified' },
      hlc: '2026-06-29T09:00:00.000Z-0001-device-1',
      createdAtDevice: '2026-06-29T09:00:00.000Z',
    },
  });

  await database.views.mapPacks.upsert({
    packId: 'incident-prepared:cell-a7',
    incidentId: 'incident-prepared',
    cellId: 'cell-a7',
    bounds: { west: 2.1, south: 41.3, east: 2.2, north: 41.4 },
    state: 'downloaded',
    progress: 1,
    estimatedBytes: 42000,
    downloadedBytes: 42000,
    updatedAt: '2026-06-29T09:01:00.000Z',
  });
}

async function pressAndFlush(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('live operational flow wiring', () => {
  it('enters a prepared local incident on a MapLibre-backed operational surface', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);

    const { screen } = await renderLiveOperations({ database, initialIncidentId: 'incident-prepared' });

    await waitFor(() => expect(screen.getByText('Incident: Prepared flood response')).toBeTruthy());

    expect(screen.getByTestId('maplibre-operational-map')).toBeTruthy();
    expect(screen.getByText('Cell: cell-a7')).toBeTruthy();
    expect(screen.getByText('Offline map available')).toBeTruthy();
    expect(screen.getByText('Operational data is local pending')).toBeTruthy();
    expect(screen.getByText('Outbox: 1 pending')).toBeTruthy();
    expect(screen.getByText('Local outbox: 1 pending')).toBeTruthy();
  });

  it('enables Sync now when a runtime sync service is available', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);
    const sync = jest.fn<ReturnType<ScopedOperationSyncService['sync']>, Parameters<ScopedOperationSyncService['sync']>>().mockResolvedValue({
      pushed: 1,
      pulled: 0,
      confirmed: 1,
      conflicts: 0,
      rejected: 0,
      cursor: null,
      hasMore: false,
    });

    const { screen } = await renderLiveOperations({
      database,
      initialIncidentId: 'incident-prepared',
      networkAvailable: true,
      syncService: { sync },
    });

    await waitFor(() => expect(screen.getByText('Incident: Prepared flood response')).toBeTruthy());
    await pressAndFlush(screen.getByTestId('sync_now_button'));

    await waitFor(() => expect(screen.getByText('Sync complete: 1 confirmed, 0 conflicts, 0 rejected.')).toBeTruthy());
    expect(sync).toHaveBeenCalledWith({ incidentId: 'incident-prepared', cellId: 'cell-a7' });
  });

  it('shows a visible sync degradation reason when runtime API config is absent', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);

    const { screen } = await renderLiveOperations({
      database,
      initialIncidentId: 'incident-prepared',
      syncUnavailableReason: 'Sync unavailable: set EXPO_PUBLIC_API_BASE_URL for the Equipo B API before deployment.',
    });

    await waitFor(() => expect(screen.getByText('Incident: Prepared flood response')).toBeTruthy());

    expect(screen.getByText('Sync unavailable: set EXPO_PUBLIC_API_BASE_URL for the Equipo B API before deployment.')).toBeTruthy();
    expect(screen.getByTestId('sync_now_button')).toBeDisabled();
  });

  it('shows persisted retry metadata after a fresh state load', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);
    const [operation] = await database.syncOps.findByIncident('incident-prepared');
    if (!operation) {
      throw new Error('Expected prepared incident operation');
    }

    await database.syncOps.upsert({
      ...operation,
      syncState: 'pending',
      retryCount: 2,
      lastSyncAttemptAt: '2026-06-29T09:05:00.000Z',
      nextRetryAt: '2026-06-29T09:06:00.000Z',
      syncErrorCode: 'network_error',
      syncErrorMessage: 'Gateway timeout',
    });

    const { screen } = await renderLiveOperations({ database, initialIncidentId: 'incident-prepared' });

    await waitFor(() => expect(screen.getByText('Incident: Prepared flood response')).toBeTruthy());

    expect(screen.getByTestId('outbox_retry_metadata')).toBeTruthy();
    expect(screen.getByText('1 retrying')).toBeTruthy();
    expect(screen.getByText('Retry attempts: 2 · incident.create')).toBeTruthy();
    expect(screen.getByText('Next retry: 2026-06-29T09:06:00.000Z · Last attempt: 2026-06-29T09:05:00.000Z')).toBeTruthy();
    expect(screen.getByText('Last error: network_error — Gateway timeout')).toBeTruthy();
    expect(screen.getByText('No backend conflicts or rejections recorded on this device.')).toBeTruthy();
  });

  it('does not show stale retry metadata for confirmed operations', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);
    const [operation] = await database.syncOps.findByIncident('incident-prepared');
    if (!operation) {
      throw new Error('Expected prepared incident operation');
    }

    await database.syncOps.upsert({
      ...operation,
      syncState: 'confirmed',
      retryCount: 2,
      lastSyncAttemptAt: '2026-06-29T09:05:00.000Z',
      nextRetryAt: '2026-06-29T09:06:00.000Z',
      syncErrorCode: 'network_error',
      syncErrorMessage: 'Gateway timeout',
    });

    const { screen } = await renderLiveOperations({ database, initialIncidentId: 'incident-prepared' });

    await waitFor(() => expect(screen.getByText('Incident: Prepared flood response')).toBeTruthy());

    expect(screen.getByText('0 retrying')).toBeTruthy();
    expect(screen.queryByTestId('outbox_retry_metadata')).toBeNull();
    expect(screen.queryByText('Retry attempts: 2 · incident.create')).toBeNull();
  });

  it('creates an unverified offline incident as a pending signed outbox operation', async () => {
    const { screen, database } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));

    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());

    const operations = await database.syncOps.findByIncident('incident-local');
    expect(operations).toEqual([expect.objectContaining({ opType: 'incident.create', syncState: 'pending', signature: expect.stringContaining('fake-signature') })]);
    expect(screen.getByText('Status: unverified')).toBeTruthy();
    expect(screen.getByText('Outbox: 1 pending')).toBeTruthy();
    expect(screen.getByText('Local outbox: 1 pending')).toBeTruthy();
  });

  it('creates an offline work center with immediate pending map and selected-panel visibility', async () => {
    const { screen, database } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());

    await pressAndFlush(screen.getByText('Create pending center'));

    await waitFor(() => expect(screen.getAllByText('North triage point')).toHaveLength(2));

    const operations = await database.syncOps.findByIncident('incident-local');
    expect(operations.map((operation) => operation.opType)).toEqual(['incident.create', 'work_center.create']);
    expect(operations[1]).toEqual(
      expect.objectContaining({
        opType: 'work_center.create',
        version: 1,
        payload: WorkCenterCreatePayloadSchema.parse({
          name: 'North triage point',
          centerType: 'Medical post',
          description: 'Triage and water distribution near the north gate.',
          priority: 'high',
          initialNeed: 'Water',
          surplus: 'none reported',
          location: { latitude: 41.38, longitude: 2.17 },
          reportedAt: '2026-06-29T09:00:00.000Z',
        }),
      }),
    );
    expect(operations[1].payload).not.toHaveProperty('confidence');
    expect(operations[1].payload).not.toHaveProperty('risk');
    expect(await database.views.workCenters.findByIncident('incident-local')).toEqual([
      expect.objectContaining({ centerId: 'center-local-1', name: 'North triage point', status: 'pending', syncState: 'pending', provisional: true, location: { latitude: 41.38, longitude: 2.17 } }),
    ]);
    expect(screen.getAllByText('Offline provisional').length).toBeGreaterThan(0);
    expect(screen.getByText('Activation: offline provisional')).toBeTruthy();
    expect(screen.getByText('Dev spike storage: RxDB/SQLite local persistence')).toBeTruthy();
  });

  it('generates unique local work center ids when no center id is provided', async () => {
    const { screen, database } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());
    await pressAndFlush(screen.getByText('Create pending center'));
    await pressAndFlush(screen.getByText('Create pending center'));

    await waitFor(async () => expect(await database.views.workCenters.findByIncident('incident-local')).toHaveLength(2));

    const centers = await database.views.workCenters.findByIncident('incident-local');
    expect(new Set(centers.map((center) => center.centerId)).size).toBe(2);
  });

  it('accepts the shared canonical work center payload fixture for offline signing', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);

    await createOfflineWorkCenter({
      database,
      signer: new FakeOperationSigner('canonical-work-center-fixture-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      centerId: 'center-fixture-1',
      payload: validWorkCenterCreatePayloadFixture,
    });

    const operations = await database.syncOps.findByIncident('incident-prepared');
    const centerOperation = operations.find((operation) => operation.opType === 'work_center.create');
    expect(centerOperation).toEqual(expect.objectContaining({ version: 1, payload: validWorkCenterCreatePayloadFixture, signature: expect.stringContaining('fake-signature') }));
    expect(await database.views.workCenters.findByIncident('incident-prepared')).toContainEqual(
      expect.objectContaining({ centerId: 'center-fixture-1', location: validWorkCenterCreatePayloadFixture.location, provisional: true }),
    );
  });

  it('prevents false activation and exposes selected-center fields without volunteer identities', async () => {
    const { screen } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());
    await pressAndFlush(screen.getByText('Create pending center'));

    await waitFor(() => expect(screen.getByText('State: pending')).toBeTruthy());

    expect(screen.queryByText('State: active')).toBeNull();
    expect(screen.getByText('Confidence: offline provisional')).toBeTruthy();
    expect(screen.getByText('Freshness: offline provisional')).toBeTruthy();
    expect(screen.getByText('Risk: offline provisional')).toBeTruthy();
    expect(screen.getByText('Need: Water')).toBeTruthy();
    expect(screen.getByText('Surplus: none reported')).toBeTruthy();
    expect(screen.getByText('Roles: 0 active')).toBeTruthy();
    expect(screen.getByText('Check in')).toBeTruthy();
    expect(screen.queryByText('volunteer-1')).toBeNull();
  });

  it('exposes disputed work-center trust state without changing permission or activation semantics', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);
    await createOfflineWorkCenter({
      database,
      signer: new FakeOperationSigner('trust-center-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      centerId: 'center-trust-1',
    });
    await createOfflineTrustSignal({
      database,
      signer: new FakeOperationSigner('trust-signal-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      trustSignalId: 'trust-signal-center-1',
      payload: {
        channel: 'mobile',
        externalId: 'actor-key-1',
        subject: { entityType: 'work_center', entityId: 'center-trust-1', incidentId: 'incident-prepared' },
        signalType: 'field_attestation',
        sourceKind: 'field_actor',
      },
    });
    await createOfflineDispute({
      database,
      signer: new FakeOperationSigner('trust-dispute-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      disputeId: 'dispute-center-1',
      payload: {
        channel: 'mobile',
        externalId: 'actor-key-2',
        subject: { entityType: 'work_center', entityId: 'center-trust-1', incidentId: 'incident-prepared' },
        reason: 'context_mismatch',
      },
    });

    const { screen } = await renderLiveOperations({ database, initialIncidentId: 'incident-prepared' });

    await waitFor(() => expect(screen.getByText('Trust: disputed · 1 signals · 1 disputes')).toBeTruthy());

    expect(screen.getByText('State: pending')).toBeTruthy();
    expect(screen.getByText('Activation: offline provisional')).toBeTruthy();
    expect(screen.queryByText(/permission/i)).toBeNull();
  });

  it('checks in to a selected center by creating a signed presence operation', async () => {
    const { screen, database } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());
    await pressAndFlush(screen.getByText('Create pending center'));
    await waitFor(() => expect(screen.getByText('Check in')).toBeTruthy());

    await pressAndFlush(screen.getByText('Check in'));

    await waitFor(() => expect(screen.getByText('Tracking: active')).toBeTruthy());

    const operations = await database.syncOps.findByIncident('incident-local');
    expect(operations.map((operation) => operation.opType)).toEqual(['incident.create', 'work_center.create', 'presence.check_in']);
    expect(operations[2]).toEqual(expect.objectContaining({ opType: 'presence.check_in', entityType: 'presence', syncState: 'pending', signature: expect.stringContaining('fake-signature') }));
    expect(await database.views.presence.findByIncident('incident-local')).toEqual([
      expect.objectContaining({ centerId: 'center-local-1', role: 'volunteer', status: 'active' }),
    ]);
    expect(screen.getByText('Outbox: 3 pending')).toBeTruthy();
  });

  it('pauses and checks out an active presence session with signed operations', async () => {
    const { screen, database } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());
    await pressAndFlush(screen.getByText('Create pending center'));
    await waitFor(() => expect(screen.getByTestId('presence_check_in_button')).toBeTruthy());
    await pressAndFlush(screen.getByTestId('presence_check_in_button'));
    await waitFor(() => expect(screen.getByText('Tracking: active')).toBeTruthy());
    expect(screen.getByText('Roles: 1 active')).toBeTruthy();

    await pressAndFlush(screen.getByTestId('presence_pause_button'));
    await waitFor(() => expect(screen.getByText('Tracking: paused')).toBeTruthy());
    expect(screen.getByText('Roles: 1 paused — stale, verify before acting')).toBeTruthy();

    await pressAndFlush(screen.getByTestId('presence_check_out_button'));
    await waitFor(() => expect(screen.getByText('Tracking: stopped')).toBeTruthy());

    const operations = await database.syncOps.findByIncident('incident-local');
    expect(operations.map((operation) => operation.opType)).toEqual(['incident.create', 'work_center.create', 'presence.check_in', 'presence.pause', 'presence.check_out']);
    expect(operations.slice(2)).toEqual([
      expect.objectContaining({ opType: 'presence.check_in', signature: expect.stringContaining('fake-signature') }),
      expect.objectContaining({ opType: 'presence.pause', signature: expect.stringContaining('fake-signature') }),
      expect.objectContaining({ opType: 'presence.check_out', signature: expect.stringContaining('fake-signature') }),
    ]);
    expect(await database.views.presence.findByIncident('incident-local')).toEqual([
      expect.objectContaining({ centerId: 'center-local-1', role: 'volunteer', status: 'checked_out' }),
    ]);
    expect(screen.getByText('Roles: 0 active')).toBeTruthy();
  });

  it('creates a new monotonic presence operation when checking in again after checkout', async () => {
    const { screen, database } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());
    await pressAndFlush(screen.getByText('Create pending center'));
    await waitFor(() => expect(screen.getByTestId('presence_check_in_button')).toBeTruthy());
    await pressAndFlush(screen.getByTestId('presence_check_in_button'));
    await waitFor(() => expect(screen.getByText('Tracking: active')).toBeTruthy());
    await pressAndFlush(screen.getByTestId('presence_check_out_button'));
    await waitFor(() => expect(screen.getByText('Tracking: stopped')).toBeTruthy());
    await pressAndFlush(screen.getByTestId('presence_check_in_button'));
    await waitFor(() => expect(screen.getByText('Outbox: 5 pending')).toBeTruthy());

    const presenceOperations = (await database.syncOps.findByIncident('incident-local')).filter((operation) => operation.opType.startsWith('presence.'));
    expect(presenceOperations.map((operation) => operation.opType)).toEqual(['presence.check_in', 'presence.check_out', 'presence.check_in']);
    expect(new Set(presenceOperations.map((operation) => operation.opId)).size).toBe(3);
    expect(presenceOperations.map((operation) => operation.hlc)).toEqual([...presenceOperations.map((operation) => operation.hlc)].sort());
  });

  it('keeps role counts local and provisional until backend-derived counts sync', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);
    await appendSignedOperationAndMaterialize({
      database,
      signer: new FakeOperationSigner('role-summary-tests'),
      input: {
        actorKeyId: 'actor-key-1',
        deviceId: 'device-1',
        incidentId: 'incident-prepared',
        cellId: 'cell-a7',
        entityId: 'center-role-1',
        opType: 'work_center.create',
        payload: { name: 'Role summary point' },
        hlc: '2026-06-29T09:02:00.000Z-0002-device-1',
        createdAtDevice: '2026-06-29T09:02:00.000Z',
      },
    });

    const { screen } = await renderLiveOperations({ database, initialIncidentId: 'incident-prepared' });
    await waitFor(() => expect(screen.getByText('Roles: 0 active')).toBeTruthy());
    await pressAndFlush(screen.getByTestId('presence_check_in_button'));

    await waitFor(() => expect(screen.getByText('Roles: 1 active')).toBeTruthy());
  });

  it('uses provisional labels for selected-center confidence, freshness, and risk while offline', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);
    await appendSignedOperationAndMaterialize({
      database,
      signer: new FakeOperationSigner('stale-center-tests'),
      input: {
        actorKeyId: 'actor-key-1',
        deviceId: 'device-1',
        incidentId: 'incident-prepared',
        cellId: 'cell-a7',
        entityId: 'center-stale-1',
        opType: 'work_center.create',
        payload: {
          name: 'Stale logistics point',
          centerType: 'Supply point',
          initialNeed: 'Water',
          surplus: 'blankets reported',
        },
        hlc: '2026-06-29T09:02:00.000Z-0002-device-1',
        createdAtDevice: '2026-06-29T09:02:00.000Z',
      },
    });

    const { screen } = await renderLiveOperations({ database, initialIncidentId: 'incident-prepared' });

    await waitFor(() => expect(screen.getByText('Activation: offline provisional')).toBeTruthy());

    expect(screen.getByText('Confidence: offline provisional')).toBeTruthy();
    expect(screen.getByText('Freshness: offline provisional')).toBeTruthy();
    expect(screen.getByText('Risk: offline provisional')).toBeTruthy();
    expect(screen.getByText('Need: Water')).toBeTruthy();
    expect(screen.getByText('Surplus: blankets reported')).toBeTruthy();
    expect(screen.getByText('Roles: 0 active')).toBeTruthy();
  });

  it('seeds a provisional center dev scenario for deterministic E2E coverage', async () => {
    const { screen } = await renderLiveOperations({ devScenario: 'stale-center-data' });

    await waitFor(() => expect(screen.getByText('Incident: Prepared stale response')).toBeTruthy());

    expect(screen.getAllByText('Stale logistics point')).toHaveLength(2);
    expect(screen.getByText('State: pending')).toBeTruthy();
    expect(screen.getByText('Activation: offline provisional')).toBeTruthy();
    expect(screen.getByText('Confidence: offline provisional')).toBeTruthy();
    expect(screen.getByText('Freshness: offline provisional')).toBeTruthy();
    expect(screen.getByText('Risk: offline provisional')).toBeTruthy();
    expect(screen.getByText('Need: Water')).toBeTruthy();
    expect(screen.getByText('Surplus: blankets reported')).toBeTruthy();
  });

  it('explains when a requested incident is not available locally while offline', async () => {
    const { screen } = await renderLiveOperations({ initialIncidentId: 'incident-missing' });

    await waitFor(() => expect(screen.getByText('Incident incident-missing is not available locally for offline use.')).toBeTruthy());

    expect(screen.getByText('Prepare this incident and cell before deployment or reconnect to fetch it.')).toBeTruthy();
    expect(screen.queryByText('Operational data is local pending')).toBeNull();
    expect(screen.queryByText('Operational data is fresh')).toBeNull();
  });

  it('seeds a missing-local-data dev scenario for deterministic E2E coverage', async () => {
    const { screen } = await renderLiveOperations({ devScenario: 'missing-local-data' });

    await waitFor(() => expect(screen.getByText('Incident incident-missing is not available locally for offline use.')).toBeTruthy());

    expect(screen.getByText('Prepare this incident and cell before deployment or reconnect to fetch it.')).toBeTruthy();
    expect(screen.queryByText('Operational data is local pending')).toBeNull();
  });

  it('shows offline map-preparation packs separately and allows continuing only with local coverage', async () => {
    const { screen } = await renderLiveOperations({ devScenario: 'map-preparation', networkAvailable: false });

    await waitFor(() => expect(screen.getByText('Incident: Map preparation drill')).toBeTruthy());

    expect(screen.getByTestId('map_preparation_panel')).toBeTruthy();
    expect(screen.getByText('Local available packs: cell-a7, cell-a8')).toBeTruthy();
    expect(screen.getByText('Unavailable packs: cell-a9, cell-b1')).toBeTruthy();
    expect(screen.getByText('Network unavailable. Continue only with locally available coverage: cell-a7, cell-a8.')).toBeTruthy();
    expect(screen.getByTestId('continue_with_local_coverage_button')).toBeEnabled();
    expect(screen.getByText('Continuing cells: cell-a7, cell-a8')).toBeTruthy();
  });

  it('does not show the map-preparation panel for ordinary prepared incidents with map packs', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);

    const { screen } = await renderLiveOperations({ database, initialIncidentId: 'incident-prepared' });

    await waitFor(() => expect(screen.getByText('Incident: Prepared flood response')).toBeTruthy());

    expect(screen.queryByTestId('map_preparation_panel')).toBeNull();
  });

  it('creates offline resource reports for selected-center needs and surplus', async () => {
    const { screen } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());
    await pressAndFlush(screen.getByText('Create pending center'));

    await waitFor(() => expect(screen.getByText('Report need')).toBeTruthy());
    await pressAndFlush(screen.getByTestId('report_need_button'));
    await waitFor(() => expect(screen.getByText('Water · 24 boxes · high')).toBeTruthy());
    expect(screen.getByText('Constraints: sealed bottles preferred')).toBeTruthy();
    expect(screen.getByText('Local pending · verify before acting')).toBeTruthy();

    await pressAndFlush(screen.getByTestId('report_surplus_button'));
    await waitFor(() => expect(screen.getByText('Blankets · 12 units · medium')).toBeTruthy());
    expect(screen.getAllByText('Local pending · verify before acting')).toHaveLength(2);
  });

  it('exposes trusted-by-context trust state on resource reports from canonical backend state', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);
    await createOfflineWorkCenter({
      database,
      signer: new FakeOperationSigner('resource-trust-center-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      centerId: 'center-resource-trust-1',
    });
    await createOfflineResourceReport({
      database,
      signer: new FakeOperationSigner('resource-trust-report-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      workCenterId: 'center-resource-trust-1',
      reportId: 'report-trust-1',
      payload: {
        category: 'Water',
        quantityApprox: '24 boxes',
        urgency: 'high',
        constraints: [],
        reportKind: 'needed',
      },
    });
    await appendSignedOperationAndMaterialize({
      database,
      signer: new FakeOperationSigner('resource-trust-signal-tests'),
      input: {
        actorKeyId: 'actor-key-1',
        deviceId: 'device-1',
        incidentId: 'incident-prepared',
        cellId: 'cell-a7',
        entityId: 'trust-signal-resource-1',
        opType: 'trust_signal.create',
        payload: {
          channel: 'mobile',
          externalId: 'actor-key-1',
          subject: { entityType: 'resource_report', entityId: 'report-trust-1', incidentId: 'incident-prepared' },
          signalType: 'context_corroboration',
          sourceKind: 'system_context',
          trustState: {
            incidentId: 'incident-prepared',
            subject: { entityType: 'resource_report', entityId: 'report-trust-1', incidentId: 'incident-prepared' },
            status: 'trusted_by_context',
            visibility: 'elevated',
            priorityWeight: 0.8,
            score: 0.8,
            explanation: ['status:trusted_by_context'],
            signalCount: 2,
            disputeCount: 0,
            updatedAt: '2026-06-29T09:05:00.000Z',
          },
        },
        hlc: '2026-06-29T09:05:00.000Z-trust-signal-resource-1-device-1',
        createdAtDevice: '2026-06-29T09:05:00.000Z',
      },
    });

    const { screen } = await renderLiveOperations({ database, initialIncidentId: 'incident-prepared' });

    await waitFor(() => expect(screen.getByText('Water · 24 boxes · high')).toBeTruthy());
    expect(screen.getByText('Trust: trusted by context · 2 signals · 0 disputes')).toBeTruthy();
  });

  it('creates a native local-first SOS and shows honest pending acknowledgement copy', async () => {
    const { screen, database } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Native SOS')).toBeTruthy());

    await pressAndFlush(screen.getByTestId('send_local_sos_button'));

    await waitFor(() => expect(screen.getByText('SOS open · critical')).toBeTruthy());

    expect(screen.getByText('Saved on this device; will sync when transport is available; no acknowledgement yet.')).toBeTruthy();
    expect(screen.getByText('Meshtastic transport unavailable; saved on this device only.')).toBeTruthy();
    expect(screen.getByText('Approximate/last known location: unavailable on this device')).toBeTruthy();
    expect(screen.getAllByText(/no acknowledgement yet/i).length).toBeGreaterThan(0);

    const operations = await database.syncOps.findByIncident('incident-local');
    expect(operations.map((operation) => operation.opType)).toEqual(['incident.create', 'sos.create']);
    expect(operations[1]).toEqual(expect.objectContaining({ opType: 'sos.create', entityType: 'sos', syncState: 'pending', signature: expect.stringContaining('fake-signature') }));
    expect(await database.views.sosSignals.findByIncident('incident-local')).toEqual([
      expect.objectContaining({ status: 'open', syncState: 'pending', provisional: true, provisionalReason: 'offline_pending_sync' }),
    ]);
  });

  it('keeps Slice 6 family reunification out of the native SOS surface', async () => {
    const { screen, database } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Native SOS')).toBeTruthy());
    await pressAndFlush(screen.getByTestId('send_local_sos_button'));

    await waitFor(() => expect(screen.getByText('SOS open · critical')).toBeTruthy());

    expect(screen.queryByText(/family reunification/i)).toBeNull();
    expect(screen.queryByText(/search family/i)).toBeNull();
    expect(screen.queryByText(/child identity/i)).toBeNull();
    expect(screen.queryByText(/minor identity/i)).toBeNull();
    expect(screen.queryByText(/photo/i)).toBeNull();
    expect(screen.queryByText(/exact location/i)).toBeNull();
    expect(screen.getByText('Native SOS')).toBeTruthy();
    expect(screen.getByText('Send local SOS')).toBeTruthy();

    const operations = await database.syncOps.findByIncident('incident-local');
    expect(operations.map((operation) => operation.opType)).toEqual(['incident.create', 'sos.create']);
    expect(operations.map((operation) => operation.opType)).not.toContain('family_reunification.search');
  });

  it('keeps a locally saved SOS visible when Meshtastic transport throws', async () => {
    const sendSos = jest.fn<ReturnType<MeshtasticSosAdapter['sendSos']>, Parameters<MeshtasticSosAdapter['sendSos']>>().mockRejectedValue(new Error('radio write failed'));
    const { screen, database } = await renderLiveOperations({ sosTransport: { sendSos } });

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Native SOS')).toBeTruthy());

    await pressAndFlush(screen.getByTestId('send_local_sos_button'));

    await waitFor(() => expect(screen.getByText('SOS open · critical')).toBeTruthy());

    expect(screen.getByText('SOS saved locally; transport failed and no acknowledgement was received.')).toBeTruthy();
    expect(screen.queryByText('radio write failed')).toBeNull();
    expect(screen.queryByText('Unable to save SOS on this device')).toBeNull();
    expect(sendSos).toHaveBeenCalledTimes(1);

    const operations = await database.syncOps.findByIncident('incident-local');
    expect(operations.map((operation) => operation.opType)).toEqual(['incident.create', 'sos.create']);
    expect(await database.views.sosSignals.findByIncident('incident-local')).toEqual([
      expect.objectContaining({ status: 'open', syncState: 'pending', provisional: true }),
    ]);
  });

  it('shows degraded SOS trust state while keeping local-first pending acknowledgement copy', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);
    await createOfflineSosSignal({
      database,
      signer: new FakeOperationSigner('sos-trust-create-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      sosId: 'sos-trust-1',
    });
    await createOfflineTrustSignal({
      database,
      signer: new FakeOperationSigner('sos-trust-signal-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      trustSignalId: 'trust-signal-sos-1',
      payload: {
        channel: 'mobile',
        externalId: 'actor-key-1',
        subject: { entityType: 'sos_alert', entityId: 'sos-trust-1', incidentId: 'incident-prepared' },
        signalType: 'negative_report',
        sourceKind: 'field_actor',
      },
    });

    const { screen } = await renderLiveOperations({ database, initialIncidentId: 'incident-prepared' });

    await waitFor(() => expect(screen.getByText('SOS open · critical')).toBeTruthy());
    expect(screen.getByText('Saved on this device; will sync when transport is available; no acknowledgement yet.')).toBeTruthy();
    expect(screen.getByText('Trust: degraded · 1 signals · 0 disputes')).toBeTruthy();
    expect(screen.getAllByText(/no acknowledgement yet/i).length).toBeGreaterThan(0);
  });

  it('includes approximate last-known center location and can cancel a local SOS', async () => {
    const { screen, database } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());
    await pressAndFlush(screen.getByText('Create pending center'));
    await waitFor(() => expect(screen.getByText('Send local SOS')).toBeTruthy());

    await pressAndFlush(screen.getByTestId('send_local_sos_button'));
    await waitFor(() => expect(screen.getByText('Approximate/last known location: 41.38, 2.17, approx. 250m')).toBeTruthy());

    await pressAndFlush(screen.getByTestId('cancel_local_sos_button'));
    await waitFor(() => expect(screen.getByText('SOS cancelled · critical')).toBeTruthy());

    const operations = await database.syncOps.findByIncident('incident-local');
    expect(operations.map((operation) => operation.opType)).toEqual(['incident.create', 'work_center.create', 'sos.create', 'sos.cancel']);
    expect(await database.views.sosSignals.findByIncident('incident-local')).toEqual([
      expect.objectContaining({ status: 'cancelled', syncState: 'pending', location: { latitude: 41.38, longitude: 2.17, accuracyMeters: 250 } }),
    ]);
  });

  it('accepts canonical SOS create and cancel payloads for offline signing', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);

    await createOfflineSosSignal({
      database,
      signer: new FakeOperationSigner('canonical-sos-create-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      sosId: 'sos-canonical-1',
      payload: {
        severity: 'trapped',
        message: 'Blocked exit, need extraction',
        location: { latitude: 41.38, longitude: 2.17, accuracyMeters: 300 },
      },
    });
    await cancelOfflineSosSignal({
      database,
      signer: new FakeOperationSigner('canonical-sos-cancel-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      sosId: 'sos-canonical-1',
      payload: { reason: 'Moved to safe point' },
    });

    const operations = await database.syncOps.findByIncident('incident-prepared');
    const sosOperations = operations.filter((operation) => operation.opType.startsWith('sos.'));
    expect(sosOperations).toEqual([
      expect.objectContaining({ opType: 'sos.create', entityId: 'sos-canonical-1', payload: expect.objectContaining({ severity: 'trapped', message: 'Blocked exit, need extraction' }) }),
      expect.objectContaining({ opType: 'sos.cancel', entityId: 'sos-canonical-1', payload: expect.objectContaining({ reason: 'Moved to safe point' }) }),
    ]);
    expect(await database.views.sosSignals.findByIncident('incident-prepared')).toEqual([
      expect.objectContaining({ sosId: 'sos-canonical-1', status: 'cancelled', message: 'Blocked exit, need extraction', syncState: 'pending' }),
    ]);
  });

  it('accepts canonical resource report payloads for offline signing', async () => {
    const database = createInMemoryLocalOperationDatabase();
    await seedPreparedIncident(database);
    await createOfflineWorkCenter({
      database,
      signer: new FakeOperationSigner('resource-canonical-center-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      centerId: 'center-resource-1',
    });

    await createOfflineResourceReport({
      database,
      signer: new FakeOperationSigner('resource-canonical-report-tests'),
      incidentId: 'incident-prepared',
      cellId: 'cell-a7',
      workCenterId: 'center-resource-1',
      reportId: 'report-canonical-1',
      payload: {
        category: 'Medical supplies',
        quantityApprox: '3 kits',
        urgency: 'critical',
        constraints: ['sealed'],
        reportKind: 'needed',
      },
    });

    const operations = await database.syncOps.findByIncident('incident-prepared');
    const resourceOperation = operations.find((operation) => operation.opType === 'resource_report.create');
    expect(resourceOperation).toEqual(
      expect.objectContaining({
        opType: 'resource_report.create',
        version: 1,
        entityId: 'report-canonical-1',
        payload: expect.objectContaining({
          category: 'Medical supplies',
          quantityApprox: '3 kits',
          urgency: 'critical',
          constraints: ['sealed'],
          reportKind: 'needed',
          workCenterId: 'center-resource-1',
        }),
      }),
    );
    expect(await database.views.resourceReports.findByIncident('incident-prepared')).toContainEqual(
      expect.objectContaining({
        reportId: 'report-canonical-1',
        category: 'Medical supplies',
        quantityApprox: '3 kits',
        urgency: 'critical',
        reportKind: 'needed',
        workCenterId: 'center-resource-1',
        provisional: true,
      }),
    );
  });
});

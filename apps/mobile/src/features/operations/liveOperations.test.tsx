/// <reference types="jest" />

import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Theme, TamaguiProvider } from 'tamagui';

import { createInMemoryLocalOperationDatabase } from '@/infrastructure/local-db/local-db';
import { appendSignedOperationAndMaterialize } from '@/infrastructure/oplog/outbox-service';
import { FakeOperationSigner } from '@/infrastructure/security';
import { OperationalThemeProvider } from '@/shared/theme';
import { tamaguiConfig } from '../../../tamagui.config';
import { LiveOperationalEntryScreen } from './liveOperations';

async function renderLiveOperations(input: {
  database?: ReturnType<typeof createInMemoryLocalOperationDatabase>;
  devScenario?: 'missing-local-data' | 'stale-center-data' | 'map-preparation';
  initialIncidentId?: string;
  networkAvailable?: boolean;
  signingKey?: string;
} = {}) {
  const database = input.database ?? createInMemoryLocalOperationDatabase();
  const signer = new FakeOperationSigner(input.signingKey ?? 'slice-b-live-tests');

  const screen = await render(
    <OperationalThemeProvider>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Theme name="light">
          <LiveOperationalEntryScreen database={database} devScenario={input.devScenario} initialIncidentId={input.initialIncidentId} networkAvailable={input.networkAvailable} signer={signer} />
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
    expect(await database.views.workCenters.findByIncident('incident-local')).toEqual([
      expect.objectContaining({ centerId: 'center-local-1', name: 'North triage point', status: 'pending', syncState: 'pending' }),
    ]);
    expect(screen.getAllByText('Pending sync').length).toBeGreaterThan(0);
    expect(screen.getByText('Activation requires sufficient evidence')).toBeTruthy();
    expect(screen.getByText('Dev spike storage: in-memory route only')).toBeTruthy();
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

  it('prevents false activation and exposes selected-center fields without volunteer identities', async () => {
    const { screen } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());
    await pressAndFlush(screen.getByText('Create pending center'));

    await waitFor(() => expect(screen.getByText('State: pending')).toBeTruthy());

    expect(screen.queryByText('State: active')).toBeNull();
    expect(screen.getByText('Confidence: local estimate')).toBeTruthy();
    expect(screen.getByText('Freshness: local pending')).toBeTruthy();
    expect(screen.getByText('Risk: precaution')).toBeTruthy();
    expect(screen.getByText('Need: Water')).toBeTruthy();
    expect(screen.getByText('Surplus: none reported')).toBeTruthy();
    expect(screen.getByText('Roles: 0 active')).toBeTruthy();
    expect(screen.getByText('Check in')).toBeTruthy();
    expect(screen.queryByText('volunteer-1')).toBeNull();
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

  it('adds local active presence to the base role count instead of replacing it', async () => {
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
        payload: { name: 'Role summary point', roleCount: 3 },
        hlc: '2026-06-29T09:02:00.000Z-0002-device-1',
        createdAtDevice: '2026-06-29T09:02:00.000Z',
      },
    });

    const { screen } = await renderLiveOperations({ database, initialIncidentId: 'incident-prepared' });
    await waitFor(() => expect(screen.getByText('Roles: 3 active')).toBeTruthy());
    await pressAndFlush(screen.getByTestId('presence_check_in_button'));

    await waitFor(() => expect(screen.getByText('Roles: 4 active')).toBeTruthy());
  });

  it('degrades stale selected-center role, need, surplus, and confidence data textually', async () => {
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
          confidence: 'local estimate',
          surplus: 'blankets reported',
          roleCount: 3,
          staleFields: ['confidence', 'roles', 'need', 'surplus'],
        },
        hlc: '2026-06-29T09:02:00.000Z-0002-device-1',
        createdAtDevice: '2026-06-29T09:02:00.000Z',
      },
    });

    const { screen } = await renderLiveOperations({ database, initialIncidentId: 'incident-prepared' });

    await waitFor(() => expect(screen.getByText('Stale center data: confidence, roles, need, surplus need verification before action')).toBeTruthy());

    expect(screen.getByText('Confidence: local estimate — stale, verify before acting')).toBeTruthy();
    expect(screen.getByText('Need: Water — stale, verify before acting')).toBeTruthy();
    expect(screen.getByText('Surplus: blankets reported — stale, verify before acting')).toBeTruthy();
    expect(screen.getByText('Roles: 3 active — stale, verify before acting')).toBeTruthy();
    expect(screen.queryByText('Freshness: local pending')).toBeNull();
  });

  it('seeds a stale-center dev scenario for deterministic E2E coverage', async () => {
    const { screen } = await renderLiveOperations({ devScenario: 'stale-center-data' });

    await waitFor(() => expect(screen.getByText('Incident: Prepared stale response')).toBeTruthy());

    expect(screen.getAllByText('Stale logistics point')).toHaveLength(2);
    expect(screen.getByText('State: pending')).toBeTruthy();
    expect(screen.getByText('Stale center data: confidence, roles, need, surplus need verification before action')).toBeTruthy();
    expect(screen.getByText('Confidence: local estimate — stale, verify before acting')).toBeTruthy();
    expect(screen.getByText('Need: Water — stale, verify before acting')).toBeTruthy();
    expect(screen.getByText('Surplus: blankets reported — stale, verify before acting')).toBeTruthy();
    expect(screen.getByText('Roles: 3 active — stale, verify before acting')).toBeTruthy();
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

  it('labels unwired report actions as unavailable instead of presenting live actions', async () => {
    const { screen } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));
    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());
    await pressAndFlush(screen.getByText('Create pending center'));

    await waitFor(() => expect(screen.getByText('Report need unavailable')).toBeDisabled());
    expect(screen.getByText('Report surplus unavailable')).toBeDisabled();
  });
});

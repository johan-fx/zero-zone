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
  initialIncidentId?: string;
  signingKey?: string;
} = {}) {
  const database = input.database ?? createInMemoryLocalOperationDatabase();
  const signer = new FakeOperationSigner(input.signingKey ?? 'slice-b-live-tests');

  const screen = await render(
    <OperationalThemeProvider>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Theme name="light">
          <LiveOperationalEntryScreen database={database} initialIncidentId={input.initialIncidentId} signer={signer} />
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
  });

  it('creates an unverified offline incident as a pending signed outbox operation', async () => {
    const { screen, database } = await renderLiveOperations();

    await pressAndFlush(screen.getByText('Create local incident'));

    await waitFor(() => expect(screen.getByText('Incident: Local flood response')).toBeTruthy());

    const operations = await database.syncOps.findByIncident('incident-local');
    expect(operations).toEqual([expect.objectContaining({ opType: 'incident.create', syncState: 'pending', signature: expect.stringContaining('fake-signature') })]);
    expect(screen.getByText('Status: unverified')).toBeTruthy();
    expect(screen.getByText('Outbox: 1 pending')).toBeTruthy();
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
});

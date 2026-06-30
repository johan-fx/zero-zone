import { useEffect, useState } from 'react';

import type { HealthResponse, WorkCenterDetail, WorkCenterSummary } from '@zona-cero/contracts';
import { fetchApiHealth, fetchWorkCenterDetail, fetchWorkCenters } from './api';
import './styles.css';

type HealthState =
  | { status: 'loading' }
  | { status: 'ready'; health: HealthResponse }
  | { status: 'error'; message: string };

type WorkCenterState =
  | { status: 'loading' }
  | { status: 'ready'; workCenters: WorkCenterSummary[]; selected: WorkCenterDetail | null }
  | { status: 'error'; message: string };

const defaultIncidentId = 'incident-zc-demo';

export function App() {
  const incidentId = import.meta.env.VITE_INCIDENT_ID || defaultIncidentId;
  const [healthState, setHealthState] = useState<HealthState>({ status: 'loading' });
  const [workCenterState, setWorkCenterState] = useState<WorkCenterState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    fetchApiHealth()
      .then((health) => {
        if (active) setHealthState({ status: 'ready', health });
      })
      .catch((error: unknown) => {
        if (active) setHealthState({ status: 'error', message: errorMessage(error) });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadWorkCenters() {
      const { workCenters } = await fetchWorkCenters(incidentId);
      const firstWorkCenter = workCenters[0];
      const selected = firstWorkCenter
        ? (await fetchWorkCenterDetail(incidentId, firstWorkCenter.workCenterId)).workCenter
        : null;

      if (active) setWorkCenterState({ status: 'ready', workCenters, selected });
    }

    loadWorkCenters().catch((error: unknown) => {
      if (active) setWorkCenterState({ status: 'error', message: errorMessage(error) });
    });

    return () => {
      active = false;
    };
  }, [incidentId]);

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Zona Cero Web UI</p>
        <h1 id="page-title">Work centers live operations panel</h1>
        <p className="summary">Online list, detail and map-lite views consume backend work center contracts directly.</p>
      </section>

      <section className="status-card" aria-live="polite">
        <h2>Backend health</h2>
        {healthState.status === 'loading' ? <p>Checking API health…</p> : null}
        {healthState.status === 'ready' ? (
          <p data-testid="api-health">{healthState.health.service} is online ({healthState.health.version})</p>
        ) : null}
        {healthState.status === 'error' ? <p role="alert">{healthState.message}</p> : null}
      </section>

      <section className="status-card" aria-labelledby="work-centers-title" aria-live="polite">
        <div className="section-header">
          <div>
            <p className="eyebrow">Incident {incidentId}</p>
            <h2 id="work-centers-title">Work centers</h2>
          </div>
          {workCenterState.status === 'ready' ? <strong>{workCenterState.workCenters.length} online</strong> : null}
        </div>

        {workCenterState.status === 'loading' ? <p>Loading work centers…</p> : null}
        {workCenterState.status === 'error' ? <p role="alert">{workCenterState.message}</p> : null}
        {workCenterState.status === 'ready' ? <WorkCenterOnlineView state={workCenterState} /> : null}
      </section>
    </main>
  );
}

function WorkCenterOnlineView({ state }: { state: Extract<WorkCenterState, { status: 'ready' }> }) {
  if (state.workCenters.length === 0) {
    return <p>No work centers reported yet.</p>;
  }

  return (
    <div className="work-center-grid">
      <div>
        <h3>List</h3>
        <ul className="work-center-list">
          {state.workCenters.map((workCenter) => (
            <li key={workCenter.workCenterId}>
              <article className="work-center-card">
                <h4>{workCenter.name}</h4>
                <StatusStrip workCenter={workCenter} />
                <p>{workCenter.centerType ?? 'Uncategorized'} · Priority {workCenter.priority}</p>
              </article>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3>Detail</h3>
        {state.selected ? <WorkCenterDetailCard workCenter={state.selected} /> : <p>Select a work center to inspect its detail.</p>}
      </div>

      <div>
        <h3>Map-lite</h3>
        <ol className="map-lite" aria-label="Work center coordinates">
          {state.workCenters.map((workCenter) => (
            <li key={workCenter.workCenterId}>
              <span>{workCenter.name}</span>
              <strong>{formatLocation(workCenter.location)}</strong>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function WorkCenterDetailCard({ workCenter }: { workCenter: WorkCenterDetail }) {
  return (
    <article className="work-center-card detail-card">
      <h4>{workCenter.name}</h4>
      <StatusStrip workCenter={workCenter} />
      <dl>
        <dt>Description</dt>
        <dd>{workCenter.description ?? 'No description provided'}</dd>
        <dt>Initial need</dt>
        <dd>{workCenter.initialNeed ?? 'No initial need provided'}</dd>
        <dt>Surplus</dt>
        <dd>{workCenter.surplus ?? 'No surplus provided'}</dd>
        <dt>Signals</dt>
        <dd>{workCenter.signalCount} total · {workCenter.corroboratingSignalCount} corroborating</dd>
      </dl>
      <ul className="signal-list" aria-label="Latest signals">
        {workCenter.latestSignals.map((signal) => (
          <li key={signal.signalId}>{signal.signalType} from {signal.sourceChannel}</li>
        ))}
      </ul>
    </article>
  );
}

function StatusStrip({ workCenter }: { workCenter: WorkCenterSummary | WorkCenterDetail }) {
  return (
    <dl className="status-strip" aria-label={`${workCenter.name} backend status`}>
      <div><dt>Status</dt><dd>{workCenter.status}</dd></div>
      <div><dt>Activation</dt><dd>{workCenter.activationState}</dd></div>
      <div><dt>Freshness</dt><dd>{workCenter.freshness}</dd></div>
      <div><dt>Confidence</dt><dd>{workCenter.confidence}</dd></div>
      <div><dt>Risk</dt><dd>{workCenter.risk}</dd></div>
    </dl>
  );
}

function formatLocation(location: WorkCenterSummary['location']): string {
  if (!location) return 'No coordinates';
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

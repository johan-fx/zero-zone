import { useEffect, useState } from 'react';

import type { DispatchTask, DispatchTaskStatus, HealthResponse, ResourceReportSummary, WorkCenterDetail, WorkCenterSummary } from '@zona-cero/contracts';
import { fetchApiHealth, fetchDispatchTasks, fetchResourceReports, fetchWorkCenterDetail, fetchWorkCenters, updateDispatchTask } from './api';
import './styles.css';

type HealthState =
  | { status: 'loading' }
  | { status: 'ready'; health: HealthResponse }
  | { status: 'error'; message: string };

type WorkCenterState =
  | { status: 'loading' }
  | { status: 'ready'; workCenters: WorkCenterSummary[]; selected: WorkCenterDetail | null }
  | { status: 'error'; message: string };

type ResourceState =
  | { status: 'loading' }
  | { status: 'ready'; reports: ResourceReportSummary[] }
  | { status: 'error'; message: string };

type DispatchState =
  | { status: 'loading' }
  | { status: 'ready'; tasks: DispatchTask[]; actionMessage?: string }
  | { status: 'error'; message: string };

const defaultIncidentId = 'incident-zc-demo';
const dispatchActions: { label: string; status: Exclude<DispatchTaskStatus, 'pending'> }[] = [
  { label: 'Accept', status: 'accepted' },
  { label: 'En route', status: 'en_route' },
  { label: 'Delivered', status: 'delivered' },
  { label: 'Cancel', status: 'cancelled' },
];

export function App() {
  const incidentId = import.meta.env.VITE_INCIDENT_ID || defaultIncidentId;
  const [healthState, setHealthState] = useState<HealthState>({ status: 'loading' });
  const [workCenterState, setWorkCenterState] = useState<WorkCenterState>({ status: 'loading' });
  const [resourceState, setResourceState] = useState<ResourceState>({ status: 'loading' });
  const [dispatchState, setDispatchState] = useState<DispatchState>({ status: 'loading' });

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

    async function loadResources() {
      const { resourceReports } = await fetchResourceReports(incidentId);
      if (active) setResourceState({ status: 'ready', reports: resourceReports });
    }

    async function loadDispatchTasks() {
      const { dispatchTasks } = await fetchDispatchTasks(incidentId);
      if (active) setDispatchState({ status: 'ready', tasks: dispatchTasks });
    }

    loadWorkCenters().catch((error: unknown) => {
      if (active) setWorkCenterState({ status: 'error', message: errorMessage(error) });
    });
    loadResources().catch((error: unknown) => {
      if (active) setResourceState({ status: 'error', message: errorMessage(error) });
    });
    loadDispatchTasks().catch((error: unknown) => {
      if (active) setDispatchState({ status: 'error', message: errorMessage(error) });
    });

    return () => {
      active = false;
    };
  }, [incidentId]);

  async function handleDispatchAction(task: DispatchTask, status: Exclude<DispatchTaskStatus, 'pending'>) {
    if (dispatchState.status !== 'ready') return;

    try {
      const response = await updateDispatchTask(incidentId, task.dispatchTaskId, {
        channel: 'web-ui',
        externalId: 'web-ui-operator',
        status,
      });
      setDispatchState({
        status: 'ready',
        tasks: dispatchState.tasks.map((candidate) =>
          candidate.dispatchTaskId === response.dispatchTask.dispatchTaskId ? response.dispatchTask : candidate,
        ),
        actionMessage: `Task ${response.dispatchTask.dispatchTaskId} updated to ${response.dispatchTask.status}.`,
      });
    } catch (error: unknown) {
      setDispatchState({ ...dispatchState, actionMessage: errorMessage(error) });
    }
  }

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Zona Cero Web UI</p>
        <h1 id="page-title">Work centers live operations panel</h1>
        <p className="summary">Online list, detail, resources and logistics views consume backend contracts directly.</p>
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

      <section className="status-card" aria-labelledby="resources-title" aria-live="polite">
        <div className="section-header">
          <div>
            <p className="eyebrow">Resources</p>
            <h2 id="resources-title">Needs and surplus</h2>
          </div>
          {resourceState.status === 'ready' ? <strong>{resourceState.reports.length} reports</strong> : null}
        </div>
        {resourceState.status === 'loading' ? <p>Loading resource reports…</p> : null}
        {resourceState.status === 'error' ? <p role="alert">{resourceState.message}</p> : null}
        {resourceState.status === 'ready' ? <ResourceReportView reports={resourceState.reports} /> : null}
      </section>

      <section className="status-card" aria-labelledby="dispatch-title" aria-live="polite">
        <div className="section-header">
          <div>
            <p className="eyebrow">Logistics</p>
            <h2 id="dispatch-title">Dispatch tasks</h2>
          </div>
          {dispatchState.status === 'ready' ? <strong>{dispatchState.tasks.length} tasks</strong> : null}
        </div>
        {dispatchState.status === 'loading' ? <p>Loading dispatch tasks…</p> : null}
        {dispatchState.status === 'error' ? <p role="alert">{dispatchState.message}</p> : null}
        {dispatchState.status === 'ready' ? (
          <DispatchTaskView state={dispatchState} onAction={handleDispatchAction} />
        ) : null}
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

function ResourceReportView({ reports }: { reports: ResourceReportSummary[] }) {
  if (reports.length === 0) return <p>No resource reports yet.</p>;

  const needed = reports.filter((report) => report.reportKind === 'needed');
  const surplus = reports.filter((report) => report.reportKind === 'surplus');

  return (
    <div className="resource-grid">
      <ResourceColumn title="Needed" reports={needed} />
      <ResourceColumn title="Surplus" reports={surplus} />
    </div>
  );
}

function ResourceColumn({ title, reports }: { title: string; reports: ResourceReportSummary[] }) {
  return (
    <div>
      <h3>{title}</h3>
      {reports.length === 0 ? <p>No {title.toLowerCase()} reports.</p> : null}
      <ul className="work-center-list">
        {reports.map((report) => (
          <li key={report.resourceReportId}>
            <article className="work-center-card">
              <h4>{report.category}</h4>
              <p>{report.quantityApprox} · Urgency {report.urgency}</p>
              <p>Work center: {report.workCenterId ?? 'not linked'}</p>
              <p>Restrictions: {report.constraints.length ? report.constraints.join(', ') : 'none'}</p>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DispatchTaskView({
  state,
  onAction,
}: {
  state: Extract<DispatchState, { status: 'ready' }>;
  onAction: (task: DispatchTask, status: Exclude<DispatchTaskStatus, 'pending'>) => void;
}) {
  if (state.tasks.length === 0) return <p>No dispatch tasks yet.</p>;

  return (
    <div>
      {state.actionMessage ? <p role="status">{state.actionMessage}</p> : null}
      <ul className="work-center-list">
        {state.tasks.map((task) => (
          <li key={task.dispatchTaskId}>
            <article className="work-center-card dispatch-card">
              <div>
                <h4>{task.category}</h4>
                <p>{task.quantityApprox} · Status {task.status}</p>
                <p>Target: {task.targetWorkCenterId ?? 'not linked'}</p>
              </div>
              <div className="action-row">
                {dispatchActions.map((action) => (
                  <button key={action.status} type="button" onClick={() => onAction(task, action.status)} disabled={task.status === action.status}>
                    {action.label}
                  </button>
                ))}
              </div>
            </article>
          </li>
        ))}
      </ul>
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

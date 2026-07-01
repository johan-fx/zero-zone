import { type FormEvent, useEffect, useState } from 'react';

import type {
  DispatchTask,
  DispatchTaskStatus,
  FamilyReunificationSearchResponse,
  HealthResponse,
  PrivateWebLinkConsumeResponse,
  PrivateWebLinkValidateResponse,
  ResourceReportSummary,
  SosAlert,
  SosAlertStatusResponse,
  SosFanoutStatus,
  WorkCenterDetail,
  WorkCenterSummary,
  SyncFreshness,
} from '@zona-cero/contracts';
import {
  consumePrivateFamilyReunificationLink,
  createSosAlert,
  fetchApiHealth,
  fetchDispatchTasks,
  fetchResourceReports,
  fetchSosStatus,
  fetchSyncFreshness,
  fetchWorkCenterDetail,
  fetchWorkCenters,
  searchFamilyReunification,
  updateDispatchTask,
  validatePrivateFamilyReunificationLink,
} from './api';
import './styles.css';

type HealthState =
  | { status: 'loading' }
  | { status: 'ready'; health: HealthResponse }
  | { status: 'error'; message: string };

type WorkCenterState =
  | { status: 'loading' }
  | { status: 'ready'; workCenters: WorkCenterSummary[]; selected: WorkCenterDetail | null }
  | { status: 'error'; message: string };

type ChannelFreshnessState =
  | { status: 'loading' }
  | { status: 'ready'; freshness: SyncFreshness }
  | { status: 'error'; message: string };

type ResourceState =
  | { status: 'loading' }
  | { status: 'ready'; reports: ResourceReportSummary[] }
  | { status: 'error'; message: string };

type DispatchState =
  | { status: 'loading' }
  | { status: 'ready'; tasks: DispatchTask[]; actionMessage?: string }
  | { status: 'error'; message: string };

type SosState =
  | { status: 'loading' }
  | { status: 'ready'; response: SosAlertStatusResponse; actionMessage?: string }
  | { status: 'error'; message: string };

type FamilyReunificationState =
  | { status: 'validating' }
  | { status: 'ready'; validation: PrivateWebLinkValidateResponse; search?: FamilyReunificationSearchResponse; referral?: PrivateWebLinkConsumeResponse; message?: string }
  | { status: 'error'; message: string };

type FamilyReunificationForm = {
  ageBand: '' | 'child' | 'teen' | 'adult' | 'older_adult';
  relationHint: string;
  lastKnownAreaLabel: string;
};

const defaultIncidentId = 'incident-zc-demo';
const defaultCellId = 'cell-zc-demo';
const defaultWebExternalId = 'web-user-1001';
const defaultWebDisplayName = 'Field Web';
const strongSosConfirmation = 'CONFIRM SOS';
const dispatchActions: { label: string; status: Exclude<DispatchTaskStatus, 'pending'> }[] = [
  { label: 'Accept', status: 'accepted' },
  { label: 'En route', status: 'en_route' },
  { label: 'Delivered', status: 'delivered' },
  { label: 'Cancel', status: 'cancelled' },
];

export function App() {
  const privateLinkParams = getPrivateLinkParams();

  if (privateLinkParams) {
    return (
      <FamilyReunificationPrivateView
        token={privateLinkParams.token}
        correlationId={privateLinkParams.correlationId}
        fingerprint={getBrowserFingerprint()}
      />
    );
  }

  return <OperationsPanel />;
}

function OperationsPanel() {
  const incidentId = import.meta.env.VITE_INCIDENT_ID || defaultIncidentId;
  const cellId = import.meta.env.VITE_CELL_ID || defaultCellId;
  const webExternalId = import.meta.env.VITE_WEB_EXTERNAL_ID || defaultWebExternalId;
  const webDisplayName = import.meta.env.VITE_WEB_DISPLAY_NAME || defaultWebDisplayName;
  const [healthState, setHealthState] = useState<HealthState>({ status: 'loading' });
  const [workCenterState, setWorkCenterState] = useState<WorkCenterState>({ status: 'loading' });
  const [channelFreshnessState, setChannelFreshnessState] = useState<ChannelFreshnessState>({ status: 'loading' });
  const [resourceState, setResourceState] = useState<ResourceState>({ status: 'loading' });
  const [dispatchState, setDispatchState] = useState<DispatchState>({ status: 'loading' });
  const [sosState, setSosState] = useState<SosState>({ status: 'loading' });
  const [sosConfirmation, setSosConfirmation] = useState('');
  const [isSosSubmitting, setIsSosSubmitting] = useState(false);
  const [sosPendingReportedAt, setSosPendingReportedAt] = useState<string | null>(null);

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

    async function loadChannelFreshness() {
      const freshness = await fetchSyncFreshness(incidentId, cellId);
      if (active) setChannelFreshnessState({ status: 'ready', freshness });
    }

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

    async function loadSosStatus() {
      const response = await fetchSosStatus(incidentId);
      if (active) setSosState({ status: 'ready', response });
    }

    loadChannelFreshness().catch((error: unknown) => {
      if (active) setChannelFreshnessState({ status: 'error', message: errorMessage(error) });
    });
    loadWorkCenters().catch((error: unknown) => {
      if (active) setWorkCenterState({ status: 'error', message: errorMessage(error) });
    });
    loadResources().catch((error: unknown) => {
      if (active) setResourceState({ status: 'error', message: errorMessage(error) });
    });
    loadDispatchTasks().catch((error: unknown) => {
      if (active) setDispatchState({ status: 'error', message: errorMessage(error) });
    });
    loadSosStatus().catch((error: unknown) => {
      if (active) setSosState({ status: 'error', message: errorMessage(error) });
    });

    return () => {
      active = false;
    };
  }, [incidentId, cellId]);

  async function handleDispatchAction(task: DispatchTask, status: Exclude<DispatchTaskStatus, 'pending'>) {
    if (dispatchState.status !== 'ready') return;

    try {
      const response = await updateDispatchTask(incidentId, task.dispatchTaskId, {
        channel: 'web-ui',
        externalId: webExternalId,
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

  async function handleSosSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sosState.status !== 'ready' || isSosSubmitting) return;

    if (sosConfirmation.trim() !== strongSosConfirmation) {
      setSosState({
        ...sosState,
        actionMessage: `Type ${strongSosConfirmation} exactly before submitting SOS. Backend recording does not confirm delivery or rescue.`,
      });
      return;
    }

    const reportedAt = sosPendingReportedAt ?? new Date().toISOString();
    setSosPendingReportedAt(reportedAt);
    setIsSosSubmitting(true);

    try {
      const response = await createSosAlert(incidentId, {
        channel: 'web-ui',
        externalId: webExternalId,
        displayName: webDisplayName,
        payload: { severity: 'critical', reportedAt },
      });

      setSosState({
        status: 'ready',
        response: {
          sosAlerts: upsertSosAlert(sosState.response.sosAlerts, response.sosAlert),
          fanout: response.fanout,
        },
        actionMessage: `SOS ID: ${response.sosAlert.sosAlertId}. Status: ${response.sosAlert.status}. ${formatFanout(response.fanout)} Backend recording only; delivery, rescue, and exact location are not confirmed.`,
      });
      setSosConfirmation('');
      setSosPendingReportedAt(null);
    } catch (error: unknown) {
      setSosState({ ...sosState, actionMessage: errorMessage(error) });
    } finally {
      setIsSosSubmitting(false);
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

      <ChannelFreshnessBanner state={channelFreshnessState} />

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

      <section className="status-card sos-card" aria-labelledby="sos-title" aria-live="polite">
        <div className="section-header">
          <div>
            <p className="eyebrow">Critical</p>
            <h2 id="sos-title">Connected SOS</h2>
          </div>
          {sosState.status === 'ready' ? <strong>{sosState.response.sosAlerts.length} alerts</strong> : null}
        </div>
        <p className="summary">Records SOS in the backend and shows backend fan-out state. It does not confirm delivery or rescue.</p>
        {sosState.status === 'loading' ? <p>Loading SOS status…</p> : null}
        {sosState.status === 'error' ? <p role="alert">{sosState.message}</p> : null}
        {sosState.status === 'ready' ? (
          <SosPanel
            state={sosState}
            confirmation={sosConfirmation}
            onConfirmationChange={setSosConfirmation}
            isSubmitting={isSosSubmitting}
            onSubmit={handleSosSubmit}
          />
        ) : null}
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

function FamilyReunificationPrivateView({
  token,
  correlationId,
  fingerprint,
}: {
  token: string;
  correlationId: string;
  fingerprint: string;
}) {
  const [state, setState] = useState<FamilyReunificationState>({ status: 'validating' });
  const [form, setForm] = useState<FamilyReunificationForm>({
    ageBand: '',
    relationHint: '',
    lastKnownAreaLabel: '',
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isReferring, setIsReferring] = useState(false);

  useEffect(() => {
    let active = true;

    validatePrivateFamilyReunificationLink({
      token,
      scope: 'family_reunification.search',
      correlationId,
      fingerprint,
    })
      .then((validation) => {
        if (active) setState({ status: 'ready', validation });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: formatPrivateLinkError(error) });
      });

    return () => {
      active = false;
    };
  }, [token, correlationId, fingerprint]);

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== 'ready' || isSearching) return;

    setIsSearching(true);
    try {
      const search = await searchFamilyReunification({
        token,
        correlationId,
        fingerprint,
        query: {
          ...(form.ageBand ? { ageBand: form.ageBand } : {}),
          ...(form.relationHint.trim() ? { relationHint: form.relationHint.trim() } : {}),
          ...(form.lastKnownAreaLabel.trim() ? { lastKnownAreaLabel: form.lastKnownAreaLabel.trim() } : {}),
        },
      });
      setState({ ...state, search, message: 'Search completed. Continue with in-person verification.' });
    } catch (error: unknown) {
      setState({ ...state, message: formatPrivateLinkError(error) });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleInPersonReferral() {
    if (state.status !== 'ready' || isReferring) return;

    setIsReferring(true);
    try {
      const referral = await consumePrivateFamilyReunificationLink({
        token,
        scope: 'family_reunification.search',
        correlationId,
        fingerprint,
        referralReason: 'family_reunification_in_person_verification',
      });
      setState({ ...state, referral, message: referral.referral.message });
    } catch (error: unknown) {
      setState({ ...state, message: formatPrivateLinkError(error) });
    } finally {
      setIsReferring(false);
    }
  }

  return (
    <main className="shell private-shell">
      <section className="hero private-hero" aria-labelledby="family-reunification-title">
        <p className="eyebrow">Private family reunification</p>
        <h1 id="family-reunification-title">Identity-safe search and in-person referral</h1>
        <p className="summary">
          This private web page uses the server-side link authority. It never trusts TTL, scope, correlation, or consumption status from this browser.
        </p>
      </section>

      <section className="status-card safety-card" aria-labelledby="family-limits-title">
        <h2 id="family-limits-title">Safety limits</h2>
        <ul className="safety-list">
          <li>No photos are requested or shown.</li>
          <li>No exact location is requested or shown.</li>
          <li>No full identity of minors is requested or shown.</li>
          <li>All possible matches require in-person verification at the family reunification desk.</li>
        </ul>
      </section>

      {state.status === 'validating' ? (
        <section className="status-card" aria-live="polite">
          <h2>Checking private link</h2>
          <p>Validating access with the backend…</p>
        </section>
      ) : null}

      {state.status === 'error' ? (
        <section className="status-card" aria-live="polite">
          <h2>Private link unavailable</h2>
          <p role="alert">{state.message}</p>
          <p>Go to the family reunification desk for in-person help. Do not share sensitive details in chat.</p>
        </section>
      ) : null}

      {state.status === 'ready' ? (
        <section className="status-card" aria-labelledby="private-search-title" aria-live="polite">
          <div className="section-header">
            <div>
              <p className="eyebrow">Incident {state.validation.incidentId}</p>
              <h2 id="private-search-title">Minimized private search</h2>
            </div>
            <strong>In-person verification required</strong>
          </div>

          {state.message ? <p role="status">{state.message}</p> : null}

          <form className="family-form" onSubmit={handleSearchSubmit}>
            <label htmlFor="family-age-band">Approximate age band</label>
            <select
              id="family-age-band"
              name="ageBand"
              value={form.ageBand}
              onChange={(event) => setForm({ ...form, ageBand: event.currentTarget.value as FamilyReunificationForm['ageBand'] })}
            >
              <option value="">Unknown</option>
              <option value="child">Child</option>
              <option value="teen">Teen</option>
              <option value="adult">Adult</option>
              <option value="older_adult">Older adult</option>
            </select>

            <label htmlFor="family-relation-hint">Relationship hint</label>
            <input
              id="family-relation-hint"
              name="relationHint"
              maxLength={80}
              value={form.relationHint}
              onChange={(event) => setForm({ ...form, relationHint: event.currentTarget.value })}
              placeholder="Example: parent looking for child"
            />

            <label htmlFor="family-area-label">Broad last-known area label</label>
            <input
              id="family-area-label"
              name="lastKnownAreaLabel"
              maxLength={120}
              value={form.lastKnownAreaLabel}
              onChange={(event) => setForm({ ...form, lastKnownAreaLabel: event.currentTarget.value })}
              placeholder="Example: north gate area"
            />

            <button type="submit" disabled={isSearching}>{isSearching ? 'Searching…' : 'Search safely'}</button>
          </form>

          {state.search ? <FamilyReunificationResults response={state.search} /> : null}

          <button className="primary-action" type="button" onClick={handleInPersonReferral} disabled={isReferring}>
            {isReferring ? 'Preparing referral…' : 'Continue to in-person verification'}
          </button>
        </section>
      ) : null}
    </main>
  );
}

function FamilyReunificationResults({ response }: { response: FamilyReunificationSearchResponse }) {
  return (
    <div className="family-results">
      <h3>Minimized results</h3>
      {response.matches.length === 0 ? <p>No public result. Continue with in-person verification.</p> : null}
      <ul className="work-center-list">
        {response.matches.map((match) => (
          <li key={match.matchId}>
            <article className="work-center-card">
              <h4>{match.status === 'possible_match' ? 'Possible in-person match' : 'No public result'}</h4>
              <p>Age band: {match.ageBand ?? 'not provided'}</p>
              <p>Relationship hint: {match.relationHint ?? 'not provided'}</p>
              <p>Broad area: {match.lastKnownAreaLabel ?? 'not provided'}</p>
              <p>Verification required: {match.verificationRequired ? 'yes' : 'no'}</p>
            </article>
          </li>
        ))}
      </ul>
      <p>{response.referral.message}</p>
    </div>
  );
}

function SosPanel({
  state,
  confirmation,
  onConfirmationChange,
  isSubmitting,
  onSubmit,
}: {
  state: Extract<SosState, { status: 'ready' }>;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  isSubmitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div>
      {state.actionMessage ? <p role="status">{state.actionMessage}</p> : null}
      <FanoutStrip fanout={state.response.fanout} />
      <form className="sos-form" onSubmit={onSubmit}>
        <label htmlFor="sos-confirmation">Type CONFIRM SOS to submit</label>
        <input
          id="sos-confirmation"
          name="sos-confirmation"
          value={confirmation}
          onChange={(event) => onConfirmationChange(event.currentTarget.value)}
          aria-describedby="sos-copy"
          disabled={isSubmitting}
        />
        <p id="sos-copy">No delivery, rescue, or exact-location confirmation is implied by this action.</p>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting SOS…' : 'Submit SOS'}</button>
      </form>
      <SosAlertList alerts={state.response.sosAlerts} />
    </div>
  );
}

function FanoutStrip({ fanout }: { fanout: SosFanoutStatus }) {
  return (
    <dl className="status-strip" aria-label="SOS backend fan-out status">
      <div><dt>Total</dt><dd>{fanout.total}</dd></div>
      <div><dt>Queued</dt><dd>{fanout.queued}</dd></div>
      <div><dt>Pending</dt><dd>{fanout.pending}</dd></div>
      <div><dt>Failed</dt><dd>{fanout.failed}</dd></div>
      <div><dt>Cancelled</dt><dd>{fanout.cancelled}</dd></div>
    </dl>
  );
}

function SosAlertList({ alerts }: { alerts: SosAlert[] }) {
  if (alerts.length === 0) return <p>No SOS alerts recorded for this incident.</p>;

  return (
    <ul className="work-center-list">
      {alerts.map((alert) => (
        <li key={alert.sosAlertId}>
          <article className="work-center-card">
            <h4>SOS ID: {alert.sosAlertId}</h4>
            <p>Status: {alert.status} · Severity {alert.severity}</p>
            <p>Source: {alert.sourceChannel ?? 'unknown'}</p>
            <p>{formatSosAlertLocation(alert)}</p>
          </article>
        </li>
      ))}
    </ul>
  );
}


function ChannelFreshnessBanner({ state }: { state: ChannelFreshnessState }) {
  if (state.status === 'loading') return null;

  if (state.status === 'error') {
    return (
      <section className="status-card channel-warning" role="status" aria-live="polite">
        <h2>Channel freshness unavailable</h2>
        <p>Could not load backend freshness signals. Treat this web view as informational until the API responds.</p>
      </section>
    );
  }

  const warning = describeChannelFreshnessWarning(state.freshness);
  if (!warning) return null;

  return (
    <section className="status-card channel-warning" role="status" aria-live="polite">
      <div className="section-header">
        <div>
          <p className="eyebrow">Channel limitation</p>
          <h2>{warning.title}</h2>
        </div>
        <strong>{state.freshness.status}</strong>
      </div>
      <p>{warning.body}</p>
      {state.freshness.cursorLag > 0 ? <p>{state.freshness.cursorLag} backend updates are not reflected in this view yet.</p> : null}
      {state.freshness.hasConflicts ? <p>Sync conflicts are present. Use coordinator review before acting on disputed records.</p> : null}
      <p>Refresh from the backend before operational decisions.</p>
    </section>
  );
}

function describeChannelFreshnessWarning(freshness: SyncFreshness): { title: string; body: string } | null {
  if (freshness.status === 'fresh' && freshness.cursorLag === 0 && !freshness.hasConflicts) return null;

  if (freshness.status === 'missing') {
    return {
      title: 'Freshness signal missing',
      body: 'The backend has no freshness record for this channel scope. This web view may be incomplete.',
    };
  }

  if (freshness.status === 'expired') {
    return {
      title: 'Channel data expired',
      body: 'The backend marked this channel scope as expired. Do not treat the visible data as current.',
    };
  }

  return {
    title: 'Channel data may be stale',
    body: 'The backend marked this channel scope as stale. Some recent operations may not be visible here.',
  };
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

function formatSosAlertLocation(alert: SosAlert): string {
  if (!alert.location) return 'Location: not reported';
  if (alert.location.accuracyMeters !== undefined) return `Location: reported with ${alert.location.accuracyMeters}m accuracy`;
  return 'Location: reported by backend';
}

function formatFanout(fanout: SosFanoutStatus): string {
  return `Fan-out: total ${fanout.total}, queued ${fanout.queued}, pending ${fanout.pending}, failed ${fanout.failed}, cancelled ${fanout.cancelled}.`;
}

function upsertSosAlert(alerts: SosAlert[], alert: SosAlert): SosAlert[] {
  const existing = alerts.filter((candidate) => candidate.sosAlertId !== alert.sosAlertId);
  return [alert, ...existing];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function formatPrivateLinkError(error: unknown): string {
  const message = errorMessage(error);
  if (
    message === 'invalid_payload' ||
    message === 'permission_denied' ||
    message === 'invalid_link_scope' ||
    message === 'link_correlation_mismatch' ||
    message === 'link_expired'
  ) {
    return message;
  }

  return 'Private link unavailable. Continue with in-person verification.';
}

function getPrivateLinkParams(): { token: string; correlationId: string } | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token')?.trim();
  const correlationId = params.get('correlationId')?.trim() ?? params.get('correlation_id')?.trim();

  return token && correlationId ? { token, correlationId } : null;
}

function getBrowserFingerprint(): string {
  if (typeof window === 'undefined') return 'browser-fingerprint-unavailable';

  const storageKey = 'zona-cero-family-reunification-fingerprint';
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const randomId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const generated = `browser-${randomId}`;
  window.sessionStorage.setItem(storageKey, generated);
  return generated;
}

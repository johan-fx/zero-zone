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
import {
  classifyWebError,
  createWebTelemetryEvent,
  emitChannelTelemetry,
  webTelemetry,
  type WebTelemetryAction,
} from './telemetry';
import { I18nProvider, LanguageSelector, useI18n } from './i18n';
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


function reportWebTelemetry(
  action: WebTelemetryAction,
  result: 'accepted' | 'rejected' | 'bypassed',
  startedAt?: number,
  error?: unknown,
): void {
  const classified = error ? classifyWebError(error) : { result, errorCode: null };
  emitChannelTelemetry(
    webTelemetry,
    createWebTelemetryEvent({
      action,
      result: classified.result ?? result,
      errorCode: classified.errorCode,
      latencyMs: startedAt === undefined ? undefined : Date.now() - startedAt,
    }),
  );
}

function getConfiguredTurnstileToken(): string | null {
  const envToken = import.meta.env.VITE_TURNSTILE_RESPONSE;
  if (typeof envToken === 'string' && envToken.trim()) return envToken;
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem('cf-turnstile-response') ?? window.sessionStorage.getItem('x-turnstile-token');
}

function getTurnstileForwardingOptions(): { turnstileToken?: string | null } {
  const turnstileToken = getConfiguredTurnstileToken();
  reportWebTelemetry(turnstileToken ? 'turnstile.forwarded' : 'turnstile.missing', turnstileToken ? 'accepted' : 'bypassed');
  return { turnstileToken };
}
const dispatchActions: { label: string; status: Exclude<DispatchTaskStatus, 'pending'> }[] = [
  { label: 'Accept', status: 'accepted' },
  { label: 'En route', status: 'en_route' },
  { label: 'Delivered', status: 'delivered' },
  { label: 'Cancel', status: 'cancelled' },
];

export function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

function AppContent() {
  reportWebTelemetry('app.loaded', 'accepted');
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
  const { t } = useI18n();
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
        reportWebTelemetry('health.loaded', 'accepted');
      })
      .catch((error: unknown) => {
        if (active) setHealthState({ status: 'error', message: errorMessage(error) });
        reportWebTelemetry('health.failed', 'rejected', undefined, error);
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
      reportWebTelemetry('freshness.loaded', 'accepted');
    }

    async function loadWorkCenters() {
      const { workCenters } = await fetchWorkCenters(incidentId);
      const firstWorkCenter = workCenters[0];
      const selected = firstWorkCenter
        ? (await fetchWorkCenterDetail(incidentId, firstWorkCenter.workCenterId)).workCenter
        : null;

      if (active) setWorkCenterState({ status: 'ready', workCenters, selected });
      reportWebTelemetry('work_centers.loaded', 'accepted');
    }

    async function loadResources() {
      const { resourceReports } = await fetchResourceReports(incidentId);
      if (active) setResourceState({ status: 'ready', reports: resourceReports });
      reportWebTelemetry('resources.loaded', 'accepted');
    }

    async function loadDispatchTasks() {
      const { dispatchTasks } = await fetchDispatchTasks(incidentId);
      if (active) setDispatchState({ status: 'ready', tasks: dispatchTasks });
      reportWebTelemetry('dispatch.loaded', 'accepted');
    }

    async function loadSosStatus() {
      const response = await fetchSosStatus(incidentId);
      if (active) setSosState({ status: 'ready', response });
    }

    loadChannelFreshness().catch((error: unknown) => {
      if (active) setChannelFreshnessState({ status: 'error', message: errorMessage(error) });
      reportWebTelemetry('freshness.failed', 'rejected', undefined, error);
    });
    loadWorkCenters().catch((error: unknown) => {
      if (active) setWorkCenterState({ status: 'error', message: errorMessage(error) });
      reportWebTelemetry('work_centers.failed', 'rejected', undefined, error);
    });
    loadResources().catch((error: unknown) => {
      if (active) setResourceState({ status: 'error', message: errorMessage(error) });
      reportWebTelemetry('resources.failed', 'rejected', undefined, error);
    });
    loadDispatchTasks().catch((error: unknown) => {
      if (active) setDispatchState({ status: 'error', message: errorMessage(error) });
      reportWebTelemetry('dispatch.failed', 'rejected', undefined, error);
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
    const startedAt = Date.now();

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
      reportWebTelemetry('dispatch.completed', 'accepted', startedAt);
    } catch (error: unknown) {
      setDispatchState({ ...dispatchState, actionMessage: errorMessage(error) });
      reportWebTelemetry('dispatch.rejected', 'rejected', startedAt, error);
    }
  }

  async function handleSosSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sosState.status !== 'ready' || isSosSubmitting) return;

    reportWebTelemetry('sos.started', 'accepted');

    if (sosConfirmation.trim() !== strongSosConfirmation) {
      setSosState({
        ...sosState,
        actionMessage: t('web.sos.exact.required'),
      });
      reportWebTelemetry('sos.rejected', 'rejected');
      return;
    }

    const reportedAt = sosPendingReportedAt ?? new Date().toISOString();
    setSosPendingReportedAt(reportedAt);
    setIsSosSubmitting(true);
    const startedAt = Date.now();

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
        actionMessage: t('web.sos.action.success', { sosAlertId: response.sosAlert.sosAlertId, status: response.sosAlert.status, fanout: formatFanout(response.fanout, t) }),
      });
      setSosConfirmation('');
      setSosPendingReportedAt(null);
      reportWebTelemetry('sos.completed', 'accepted', startedAt);
    } catch (error: unknown) {
      setSosState({ ...sosState, actionMessage: errorMessage(error) });
      reportWebTelemetry('sos.rejected', 'rejected', startedAt, error);
    } finally {
      setIsSosSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-topline">
          <p className="eyebrow">{t('web.hero.eyebrow')}</p>
          <LanguageSelector />
        </div>
        <h1 id="page-title">{t('web.hero.title')}</h1>
        <p className="summary">{t('web.hero.summary')}</p>
      </section>

      <section className="status-card" aria-live="polite">
        <h2>{t('web.health.title')}</h2>
        {healthState.status === 'loading' ? <p>{t('web.health.loading')}</p> : null}
        {healthState.status === 'ready' ? (
          <p data-testid="api-health">{t('web.health.online', { service: healthState.health.service, version: healthState.health.version })}</p>
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
            <h2 id="sos-title">{t('web.sos.title')}</h2>
          </div>
          {sosState.status === 'ready' ? <strong>{sosState.response.sosAlerts.length} alerts</strong> : null}
        </div>
        <p className="summary">{t('web.sos.summary')}</p>
        {sosState.status === 'loading' ? <p>{t('web.sos.loading')}</p> : null}
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
  const { t } = useI18n();
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

    reportWebTelemetry('private_link.started', 'accepted');

    validatePrivateFamilyReunificationLink({
      token,
      scope: 'family_reunification.search',
      correlationId,
      fingerprint,
    }, undefined, getTurnstileForwardingOptions())
      .then((validation) => {
        if (active) setState({ status: 'ready', validation });
        reportWebTelemetry('private_link.completed', 'accepted');
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: formatPrivateLinkError(error, t) });
        const classified = classifyWebError(error);
        reportWebTelemetry(
          classified.errorCode === 'rate_limited'
            ? 'private_link.rate_limited'
            : classified.errorCode === 'security_challenge_required'
              ? 'private_link.security_challenge'
              : classified.errorCode === 'link_expired'
                ? 'private_link.expired'
                : 'private_link.rejected',
          'rejected',
          undefined,
          error,
        );
      });

    return () => {
      active = false;
    };
  }, [token, correlationId, fingerprint]);

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== 'ready' || isSearching) return;

    setIsSearching(true);
    const startedAt = Date.now();
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
      }, undefined, getTurnstileForwardingOptions());
      setState({ ...state, search, message: t('web.family.search.completed') });
      reportWebTelemetry('private_link.completed', 'accepted', startedAt);
    } catch (error: unknown) {
      setState({ ...state, message: formatPrivateLinkError(error, t) });
      reportWebTelemetry('private_link.rejected', 'rejected', startedAt, error);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleInPersonReferral() {
    if (state.status !== 'ready' || isReferring) return;

    setIsReferring(true);
    const startedAt = Date.now();
    try {
      const referral = await consumePrivateFamilyReunificationLink({
        token,
        scope: 'family_reunification.search',
        correlationId,
        fingerprint,
        referralReason: 'family_reunification_in_person_verification',
      });
      setState({ ...state, referral, message: formatFamilyReferralMessage(referral.referral.type, t) });
      reportWebTelemetry('private_link.completed', 'accepted', startedAt);
    } catch (error: unknown) {
      setState({ ...state, message: formatPrivateLinkError(error, t) });
      reportWebTelemetry('private_link.rejected', 'rejected', startedAt, error);
    } finally {
      setIsReferring(false);
    }
  }

  return (
    <main className="shell private-shell">
      <section className="hero private-hero" aria-labelledby="family-reunification-title">
        <div className="hero-topline">
          <p className="eyebrow">{t('web.family.private.eyebrow')}</p>
          <LanguageSelector />
        </div>
        <h1 id="family-reunification-title">{t('web.family.private.title')}</h1>
        <p className="summary">{t('web.family.private.summary')}</p>
      </section>

      <section className="status-card safety-card" aria-labelledby="family-limits-title">
        <h2 id="family-limits-title">{t('web.family.safety.title')}</h2>
        <ul className="safety-list">
          <li>{t('web.family.safety.no_photos')}</li>
          <li>{t('web.family.safety.no_exact_location')}</li>
          <li>{t('web.family.safety.no_minor_identity')}</li>
          <li>{t('web.family.safety.in_person')}</li>
        </ul>
      </section>

      {state.status === 'validating' ? (
        <section className="status-card" aria-live="polite">
          <h2>{t('web.family.validation.checking.title')}</h2>
          <p>{t('web.family.validation.checking.body')}</p>
        </section>
      ) : null}

      {state.status === 'error' ? (
        <section className="status-card" aria-live="polite">
          <h2>{t('web.family.error.title')}</h2>
          <p role="alert">{state.message}</p>
          <p>{t('web.family.error.help')}</p>
        </section>
      ) : null}

      {state.status === 'ready' ? (
        <section className="status-card" aria-labelledby="private-search-title" aria-live="polite">
          <div className="section-header">
            <div>
              <p className="eyebrow">{t('web.family.search.incident', { incidentId: state.validation.incidentId })}</p>
              <h2 id="private-search-title">{t('web.family.search.title')}</h2>
            </div>
            <strong>{t('web.family.search.verification_required')}</strong>
          </div>

          {state.message ? <p role="status">{state.message}</p> : null}

          <form className="family-form" onSubmit={handleSearchSubmit}>
            <label htmlFor="family-age-band">{t('web.family.form.age.label')}</label>
            <select
              id="family-age-band"
              name="ageBand"
              value={form.ageBand}
              onChange={(event) => setForm({ ...form, ageBand: event.currentTarget.value as FamilyReunificationForm['ageBand'] })}
            >
              <option value="">{t('web.family.form.age.unknown')}</option>
              <option value="child">{t('web.family.form.age.child')}</option>
              <option value="teen">{t('web.family.form.age.teen')}</option>
              <option value="adult">{t('web.family.form.age.adult')}</option>
              <option value="older_adult">{t('web.family.form.age.older_adult')}</option>
            </select>

            <label htmlFor="family-relation-hint">{t('web.family.form.relation.label')}</label>
            <input
              id="family-relation-hint"
              name="relationHint"
              maxLength={80}
              value={form.relationHint}
              onChange={(event) => setForm({ ...form, relationHint: event.currentTarget.value })}
              placeholder={t('web.family.form.relation.placeholder')}
            />

            <label htmlFor="family-area-label">{t('web.family.form.area.label')}</label>
            <input
              id="family-area-label"
              name="lastKnownAreaLabel"
              maxLength={120}
              value={form.lastKnownAreaLabel}
              onChange={(event) => setForm({ ...form, lastKnownAreaLabel: event.currentTarget.value })}
              placeholder={t('web.family.form.area.placeholder')}
            />

            <button type="submit" disabled={isSearching}>{isSearching ? t('web.family.form.searching') : t('web.family.form.search')}</button>
          </form>

          {state.search ? <FamilyReunificationResults response={state.search} /> : null}

          <button className="primary-action" type="button" onClick={handleInPersonReferral} disabled={isReferring}>
            {isReferring ? t('web.family.referral.prepare') : t('web.family.referral.continue')}
          </button>
        </section>
      ) : null}
    </main>
  );
}


function formatFamilyMatchRelation(status: FamilyReunificationSearchResponse['matches'][number]['status'], t: ReturnType<typeof useI18n>['t']): string {
  if (status === 'possible_match') return t('web.family.results.relation.possible_match');
  return t('web.family.results.not_provided');
}

function formatFamilyAgeBand(ageBand: FamilyReunificationSearchResponse['matches'][number]['ageBand'], t: ReturnType<typeof useI18n>['t']): string {
  if (ageBand === 'child') return t('web.family.form.age.child');
  if (ageBand === 'teen') return t('web.family.form.age.teen');
  if (ageBand === 'adult') return t('web.family.form.age.adult');
  if (ageBand === 'older_adult') return t('web.family.form.age.older_adult');
  return t('web.family.results.not_provided');
}

function formatFamilyReferralMessage(type: FamilyReunificationSearchResponse['referral']['type'], t: ReturnType<typeof useI18n>['t']): string {
  if (type === 'in_person_verification') return t('web.family.referral.in_person_verification');
  return t('web.family.link.unavailable');
}

function FamilyReunificationResults({ response }: { response: FamilyReunificationSearchResponse }) {
  const { t } = useI18n();

  return (
    <div className="family-results">
      <h3>{t('web.family.results.title')}</h3>
      {response.matches.length === 0 ? <p>{t('web.family.results.none')}</p> : null}
      <ul className="work-center-list">
        {response.matches.map((match) => (
          <li key={match.matchId}>
            <article className="work-center-card">
              <h4>{match.status === 'possible_match' ? t('web.family.results.possible_match') : t('web.family.results.none')}</h4>
              <p>{t('web.family.results.age', { value: formatFamilyAgeBand(match.ageBand, t) })}</p>
              <p>{t('web.family.results.relation', { value: formatFamilyMatchRelation(match.status, t) })}</p>
              <p>{t('web.family.results.area', { value: match.lastKnownAreaLabel ?? t('web.family.results.not_provided') })}</p>
              <p>{t('web.family.results.verification', { value: match.verificationRequired ? t('web.family.results.yes') : t('web.family.results.no') })}</p>
            </article>
          </li>
        ))}
      </ul>
      <p>{formatFamilyReferralMessage(response.referral.type, t)}</p>
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
  const { t } = useI18n();

  return (
    <div>
      {state.actionMessage ? <p role="status">{state.actionMessage}</p> : null}
      <FanoutStrip fanout={state.response.fanout} />
      <form className="sos-form" onSubmit={onSubmit}>
        <label htmlFor="sos-confirmation">{t('web.sos.confirm.label')}</label>
        <input
          id="sos-confirmation"
          name="sos-confirmation"
          value={confirmation}
          onChange={(event) => onConfirmationChange(event.currentTarget.value)}
          aria-describedby="sos-copy"
          disabled={isSubmitting}
        />
        <p id="sos-copy">{t('web.sos.confirm.help')}</p>
        <button type="submit" disabled={isSubmitting}>{isSubmitting ? t('web.sos.submitting') : t('web.sos.submit')}</button>
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
  const { t } = useI18n();
  if (state.status === 'loading') return null;

  if (state.status === 'error') {
    return (
      <section className="status-card channel-warning" role="status" aria-live="polite">
        <h2>{t('web.freshness.unavailable.title')}</h2>
        <p>{t('web.freshness.unavailable.body')}</p>
      </section>
    );
  }

  const warning = describeChannelFreshnessWarning(state.freshness, t);
  if (!warning) return null;

  return (
    <section className="status-card channel-warning" role="status" aria-live="polite">
      <div className="section-header">
        <div>
          <p className="eyebrow">{t('web.freshness.limitation')}</p>
          <h2>{warning.title}</h2>
        </div>
        <strong>{state.freshness.status}</strong>
      </div>
      <p>{warning.body}</p>
      {state.freshness.cursorLag > 0 ? <p>{t('web.freshness.cursor_lag', { count: state.freshness.cursorLag })}</p> : null}
      {state.freshness.hasConflicts ? <p>{t('web.freshness.conflicts')}</p> : null}
      <p>{t('web.freshness.refresh')}</p>
    </section>
  );
}

function describeChannelFreshnessWarning(freshness: SyncFreshness, t: ReturnType<typeof useI18n>['t']): { title: string; body: string } | null {
  if (freshness.status === 'fresh' && freshness.cursorLag === 0 && !freshness.hasConflicts) return null;

  if (freshness.status === 'missing') {
    return {
      title: t('web.freshness.missing.title'),
      body: t('web.freshness.missing.body'),
    };
  }

  if (freshness.status === 'expired') {
    return {
      title: t('web.freshness.expired.title'),
      body: t('web.freshness.expired.body'),
    };
  }

  return {
    title: t('web.freshness.stale.title'),
    body: t('web.freshness.stale.body'),
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

function formatFanout(fanout: SosFanoutStatus, t: ReturnType<typeof useI18n>['t']): string {
  return t('web.sos.fanout', {
    total: fanout.total,
    queued: fanout.queued,
    pending: fanout.pending,
    failed: fanout.failed,
    cancelled: fanout.cancelled,
  });
}

function upsertSosAlert(alerts: SosAlert[], alert: SosAlert): SosAlert[] {
  const existing = alerts.filter((candidate) => candidate.sosAlertId !== alert.sosAlertId);
  return [alert, ...existing];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function formatPrivateLinkError(error: unknown, t: ReturnType<typeof useI18n>['t']): string {
  const message = errorMessage(error);
  if (
    message === 'invalid_payload' ||
    message === 'permission_denied' ||
    message === 'invalid_link_scope' ||
    message === 'link_correlation_mismatch' ||
    message === 'link_expired'
  ) {
    return t(`web.family.error.${message}`);
  }

  return t('web.family.link.unavailable');
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

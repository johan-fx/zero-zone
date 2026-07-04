import {
  type ComponentType,
  type FormEvent,
  lazy,
  Suspense,
  useEffect,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  HandHeart,
  Home,
  MapPin,
  PackagePlus,
  Siren,
} from "lucide-react";

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
} from "@zona-cero/contracts";
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
} from "./api";
import {
  classifyWebError,
  createWebTelemetryEvent,
  emitChannelTelemetry,
  webTelemetry,
  type WebTelemetryAction,
} from "./telemetry";
import { I18nProvider, LanguageSelector, useI18n } from "./i18n";
import { type AppThemeOverride, useAppThemeMode } from "./themeMode";
import type { OperationsMapPanelCopy } from "./features/operations-map/OperationsMapPanel";

type AppThemeController = ReturnType<typeof useAppThemeMode>;
import {
  activationStateTone,
  confidenceTone,
  dispatchStatusTone,
  freshnessTone,
  riskTone,
  sosAlertStatusTone,
  sosFanoutStatTone,
  urgencyTone,
  workCenterStatusTone,
} from "./statusTones";
import type { StatusTone } from "@zona-cero/ui";
import { Card, MetaRow, SectionHeader, StatusBadge } from "@zona-cero/ui/web";
import "./styles.css";

const OperationsMapPanel = lazy(() =>
  import("./features/operations-map/OperationsMapPanel").then((module) => ({
    default: module.OperationsMapPanel,
  })),
);

type Translate = ReturnType<typeof useI18n>["t"];
type CivilOperationsMapMarker = Parameters<
  OperationsMapPanelCopy["markerMetadata"]
>[0];

type HealthState =
  | { status: "loading" }
  | { status: "ready"; health: HealthResponse }
  | { status: "error"; message: string };

type WorkCenterState =
  | { status: "loading" }
  | {
      status: "ready";
      workCenters: WorkCenterSummary[];
      selected: WorkCenterDetail | null;
    }
  | { status: "error"; message: string };

type ChannelFreshnessState =
  | { status: "loading" }
  | { status: "ready"; freshness: SyncFreshness }
  | { status: "error"; message: string };

type ResourceState =
  | { status: "loading" }
  | { status: "ready"; reports: ResourceReportSummary[] }
  | { status: "error"; message: string };

type DispatchState =
  | { status: "loading" }
  | { status: "ready"; tasks: DispatchTask[]; actionMessage?: string }
  | { status: "error"; message: string };

type SosState =
  | { status: "loading" }
  | {
      status: "ready";
      response: SosAlertStatusResponse;
      actionMessage?: string;
    }
  | { status: "error"; message: string };

type FamilyReunificationState =
  | { status: "validating" }
  | {
      status: "ready";
      validation: PrivateWebLinkValidateResponse;
      search?: FamilyReunificationSearchResponse;
      referral?: PrivateWebLinkConsumeResponse;
      message?: string;
    }
  | { status: "error"; message: string };

type FamilyReunificationForm = {
  ageBand: "" | "child" | "teen" | "adult" | "older_adult";
  relationHint: string;
  lastKnownAreaLabel: string;
};

type HubRoute =
  | "home"
  | "volunteer"
  | "help-points"
  | "resource-report"
  | "task"
  | "nearby-sos"
  | "map";

const hubRoutes: readonly HubRoute[] = [
  "home",
  "volunteer",
  "help-points",
  "resource-report",
  "task",
  "nearby-sos",
  "map",
];
const hubRouteAliases: Record<string, HubRoute> = {
  "": "home",
  hub: "home",
  map: "map",
  volunteer: "volunteer",
  "soy-voluntario": "volunteer",
  "work-centers": "help-points",
  "help-points": "help-points",
  "puntos-de-ayuda": "help-points",
  resources: "resource-report",
  "resource-report": "resource-report",
  "avisar-que-falta-algo": "resource-report",
  dispatch: "task",
  task: "task",
  "mi-encargo": "task",
  sos: "nearby-sos",
  "nearby-sos": "nearby-sos",
  "sos-cercano": "nearby-sos",
};

function isHubRoute(value: string): value is HubRoute {
  return (hubRoutes as readonly string[]).includes(value);
}

function readHubRouteFromLocation(): HubRoute {
  if (typeof window === "undefined") return "home";
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (isHubRoute(raw)) return raw;
  return hubRouteAliases[raw] ?? "home";
}

function routeToHash(route: HubRoute): string {
  if (route === "home") return "";
  return `/${route}`;
}

/**
 * Tiny hash-based router scoped to the operations hub. Deliberately avoids a
 * routing library to keep the bundle small for field conditions, and uses
 * the hash (not the path) so it never collides with the private family
 * reunification link, which is addressed by `?token=&correlationId=`.
 */
function useHubRoute(): [HubRoute, (route: HubRoute) => void] {
  const [route, setRoute] = useState<HubRoute>(() =>
    readHubRouteFromLocation(),
  );

  useEffect(() => {
    function handleHashChange() {
      setRoute(readHubRouteFromLocation());
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function navigate(nextRoute: HubRoute) {
    if (typeof window !== "undefined") {
      window.location.hash = routeToHash(nextRoute);
    }
    setRoute(nextRoute);
  }

  return [route, navigate];
}

const defaultIncidentId = "incident-zc-demo";
const defaultCellId = "cell-zc-demo";
const defaultWebExternalId = "web-user-1001";
const defaultWebDisplayName = "Field Web";
const strongSosConfirmation = "CONFIRM SOS";

function createCivilOperationsMapCopy(t: Translate): OperationsMapPanelCopy {
  return {
    eyebrow: t("web.map.civil.eyebrow"),
    title: t("web.map.civil.title"),
    summary: t("web.map.civil.summary"),
    markerCountLabel: (count) =>
      t("web.map.civil.marker_count", { count }),
    loadingCountries: t("web.map.civil.loading_countries"),
    emptyCountries: t("web.map.civil.empty_countries"),
    loadingMap: t("web.map.civil.loading_map"),
    countsAriaLabel: t("web.map.civil.counts_aria"),
    incidentsLabel: (count) => t("web.map.civil.incidents", { count }),
    workCentersLabel: (count) =>
      t("web.map.civil.work_centers", { count }),
    sosAlertsLabel: (count) => t("web.map.civil.sos_alerts", { count }),
    withoutLocationLabel: (count) =>
      t("web.map.civil.without_location", { count }),
    emptyMapItems: (countryName) =>
      t("web.map.civil.empty_items", { countryName }),
    listTitle: t("web.map.civil.list_title"),
    mapAriaLabel: (countryName) =>
      t("web.map.civil.map_aria", { countryName }),
    markerLabel: (marker) => civilMarkerKindLabel(t, marker),
    markerMetadata: (marker) =>
      `${civilMarkerKindLabel(t, marker)} · ${civilMarkerStatusLabel(
        t,
        marker.status,
      )}`,
    markerDetail: (marker) => civilMarkerDetail(t, marker),
  };
}

function civilMarkerKindLabel(
  t: Translate,
  marker: CivilOperationsMapMarker,
): string {
  switch (marker.kind) {
    case "incident":
      return t("web.map.civil.kind.incident");
    case "work_center":
      return t("web.map.civil.kind.work_center");
    case "sos":
      return t("web.map.civil.kind.sos");
  }
}

function civilMarkerStatusLabel(t: Translate, status: string): string {
  switch (status.toLowerCase()) {
    case "active":
      return t("web.map.civil.status.active");
    case "reported":
      return t("web.map.civil.status.reported");
    case "open":
      return t("web.map.civil.status.open");
    case "resolved":
    case "closed":
      return t("web.map.civil.status.closed");
    default:
      return t("web.map.civil.status.followup");
  }
}

function civilMarkerDetail(
  t: Translate,
  marker: CivilOperationsMapMarker,
): string {
  if (marker.kind === "work_center") {
    return t("web.map.civil.detail.work_center", {
      priority: civilPriorityLabel(t, marker.priority),
    });
  }

  if (marker.kind === "sos") {
    return t("web.map.civil.detail.sos", {
      severity: civilSeverityLabel(t, marker.severity),
    });
  }

  return marker.detail;
}

function civilPriorityLabel(
  t: Translate,
  priority: string | undefined,
): string {
  switch (priority?.toLowerCase()) {
    case "critical":
      return t("web.map.civil.priority.critical");
    case "high":
      return t("web.map.civil.priority.high");
    case "medium":
      return t("web.map.civil.priority.medium");
    case "low":
      return t("web.map.civil.priority.low");
    default:
      return t("web.map.civil.priority.unknown");
  }
}

function civilSeverityLabel(
  t: Translate,
  severity: string | undefined,
): string {
  switch (severity?.toLowerCase()) {
    case "critical":
      return t("web.map.civil.severity.critical");
    case "high":
      return t("web.map.civil.severity.high");
    case "medium":
      return t("web.map.civil.severity.medium");
    case "low":
      return t("web.map.civil.severity.low");
    default:
      return t("web.map.civil.severity.unknown");
  }
}

function reportWebTelemetry(
  action: WebTelemetryAction,
  result: "accepted" | "rejected" | "bypassed",
  startedAt?: number,
  error?: unknown,
): void {
  const classified = error
    ? classifyWebError(error)
    : { result, errorCode: null };
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
  if (typeof envToken === "string" && envToken.trim()) return envToken;
  if (typeof window === "undefined") return null;
  return (
    window.sessionStorage.getItem("cf-turnstile-response") ??
    window.sessionStorage.getItem("x-turnstile-token")
  );
}

function getTurnstileForwardingOptions(): { turnstileToken?: string | null } {
  const turnstileToken = getConfiguredTurnstileToken();
  reportWebTelemetry(
    turnstileToken ? "turnstile.forwarded" : "turnstile.missing",
    turnstileToken ? "accepted" : "bypassed",
  );
  return { turnstileToken };
}
const dispatchActions: {
  labelKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
  status: Exclude<DispatchTaskStatus, "pending">;
}[] = [
  { labelKey: "web.dispatch.action.accepted", status: "accepted" },
  { labelKey: "web.dispatch.action.en_route", status: "en_route" },
  { labelKey: "web.dispatch.action.delivered", status: "delivered" },
  { labelKey: "web.dispatch.action.cancelled", status: "cancelled" },
];

export function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

function AppContent() {
  useEffect(() => {
    reportWebTelemetry("app.loaded", "accepted");
  }, []);

  const theme = useAppThemeMode();
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

  return <OperationsPanel theme={theme} />;
}

function OperationsPanel({ theme }: { theme: AppThemeController }) {
  const { t } = useI18n();
  const incidentId = import.meta.env.VITE_INCIDENT_ID || defaultIncidentId;
  const cellId = import.meta.env.VITE_CELL_ID || defaultCellId;
  const webExternalId =
    import.meta.env.VITE_WEB_EXTERNAL_ID || defaultWebExternalId;
  const webDisplayName =
    import.meta.env.VITE_WEB_DISPLAY_NAME || defaultWebDisplayName;
  const [healthState, setHealthState] = useState<HealthState>({
    status: "loading",
  });
  const [workCenterState, setWorkCenterState] = useState<WorkCenterState>({
    status: "loading",
  });
  const [channelFreshnessState, setChannelFreshnessState] =
    useState<ChannelFreshnessState>({ status: "loading" });
  const [resourceState, setResourceState] = useState<ResourceState>({
    status: "loading",
  });
  const [dispatchState, setDispatchState] = useState<DispatchState>({
    status: "loading",
  });
  const [sosState, setSosState] = useState<SosState>({ status: "loading" });
  const [sosConfirmation, setSosConfirmation] = useState("");
  const [isSosSubmitting, setIsSosSubmitting] = useState(false);
  const [sosPendingReportedAt, setSosPendingReportedAt] = useState<
    string | null
  >(null);
  const [route, navigate] = useHubRoute();
  const civilOperationsMapCopy = createCivilOperationsMapCopy(t);

  useEffect(() => {
    let active = true;

    fetchApiHealth()
      .then((health) => {
        if (active) setHealthState({ status: "ready", health });
        reportWebTelemetry("health.loaded", "accepted");
      })
      .catch((error: unknown) => {
        if (active)
          setHealthState({ status: "error", message: errorMessage(error) });
        reportWebTelemetry("health.failed", "rejected", undefined, error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadChannelFreshness() {
      const freshness = await fetchSyncFreshness(incidentId, cellId);
      if (active) setChannelFreshnessState({ status: "ready", freshness });
      reportWebTelemetry("freshness.loaded", "accepted");
    }

    async function loadWorkCenters() {
      const { workCenters } = await fetchWorkCenters(incidentId);
      const firstWorkCenter = workCenters[0];
      const selected = firstWorkCenter
        ? (
            await fetchWorkCenterDetail(
              incidentId,
              firstWorkCenter.workCenterId,
            )
          ).workCenter
        : null;

      if (active)
        setWorkCenterState({ status: "ready", workCenters, selected });
      reportWebTelemetry("work_centers.loaded", "accepted");
    }

    async function loadResources() {
      const { resourceReports } = await fetchResourceReports(incidentId);
      if (active)
        setResourceState({ status: "ready", reports: resourceReports });
      reportWebTelemetry("resources.loaded", "accepted");
    }

    async function loadDispatchTasks() {
      const { dispatchTasks } = await fetchDispatchTasks(incidentId);
      if (active) setDispatchState({ status: "ready", tasks: dispatchTasks });
      reportWebTelemetry("dispatch.loaded", "accepted");
    }

    async function loadSosStatus() {
      const response = await fetchSosStatus(incidentId);
      if (active) setSosState({ status: "ready", response });
    }

    loadChannelFreshness().catch((error: unknown) => {
      if (active)
        setChannelFreshnessState({
          status: "error",
          message: errorMessage(error),
        });
      reportWebTelemetry("freshness.failed", "rejected", undefined, error);
    });
    loadWorkCenters().catch((error: unknown) => {
      if (active)
        setWorkCenterState({ status: "error", message: errorMessage(error) });
      reportWebTelemetry("work_centers.failed", "rejected", undefined, error);
    });
    loadResources().catch((error: unknown) => {
      if (active)
        setResourceState({ status: "error", message: errorMessage(error) });
      reportWebTelemetry("resources.failed", "rejected", undefined, error);
    });
    loadDispatchTasks().catch((error: unknown) => {
      if (active)
        setDispatchState({ status: "error", message: errorMessage(error) });
      reportWebTelemetry("dispatch.failed", "rejected", undefined, error);
    });
    loadSosStatus().catch((error: unknown) => {
      if (active)
        setSosState({ status: "error", message: errorMessage(error) });
    });

    return () => {
      active = false;
    };
  }, [incidentId, cellId]);

  async function handleDispatchAction(
    task: DispatchTask,
    status: Exclude<DispatchTaskStatus, "pending">,
  ) {
    if (dispatchState.status !== "ready") return;
    if (status === "cancelled" && !confirmDispatchCancellation(task)) {
      return;
    }
    const startedAt = Date.now();

    try {
      const response = await updateDispatchTask(
        incidentId,
        task.dispatchTaskId,
        {
          channel: "web-ui",
          externalId: webExternalId,
          status,
        },
      );
      setDispatchState((previous) => {
        if (previous.status !== "ready") return previous;
        return {
          status: "ready",
          tasks: previous.tasks.map((candidate) =>
            candidate.dispatchTaskId === response.dispatchTask.dispatchTaskId
              ? response.dispatchTask
              : candidate,
          ),
          actionMessage: t("web.dispatch.action.success", {
            dispatchTaskId: response.dispatchTask.dispatchTaskId,
            status: describeDispatchStatus(response.dispatchTask.status, t),
          }),
        };
      });
      reportWebTelemetry("dispatch.completed", "accepted", startedAt);
    } catch (error: unknown) {
      setDispatchState((previous) =>
        previous.status === "ready"
          ? { ...previous, actionMessage: errorMessage(error) }
          : previous,
      );
      reportWebTelemetry("dispatch.rejected", "rejected", startedAt, error);
    }
  }

  async function handleSosSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sosState.status !== "ready" || isSosSubmitting) return;

    reportWebTelemetry("sos.started", "accepted");

    if (sosConfirmation.trim() !== strongSosConfirmation) {
      setSosState({
        ...sosState,
        actionMessage: t("web.sos.exact.required"),
      });
      reportWebTelemetry("sos.rejected", "rejected");
      return;
    }

    const reportedAt = sosPendingReportedAt ?? new Date().toISOString();
    setSosPendingReportedAt(reportedAt);
    setIsSosSubmitting(true);
    const startedAt = Date.now();

    try {
      const response = await createSosAlert(incidentId, {
        channel: "web-ui",
        externalId: webExternalId,
        displayName: webDisplayName,
        payload: { severity: "critical", reportedAt },
      });

      setSosState({
        status: "ready",
        response: {
          sosAlerts: upsertSosAlert(
            sosState.response.sosAlerts,
            response.sosAlert,
          ),
          fanout: response.fanout,
        },
        actionMessage: t("web.sos.action.success", {
          sosAlertId: response.sosAlert.sosAlertId,
          status: describeSosAlertStatus(response.sosAlert.status, t),
          fanout: formatFanout(response.fanout, t),
        }),
      });
      setSosConfirmation("");
      setSosPendingReportedAt(null);
      reportWebTelemetry("sos.completed", "accepted", startedAt);
    } catch (error: unknown) {
      setSosState({ ...sosState, actionMessage: errorMessage(error) });
      reportWebTelemetry("sos.rejected", "rejected", startedAt, error);
    } finally {
      setIsSosSubmitting(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <div className="hero-topline">
          <p className="eyebrow">{t("web.hero.eyebrow")}</p>
          <div className="hero-actions">
            <ThemeModeSelector
              override={theme.override}
              resolvedMode={theme.resolvedMode}
              onChange={theme.setOverride}
            />
            <LanguageSelector />
          </div>
        </div>
        <h1 id="page-title">{t("web.hero.title")}</h1>
        <p className="summary">{t("web.hero.summary")}</p>
      </section>

      <section className="status-card" aria-live="polite">
        <h2>{t("web.health.title")}</h2>
        {healthState.status === "loading" ? (
          <p>{t("web.health.loading")}</p>
        ) : null}
        {healthState.status === "ready" ? (
          <p data-testid="api-health">
            {t("web.health.online", {
              service: healthState.health.service,
              version: healthState.health.version,
            })}
          </p>
        ) : null}
        {healthState.status === "error" ? (
          <p role="alert">{healthState.message}</p>
        ) : null}
      </section>

      <ChannelFreshnessBanner state={channelFreshnessState} />

      <HubNav route={route} onNavigate={navigate} />

      {route === "home" ? (
        <HomeDashboard
          workCenterState={workCenterState}
          resourceState={resourceState}
          dispatchState={dispatchState}
          sosState={sosState}
          onNavigate={navigate}
        />
      ) : null}

      {route === "map" ? (
        <section
          className="status-card"
          aria-label="Operational map"
          aria-live="polite"
        >
          <HubBackLink onNavigate={navigate} />
          <Suspense fallback={<p>{t("web.map.loading")}</p>}>
            <OperationsMapPanel styleName={theme.resolvedMode} />
          </Suspense>
        </section>
      ) : null}

      {route === "volunteer" ? <VolunteerGuide onNavigate={navigate} /> : null}

      {route === "help-points" ? (
        <section
          className="status-card"
          aria-labelledby="work-centers-title"
          aria-live="polite"
        >
          <HubBackLink onNavigate={navigate} />
          <SectionHeader
            eyebrow={t("web.help.eyebrow")}
            title={t("web.help.title")}
            titleId="work-centers-title"
            trailing={
              workCenterState.status === "ready" ? (
                <strong>
                  {t("web.count.open_help_points", {
                    count: workCenterState.workCenters.length,
                  })}
                </strong>
              ) : null
            }
          />
          <p className="summary">{t("web.help.summary")}</p>

          <div className="help-points-map-first">
            <Suspense fallback={<p>{t("web.map.loading")}</p>}>
              <OperationsMapPanel
                styleName={theme.resolvedMode}
                copy={civilOperationsMapCopy}
              />
            </Suspense>
          </div>

          <section
            className="help-points-list"
            aria-labelledby="help-points-list-title"
          >
            <h3 id="help-points-list-title">{t("web.help.list.title")}</h3>
            {workCenterState.status === "loading" ? (
              <p>{t("web.help.loading")}</p>
            ) : null}
            {workCenterState.status === "error" ? (
              <p role="alert">{workCenterState.message}</p>
            ) : null}
            {workCenterState.status === "ready" ? (
              <WorkCenterOnlineView state={workCenterState} />
            ) : null}
          </section>
        </section>
      ) : null}

      {route === "resource-report" ? (
        <section
          className="status-card"
          aria-labelledby="resources-title"
          aria-live="polite"
        >
          <HubBackLink onNavigate={navigate} />
          <SectionHeader
            eyebrow={t("web.resources.eyebrow")}
            title={t("web.resources.title")}
            titleId="resources-title"
            trailing={
              resourceState.status === "ready" ? (
                <strong>
                  {t("web.count.reports", {
                    count: resourceState.reports.length,
                  })}
                </strong>
              ) : null
            }
          />
          {resourceState.status === "loading" ? (
            <p>{t("web.resources.loading")}</p>
          ) : null}
          {resourceState.status === "error" ? (
            <p role="alert">{resourceState.message}</p>
          ) : null}
          {resourceState.status === "ready" ? (
            <ResourceReportView reports={resourceState.reports} />
          ) : null}
        </section>
      ) : null}

      {route === "nearby-sos" ? (
        <section
          className="status-card sos-card"
          aria-labelledby="sos-title"
          aria-live="polite"
        >
          <HubBackLink onNavigate={navigate} />
          <SectionHeader
            eyebrow={t("web.nearby_sos.eyebrow")}
            title={t("web.nearby_sos.title")}
            titleId="sos-title"
            trailing={
              sosState.status === "ready" ? (
                <strong>
                  {t("web.count.alerts", {
                    count: sosState.response.sosAlerts.length,
                  })}
                </strong>
              ) : null
            }
          />
          <p className="summary">{t("web.nearby_sos.summary")}</p>
          {sosState.status === "loading" ? <p>{t("web.sos.loading")}</p> : null}
          {sosState.status === "error" ? (
            <p role="alert">{sosState.message}</p>
          ) : null}
          {sosState.status === "ready" ? (
            <SosPanel
              state={sosState}
              confirmation={sosConfirmation}
              onConfirmationChange={setSosConfirmation}
              isSubmitting={isSosSubmitting}
              onSubmit={handleSosSubmit}
            />
          ) : null}
        </section>
      ) : null}

      {route === "task" ? (
        <section
          className="status-card"
          aria-labelledby="dispatch-title"
          aria-live="polite"
        >
          <HubBackLink onNavigate={navigate} />
          <SectionHeader
            eyebrow={t("web.dispatch.eyebrow")}
            title={t("web.dispatch.title")}
            titleId="dispatch-title"
            trailing={
              dispatchState.status === "ready" ? (
                <strong>
                  {t("web.count.tasks", {
                    count: dispatchState.tasks.length,
                  })}
                </strong>
              ) : null
            }
          />
          {dispatchState.status === "loading" ? (
            <p>{t("web.dispatch.loading")}</p>
          ) : null}
          {dispatchState.status === "error" ? (
            <p role="alert">{dispatchState.message}</p>
          ) : null}
          {dispatchState.status === "ready" ? (
            <DispatchTaskView
              state={dispatchState}
              onAction={handleDispatchAction}
            />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function ThemeModeSelector({
  override,
  resolvedMode,
  onChange,
}: {
  override: AppThemeOverride;
  resolvedMode: "day" | "night";
  onChange: (override: AppThemeOverride) => void;
}) {
  const { t } = useI18n();
  const resolvedLabel = t(
    resolvedMode === "day" ? "web.theme.day" : "web.theme.night",
  );

  return (
    <fieldset
      className="theme-mode-selector"
      aria-label={t("web.theme.mode.label")}
    >
      <legend>{t("web.theme.label")}</legend>
      <label className="theme-mode-selector__option">
        <input
          type="radio"
          name="zc-theme-mode"
          value="auto"
          checked={override === "auto"}
          onChange={() => onChange("auto")}
        />
        {t("web.theme.auto")}
      </label>
      <label className="theme-mode-selector__option">
        <input
          type="radio"
          name="zc-theme-mode"
          value="day"
          checked={override === "day"}
          onChange={() => onChange("day")}
        />
        {t("web.theme.day")}
      </label>
      <label className="theme-mode-selector__option">
        <input
          type="radio"
          name="zc-theme-mode"
          value="night"
          checked={override === "night"}
          onChange={() => onChange("night")}
        />
        {t("web.theme.night")}
      </label>
      <span className="theme-mode-selector__resolved" aria-live="polite">
        {t("web.theme.current", { mode: resolvedLabel })}
      </span>
    </fieldset>
  );
}

const hubNavTabs: {
  route: HubRoute;
  labelKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}[] = [
  { route: "home", labelKey: "web.nav.home", Icon: Home },
  { route: "volunteer", labelKey: "web.nav.volunteer", Icon: HandHeart },
  { route: "help-points", labelKey: "web.nav.help_points", Icon: MapPin },
  {
    route: "resource-report",
    labelKey: "web.nav.resource_report",
    Icon: PackagePlus,
  },
  { route: "task", labelKey: "web.nav.task", Icon: ClipboardCheck },
  { route: "nearby-sos", labelKey: "web.nav.nearby_sos", Icon: Siren },
];

function HubNav({
  route,
  onNavigate,
}: {
  route: HubRoute;
  onNavigate: (route: HubRoute) => void;
}) {
  const { t } = useI18n();

  return (
    <nav className="hub-nav" aria-label={t("web.nav.aria")}>
      {hubNavTabs.map((tab) => (
        <button
          key={tab.route}
          type="button"
          className={`hub-nav__tab${route === tab.route ? " hub-nav__tab--active" : ""}`}
          aria-current={route === tab.route ? "page" : undefined}
          onClick={() => onNavigate(tab.route)}
        >
          <tab.Icon className="nav-icon" aria-hidden />
          <span>{t(tab.labelKey)}</span>
        </button>
      ))}
    </nav>
  );
}

function HubBackLink({
  onNavigate,
}: {
  onNavigate: (route: HubRoute) => void;
}) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      className="hub-back"
      onClick={() => onNavigate("home")}
    >
      {t("web.hub.back")}
    </button>
  );
}

type HubTileSummary = { tone: StatusTone; countLabel: string };

function summarizeWorkCenters(
  state: WorkCenterState,
  t: ReturnType<typeof useI18n>["t"],
): HubTileSummary {
  if (state.status === "loading") return { tone: "info", countLabel: "…" };
  if (state.status === "error")
    return { tone: "conflict", countLabel: "Error" };
  const hasHighRisk = state.workCenters.some(
    (workCenter) => workCenter.risk === "high",
  );
  const needsReview = state.workCenters.some(
    (workCenter) => workCenter.activationState === "needs_review",
  );
  const tone: StatusTone = hasHighRisk
    ? "risk"
    : needsReview
      ? "warning"
      : state.workCenters.length > 0
        ? "success"
        : "info";
  return {
    tone,
    countLabel: t("web.count.help_points", {
      count: state.workCenters.length,
    }),
  };
}

function summarizeResources(
  state: ResourceState,
  t: ReturnType<typeof useI18n>["t"],
): HubTileSummary {
  if (state.status === "loading") return { tone: "info", countLabel: "…" };
  if (state.status === "error")
    return { tone: "conflict", countLabel: "Error" };
  const hasCritical = state.reports.some(
    (report) => report.urgency === "critical",
  );
  const hasHigh = state.reports.some((report) => report.urgency === "high");
  const tone: StatusTone = hasCritical
    ? "sos"
    : hasHigh
      ? "risk"
      : state.reports.length > 0
        ? "warning"
        : "info";
  return { tone, countLabel: t("web.count.reports", { count: state.reports.length }) };
}

function summarizeDispatch(
  state: DispatchState,
  t: ReturnType<typeof useI18n>["t"],
): HubTileSummary {
  if (state.status === "loading") return { tone: "info", countLabel: "…" };
  if (state.status === "error")
    return { tone: "conflict", countLabel: "Error" };
  const hasActive = state.tasks.some(
    (task) => task.status === "pending" || task.status === "en_route",
  );
  const tone: StatusTone = hasActive
    ? "warning"
    : state.tasks.length > 0
      ? "success"
      : "info";
  return { tone, countLabel: t("web.count.tasks", { count: state.tasks.length }) };
}

function summarizeSos(
  state: SosState,
  t: ReturnType<typeof useI18n>["t"],
): HubTileSummary {
  if (state.status === "loading") return { tone: "info", countLabel: "…" };
  if (state.status === "error")
    return { tone: "conflict", countLabel: "Error" };
  const hasOpen = state.response.sosAlerts.some(
    (alert) => alert.status === "open",
  );
  const tone: StatusTone = hasOpen ? "sos" : "success";
  return {
    tone,
    countLabel: t("web.count.alerts", {
      count: state.response.sosAlerts.length,
    }),
  };
}

function HomeDashboard({
  workCenterState,
  resourceState,
  dispatchState,
  sosState,
  onNavigate,
}: {
  workCenterState: WorkCenterState;
  resourceState: ResourceState;
  dispatchState: DispatchState;
  sosState: SosState;
  onNavigate: (route: HubRoute) => void;
}) {
  const { t } = useI18n();
  const workCenters = summarizeWorkCenters(workCenterState, t);
  const resources = summarizeResources(resourceState, t);
  const dispatch = summarizeDispatch(dispatchState, t);
  const sos = summarizeSos(sosState, t);

  return (
    <section className="home-layout" aria-label={t("web.nav.home")}>
      <section
        className="status-card home-map-card"
        aria-labelledby="home-map-title"
        aria-live="polite"
      >
        <SectionHeader
          eyebrow={t("web.home.map.eyebrow")}
          title={t("web.home.map.title")}
          titleId="home-map-title"
          trailing={
            workCenterState.status === "ready" ? (
              <strong>
                {t("web.count.help_points", {
                  count: workCenterState.workCenters.length,
                })}
              </strong>
            ) : null
          }
        />
        <p className="summary">{t("web.home.map.summary")}</p>
        <HomeHelpMapPreview state={workCenterState} />
      </section>

      <aside className="home-rail" aria-label={t("web.home.actions.aria")}>
        <CivilActionCard
          title={t("web.home.volunteer.title")}
          description={t("web.home.volunteer.description")}
          tone="success"
          Icon={HandHeart}
          actionLabel={t("web.home.volunteer.action")}
          onOpen={() => onNavigate("volunteer")}
        />
        <CivilActionCard
          title={t("web.help.title")}
          description={t("web.home.help_points.description")}
          tone={workCenters.tone}
          badge={workCenters.countLabel}
          Icon={MapPin}
          actionLabel={t("web.home.help_points.action")}
          onOpen={() => onNavigate("help-points")}
        />
        <CivilActionCard
          title={t("web.resources.title")}
          description={t("web.home.resources.description")}
          tone={resources.tone}
          badge={resources.countLabel}
          Icon={PackagePlus}
          actionLabel={t("web.home.resources.action")}
          onOpen={() => onNavigate("resource-report")}
        />
        <CivilActionCard
          title={t("web.dispatch.title")}
          description={t("web.home.dispatch.description")}
          tone={dispatch.tone}
          badge={dispatch.countLabel}
          Icon={ClipboardCheck}
          actionLabel={t("web.home.dispatch.action")}
          onOpen={() => onNavigate("task")}
        />
        <CivilActionCard
          title={t("web.nearby_sos.title")}
          description={t("web.home.sos.description")}
          tone={sos.tone}
          badge={sos.countLabel}
          Icon={Siren}
          actionLabel={t("web.home.sos.action")}
          onOpen={() => onNavigate("nearby-sos")}
        />
      </aside>
    </section>
  );
}

function HomeHelpMapPreview({ state }: { state: WorkCenterState }) {
  const { t } = useI18n();
  if (state.status === "loading") return <p>{t("web.home.map.loading")}</p>;
  if (state.status === "error") return <p role="alert">{state.message}</p>;
  if (state.workCenters.length === 0)
    return <p>{t("web.home.map.empty")}</p>;

  return (
    <ol
      className="map-lite home-map-lite"
      aria-label={t("web.home.map.aria")}
    >
      {state.workCenters.slice(0, 4).map((workCenter) => (
        <li key={workCenter.workCenterId}>
          <span>{workCenter.name}</span>
          <strong>{formatLocation(workCenter.location)}</strong>
        </li>
      ))}
    </ol>
  );
}

function VolunteerGuide({
  onNavigate,
}: {
  onNavigate: (route: HubRoute) => void;
}) {
  const { t } = useI18n();

  return (
    <section
      className="status-card volunteer-card"
      aria-labelledby="volunteer-title"
    >
      <HubBackLink onNavigate={onNavigate} />
      <SectionHeader
        eyebrow={t("web.volunteer.eyebrow")}
        title={t("web.volunteer.title")}
        titleId="volunteer-title"
        trailing={
          <StatePill
            tone="success"
            label={t("web.volunteer.ready")}
            Icon={CheckCircle2}
          />
        }
      />
      <div className="volunteer-steps">
        <CivilStep
          title={t("web.volunteer.step1.title")}
          body={t("web.volunteer.step1.body")}
          Icon={MapPin}
        />
        <CivilStep
          title={t("web.volunteer.step2.title")}
          body={t("web.volunteer.step2.body")}
          Icon={PackagePlus}
        />
        <CivilStep
          title={t("web.volunteer.step3.title")}
          body={t("web.volunteer.step3.body")}
          Icon={ClipboardCheck}
        />
      </div>
      <div className="action-row">
        <button type="button" onClick={() => onNavigate("help-points")}>
          {t("web.volunteer.help_points.action")}
        </button>
        <button type="button" onClick={() => onNavigate("task")}>
          {t("web.volunteer.task.action")}
        </button>
      </div>
    </section>
  );
}

function CivilActionCard({
  title,
  description,
  tone,
  badge,
  Icon,
  actionLabel,
  onOpen,
}: {
  title: string;
  description: string;
  tone: StatusTone;
  badge?: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  actionLabel: string;
  onOpen: () => void;
}) {
  return (
    <Card as="article" className="civil-action-card" tone={tone}>
      <div className="civil-action-card__icon-row">
        <Icon className="civil-icon" aria-hidden />
        {badge ? <StatePill tone={tone} label={badge} Icon={CircleDot} /> : null}
      </div>
      <h2>{title}</h2>
      <p className="summary">{description}</p>
      <button type="button" className="hub-tile__cta" onClick={onOpen}>
        {actionLabel} →
      </button>
    </Card>
  );
}

function CivilStep({
  title,
  body,
  Icon,
}: {
  title: string;
  body: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <Card as="article" className="civil-step" tone="info">
      <Icon className="civil-icon" aria-hidden />
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </Card>
  );
}

function StatePill({
  tone,
  label,
  Icon,
}: {
  tone: StatusTone;
  label: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  return (
    <span className={`state-pill state-pill--${tone}`}>
      <Icon className="state-pill__icon" aria-hidden />
      <span>{label}</span>
    </span>
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
  const [state, setState] = useState<FamilyReunificationState>({
    status: "validating",
  });
  const [form, setForm] = useState<FamilyReunificationForm>({
    ageBand: "",
    relationHint: "",
    lastKnownAreaLabel: "",
  });
  const [isSearching, setIsSearching] = useState(false);
  const [isReferring, setIsReferring] = useState(false);

  useEffect(() => {
    let active = true;

    reportWebTelemetry("private_link.started", "accepted");

    validatePrivateFamilyReunificationLink(
      {
        token,
        scope: "family_reunification.search",
        correlationId,
        fingerprint,
      },
      undefined,
      getTurnstileForwardingOptions(),
    )
      .then((validation) => {
        if (active) setState({ status: "ready", validation });
        reportWebTelemetry("private_link.completed", "accepted");
      })
      .catch((error: unknown) => {
        if (active)
          setState({
            status: "error",
            message: formatPrivateLinkError(error, t),
          });
        const classified = classifyWebError(error);
        reportWebTelemetry(
          classified.errorCode === "rate_limited"
            ? "private_link.rate_limited"
            : classified.errorCode === "security_challenge_required"
              ? "private_link.security_challenge"
              : classified.errorCode === "link_expired"
                ? "private_link.expired"
                : "private_link.rejected",
          "rejected",
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
    if (state.status !== "ready" || isSearching) return;

    setIsSearching(true);
    const startedAt = Date.now();
    try {
      const search = await searchFamilyReunification(
        {
          token,
          correlationId,
          fingerprint,
          query: {
            ...(form.ageBand ? { ageBand: form.ageBand } : {}),
            ...(form.relationHint.trim()
              ? { relationHint: form.relationHint.trim() }
              : {}),
            ...(form.lastKnownAreaLabel.trim()
              ? { lastKnownAreaLabel: form.lastKnownAreaLabel.trim() }
              : {}),
          },
        },
        undefined,
        getTurnstileForwardingOptions(),
      );
      setState({ ...state, search, message: t("web.family.search.completed") });
      reportWebTelemetry("private_link.completed", "accepted", startedAt);
    } catch (error: unknown) {
      setState({ ...state, message: formatPrivateLinkError(error, t) });
      reportWebTelemetry("private_link.rejected", "rejected", startedAt, error);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleInPersonReferral() {
    if (state.status !== "ready" || isReferring) return;

    setIsReferring(true);
    const startedAt = Date.now();
    try {
      const referral = await consumePrivateFamilyReunificationLink({
        token,
        scope: "family_reunification.search",
        correlationId,
        fingerprint,
        referralReason: "family_reunification_in_person_verification",
      });
      setState({
        ...state,
        referral,
        message: formatFamilyReferralMessage(referral.referral.type, t),
      });
      reportWebTelemetry("private_link.completed", "accepted", startedAt);
    } catch (error: unknown) {
      setState({ ...state, message: formatPrivateLinkError(error, t) });
      reportWebTelemetry("private_link.rejected", "rejected", startedAt, error);
    } finally {
      setIsReferring(false);
    }
  }

  return (
    <main className="shell private-shell">
      <section
        className="hero private-hero"
        aria-labelledby="family-reunification-title"
      >
        <div className="hero-topline">
          <p className="eyebrow">{t("web.family.private.eyebrow")}</p>
          <LanguageSelector />
        </div>
        <h1 id="family-reunification-title">{t("web.family.private.title")}</h1>
        <p className="summary">{t("web.family.private.summary")}</p>
      </section>

      <section
        className="status-card safety-card"
        aria-labelledby="family-limits-title"
      >
        <h2 id="family-limits-title">{t("web.family.safety.title")}</h2>
        <ul className="safety-list">
          <li>{t("web.family.safety.no_photos")}</li>
          <li>{t("web.family.safety.no_exact_location")}</li>
          <li>{t("web.family.safety.no_minor_identity")}</li>
          <li>{t("web.family.safety.in_person")}</li>
        </ul>
      </section>

      {state.status === "validating" ? (
        <section className="status-card" aria-live="polite">
          <h2>{t("web.family.validation.checking.title")}</h2>
          <p>{t("web.family.validation.checking.body")}</p>
        </section>
      ) : null}

      {state.status === "error" ? (
        <section className="status-card" aria-live="polite">
          <h2>{t("web.family.error.title")}</h2>
          <p role="alert">{state.message}</p>
          <p>{t("web.family.error.help")}</p>
        </section>
      ) : null}

      {state.status === "ready" ? (
        <section
          className="status-card"
          aria-labelledby="private-search-title"
          aria-live="polite"
        >
          <SectionHeader
            eyebrow={t("web.family.search.incident", {
              incidentId: state.validation.incidentId,
            })}
            title={t("web.family.search.title")}
            titleId="private-search-title"
            trailing={
              <strong>{t("web.family.search.verification_required")}</strong>
            }
          />

          {state.message ? <p role="status">{state.message}</p> : null}

          <form className="family-form" onSubmit={handleSearchSubmit}>
            <label htmlFor="family-age-band">
              {t("web.family.form.age.label")}
            </label>
            <select
              id="family-age-band"
              name="ageBand"
              value={form.ageBand}
              onChange={(event) =>
                setForm({
                  ...form,
                  ageBand: event.currentTarget
                    .value as FamilyReunificationForm["ageBand"],
                })
              }
            >
              <option value="">{t("web.family.form.age.unknown")}</option>
              <option value="child">{t("web.family.form.age.child")}</option>
              <option value="teen">{t("web.family.form.age.teen")}</option>
              <option value="adult">{t("web.family.form.age.adult")}</option>
              <option value="older_adult">
                {t("web.family.form.age.older_adult")}
              </option>
            </select>

            <label htmlFor="family-relation-hint">
              {t("web.family.form.relation.label")}
            </label>
            <input
              id="family-relation-hint"
              name="relationHint"
              maxLength={80}
              value={form.relationHint}
              onChange={(event) =>
                setForm({ ...form, relationHint: event.currentTarget.value })
              }
              placeholder={t("web.family.form.relation.placeholder")}
            />

            <label htmlFor="family-area-label">
              {t("web.family.form.area.label")}
            </label>
            <input
              id="family-area-label"
              name="lastKnownAreaLabel"
              maxLength={120}
              value={form.lastKnownAreaLabel}
              onChange={(event) =>
                setForm({
                  ...form,
                  lastKnownAreaLabel: event.currentTarget.value,
                })
              }
              placeholder={t("web.family.form.area.placeholder")}
            />

            <button type="submit" disabled={isSearching}>
              {isSearching
                ? t("web.family.form.searching")
                : t("web.family.form.search")}
            </button>
          </form>

          {state.search ? (
            <FamilyReunificationResults response={state.search} />
          ) : null}

          <button
            className="primary-action"
            type="button"
            onClick={handleInPersonReferral}
            disabled={isReferring}
          >
            {isReferring
              ? t("web.family.referral.prepare")
              : t("web.family.referral.continue")}
          </button>
        </section>
      ) : null}
    </main>
  );
}

function formatFamilyMatchRelation(
  status: FamilyReunificationSearchResponse["matches"][number]["status"],
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (status === "possible_match")
    return t("web.family.results.relation.possible_match");
  return t("web.family.results.not_provided");
}

function formatFamilyAgeBand(
  ageBand: FamilyReunificationSearchResponse["matches"][number]["ageBand"],
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (ageBand === "child") return t("web.family.form.age.child");
  if (ageBand === "teen") return t("web.family.form.age.teen");
  if (ageBand === "adult") return t("web.family.form.age.adult");
  if (ageBand === "older_adult") return t("web.family.form.age.older_adult");
  return t("web.family.results.not_provided");
}

function formatFamilyReferralMessage(
  type: FamilyReunificationSearchResponse["referral"]["type"],
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (type === "in_person_verification")
    return t("web.family.referral.in_person_verification");
  return t("web.family.link.unavailable");
}

function FamilyReunificationResults({
  response,
}: {
  response: FamilyReunificationSearchResponse;
}) {
  const { t } = useI18n();

  return (
    <div className="family-results">
      <h3>{t("web.family.results.title")}</h3>
      {response.matches.length === 0 ? (
        <p>{t("web.family.results.none")}</p>
      ) : null}
      <ul className="work-center-list">
        {response.matches.map((match) => (
          <li key={match.matchId}>
            <Card tone={match.verificationRequired ? "warning" : "success"}>
              <h4>
                {match.status === "possible_match"
                  ? t("web.family.results.possible_match")
                  : t("web.family.results.none")}
              </h4>
              <p>
                {t("web.family.results.age", {
                  value: formatFamilyAgeBand(match.ageBand, t),
                })}
              </p>
              <p>
                {t("web.family.results.relation", {
                  value: formatFamilyMatchRelation(match.status, t),
                })}
              </p>
              <p>
                {t("web.family.results.area", {
                  value:
                    match.lastKnownAreaLabel ??
                    t("web.family.results.not_provided"),
                })}
              </p>
              <p>
                {t("web.family.results.verification", {
                  value: match.verificationRequired
                    ? t("web.family.results.yes")
                    : t("web.family.results.no"),
                })}
              </p>
            </Card>
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
  state: Extract<SosState, { status: "ready" }>;
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
        <label htmlFor="sos-confirmation">{t("web.sos.confirm.label")}</label>
        <input
          id="sos-confirmation"
          name="sos-confirmation"
          value={confirmation}
          onChange={(event) => onConfirmationChange(event.currentTarget.value)}
          aria-describedby="sos-copy"
          disabled={isSubmitting}
        />
        <p id="sos-copy">{t("web.sos.confirm.help")}</p>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t("web.sos.submitting") : t("web.sos.submit")}
        </button>
      </form>
      <SosAlertList alerts={state.response.sosAlerts} />
    </div>
  );
}

function FanoutStrip({ fanout }: { fanout: SosFanoutStatus }) {
  const { t } = useI18n();

  return (
    <MetaRow
      aria-label={t("web.sos.fanout.aria")}
      items={[
        {
          key: "total",
          label: t("web.sos.fanout.total"),
          value: fanout.total,
          tone: sosFanoutStatTone("total"),
        },
        {
          key: "queued",
          label: t("web.sos.fanout.queued"),
          value: fanout.queued,
          tone: sosFanoutStatTone("queued"),
        },
        {
          key: "pending",
          label: t("web.sos.fanout.pending"),
          value: fanout.pending,
          tone: sosFanoutStatTone("pending"),
        },
        {
          key: "failed",
          label: t("web.sos.fanout.failed"),
          value: fanout.failed,
          tone: sosFanoutStatTone("failed"),
        },
        {
          key: "cancelled",
          label: t("web.sos.fanout.cancelled"),
          value: fanout.cancelled,
          tone: sosFanoutStatTone("cancelled"),
        },
      ]}
    />
  );
}

function SosAlertList({ alerts }: { alerts: SosAlert[] }) {
  const { t } = useI18n();
  if (alerts.length === 0)
    return <p>{t("web.sos.empty")}</p>;

  return (
    <ul className="work-center-list">
      {alerts.map((alert) => (
        <li key={alert.sosAlertId}>
          <Card tone={sosAlertStatusTone(alert.status)}>
            <div className="card-title-row">
              <h4>{t("web.sos.alert.title")}</h4>
              <StatusBadge
                tone={sosAlertStatusTone(alert.status)}
                label={describeSosAlertStatus(alert.status, t)}
              />
            </div>
            <p>{describeSosSeverity(alert.severity, t)}</p>
            <p>
              {t("web.sos.alert.source", {
                source: describeSourceChannel(alert.sourceChannel, t),
              })}
            </p>
            <p>{formatSosAlertLocation(alert, t)}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function ChannelFreshnessBanner({ state }: { state: ChannelFreshnessState }) {
  if (state.status === "loading") return null;

  if (state.status === "error") {
    return (
      <section
        className="status-card channel-warning"
        role="status"
        aria-live="polite"
      >
        <SectionHeader
          eyebrow="Aviso"
          title="No pudimos comprobar si hay cambios nuevos"
          trailing={
            <StatePill
              tone="warning"
              label="Revisar antes de actuar"
              Icon={AlertTriangle}
            />
          }
        />
        <p>
          Usa esta pantalla como orientación y vuelve a intentar si vas a tomar
          una decisión importante.
        </p>
      </section>
    );
  }

  const warning = describeChannelFreshnessWarning(state.freshness);
  if (!warning) return null;

  return (
    <section
      className="status-card channel-warning"
      role="status"
      aria-live="polite"
    >
      <SectionHeader
        eyebrow="Aviso"
        title={warning.title}
        trailing={
          <StatePill
            tone={freshnessTone(state.freshness.status)}
            label={warning.stateLabel}
            Icon={AlertTriangle}
          />
        }
      />
      <p>{warning.body}</p>
      {state.freshness.cursorLag > 0 ? (
        <p>
          {state.freshness.cursorLag} cambios recientes todavía no aparecen
          aquí.
        </p>
      ) : null}
      {state.freshness.hasConflicts ? (
        <p>Hay datos que un coordinador debe revisar antes de actuar.</p>
      ) : null}
      <p>Actualiza la pantalla antes de moverte o aceptar un encargo.</p>
    </section>
  );
}

function describeChannelFreshnessWarning(
  freshness: SyncFreshness,
): { title: string; body: string; stateLabel: string } | null {
  if (
    freshness.status === "fresh" &&
    freshness.cursorLag === 0 &&
    !freshness.hasConflicts
  )
    return null;

  if (freshness.status === "missing") {
    return {
      title: "Falta una comprobación de cambios",
      body: "La pantalla puede estar incompleta porque no recibimos la señal de actualización.",
      stateLabel: "Comprobación pendiente",
    };
  }

  if (freshness.status === "expired") {
    return {
      title: "La información puede estar desactualizada",
      body: "Ha pasado demasiado tiempo desde la última comprobación correcta.",
      stateLabel: "Revisar",
    };
  }

  return {
    title: "Puede haber cambios recientes",
    body: "Algunas acciones nuevas podrían no aparecer todavía en esta pantalla.",
    stateLabel: "Actualizar",
  };
}

function WorkCenterOnlineView({
  state,
}: {
  state: Extract<WorkCenterState, { status: "ready" }>;
}) {
  if (state.workCenters.length === 0) {
    return <p>Todavía no hay puntos de ayuda registrados.</p>;
  }

  return (
    <div className="work-center-grid">
      <div>
        <h3>Lista</h3>
        <ul className="work-center-list">
          {state.workCenters.map((workCenter) => (
            <li key={workCenter.workCenterId}>
              <Card tone={activationStateTone(workCenter.activationState)}>
                <div className="card-title-row">
                  <h4>{workCenter.name}</h4>
                  <StatePill
                    tone={activationStateTone(workCenter.activationState)}
                    label={describeWorkCenterAvailability(workCenter)}
                    Icon={CircleDot}
                  />
                </div>
                <p>
                  {workCenter.centerType ?? "Punto de ayuda"} · Prioridad{" "}
                  {describePriority(workCenter.priority)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3>Detalle</h3>
        {state.selected ? (
          <WorkCenterDetailCard workCenter={state.selected} />
        ) : (
          <p>Elige un punto de ayuda para ver más detalle.</p>
        )}
      </div>

      <div>
        <h3>Ubicaciones en texto</h3>
        <ol
          className="map-lite"
          aria-label="Lista textual de ubicaciones aproximadas de puntos de ayuda"
        >
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
  const { t } = useI18n();
  if (reports.length === 0) return <p>{t("web.resources.empty")}</p>;

  const needed = reports.filter((report) => report.reportKind === "needed");
  const surplus = reports.filter((report) => report.reportKind === "surplus");

  return (
    <div className="resource-grid">
      <ResourceColumn
        title={t("web.resources.needed.title")}
        emptyText={t("web.resources.needed.empty")}
        reports={needed}
      />
      <ResourceColumn
        title={t("web.resources.surplus.title")}
        emptyText={t("web.resources.surplus.empty")}
        reports={surplus}
      />
    </div>
  );
}

function ResourceColumn({
  title,
  emptyText,
  reports,
}: {
  title: string;
  emptyText: string;
  reports: ResourceReportSummary[];
}) {
  const { t } = useI18n();

  return (
    <div>
      <h3>{title}</h3>
      {reports.length === 0 ? <p>{emptyText}</p> : null}
      <ul className="work-center-list">
        {reports.map((report) => (
          <li key={report.resourceReportId}>
            <Card tone={urgencyTone(report.urgency)}>
              <div className="card-title-row">
                <h4>{report.category}</h4>
                <StatePill
                  tone={urgencyTone(report.urgency)}
                  label={describeUrgency(report.urgency, t)}
                  Icon={AlertTriangle}
                />
              </div>
              <p>{report.quantityApprox}</p>
              <p>
                {report.workCenterId
                  ? t("web.resources.assigned")
                  : t("web.resources.unassigned")}
              </p>
              <p>
                {t("web.resources.notes.label")}{" "}
                {report.constraints.length
                  ? report.constraints.join(", ")
                  : t("web.resources.notes.empty")}
              </p>
            </Card>
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
  state: Extract<DispatchState, { status: "ready" }>;
  onAction: (
    task: DispatchTask,
    status: Exclude<DispatchTaskStatus, "pending">,
  ) => void;
}) {
  const { t } = useI18n();
  if (state.tasks.length === 0)
    return <p>{t("web.dispatch.empty")}</p>;

  return (
    <div>
      {state.actionMessage ? <p role="status">{state.actionMessage}</p> : null}
      <ul className="work-center-list">
        {state.tasks.map((task) => (
          <li key={task.dispatchTaskId}>
            <Card
              as="article"
              className="dispatch-card"
              tone={dispatchStatusTone(task.status)}
            >
              <div>
                <div className="card-title-row">
                  <h4>{task.category}</h4>
                  <StatePill
                    tone={dispatchStatusTone(task.status)}
                    label={describeDispatchStatus(task.status, t)}
                    Icon={ClipboardCheck}
                  />
                </div>
                <p>{task.quantityApprox}</p>
                <p>
                  {task.targetWorkCenterId
                    ? t("web.dispatch.destination.assigned")
                    : t("web.dispatch.destination.pending")}
                </p>
              </div>
              <div className="action-row">
                {dispatchActions.map((action) => (
                  (() => {
                    const actionLabel = t(action.labelKey);
                    return (
                  <button
                    key={action.status}
                    type="button"
                    onClick={() => onAction(task, action.status)}
                    disabled={task.status === action.status}
                    aria-label={t("web.dispatch.action.aria", {
                      action: actionLabel,
                      category: task.category,
                    })}
                  >
                    {actionLabel}
                  </button>
                    );
                  })()
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}


function confirmDispatchCancellation(task: DispatchTask): boolean {
  if (typeof window === "undefined") return true;
  return window.confirm(
    `¿Seguro que no puedes hacer este encargo de ${task.quantityApprox} (${task.category})? Otro voluntario podrá tomarlo.`,
  );
}

function describeWorkCenterAvailability(workCenter: WorkCenterSummary): string {
  if (workCenter.activationState === "active") return "Recibiendo ayuda";
  if (workCenter.activationState === "needs_review")
    return "Revisar antes de ir";
  return "Pendiente de confirmar";
}

function describePriority(priority: WorkCenterSummary["priority"]): string {
  if (priority === "critical") return "muy alta";
  if (priority === "high") return "alta";
  if (priority === "medium") return "media";
  return "baja";
}

function describeUrgency(
  urgency: ResourceReportSummary["urgency"],
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (urgency === "critical") return t("web.urgency.critical");
  if (urgency === "high") return t("web.urgency.high");
  if (urgency === "medium") return t("web.urgency.medium");
  return t("web.urgency.low");
}

function describeDispatchStatus(
  status: DispatchTaskStatus,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (status === "accepted") return t("web.dispatch.status.accepted");
  if (status === "en_route") return t("web.dispatch.status.en_route");
  if (status === "delivered") return t("web.dispatch.status.delivered");
  if (status === "cancelled") return t("web.dispatch.status.cancelled");
  return t("web.dispatch.status.pending");
}

function describeWorkCenterStatus(status: WorkCenterSummary["status"]): string {
  if (status === "inactive") return "Sin actividad reciente";
  if (status === "archived") return "Archivado";
  return "Reportado";
}

function describeFreshness(freshness: WorkCenterSummary["freshness"]): string {
  if (freshness === "fresh") return "Reciente";
  if (freshness === "stale") return "Puede estar desactualizado";
  return "Sin confirmar";
}

function describeConfidence(confidence: WorkCenterSummary["confidence"]): string {
  if (confidence === "high") return "Alta";
  if (confidence === "medium") return "Media";
  return "Baja";
}

function describeRisk(risk: WorkCenterSummary["risk"]): string {
  if (risk === "high") return "Alta";
  if (risk === "medium") return "Media";
  return "Baja";
}

function describeSignalSummary(workCenter: WorkCenterDetail): string {
  return `${workCenter.signalCount} avisos · ${workCenter.corroboratingSignalCount} coinciden`;
}

function describeSignalType(signalType: string): string {
  if (signalType === "creator_report") return "Aviso inicial";
  if (signalType === "corroboration") return "Aviso coincidente";
  if (signalType === "status_update") return "Actualización";
  return "Aviso";
}

function describeSourceChannel(
  sourceChannel: string | null | undefined,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (sourceChannel === "telegram") return "Telegram";
  if (sourceChannel === "web-ui") return t("web.source.web");
  if (sourceChannel === "mobile") return t("web.source.mobile");
  return t("web.source.unknown");
}

function describeSosAlertStatus(
  status: SosAlert["status"],
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (status === "open") return t("web.sos.status.open");
  return t("web.sos.status.cancelled");
}

function describeSosSeverity(
  severity: SosAlert["severity"],
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (severity === "medical") return t("web.sos.severity.medical");
  if (severity === "security") return t("web.sos.severity.security");
  if (severity === "trapped") return t("web.sos.severity.trapped");
  return t("web.sos.severity.critical");
}

function WorkCenterDetailCard({
  workCenter,
}: {
  workCenter: WorkCenterDetail;
}) {
  const { t } = useI18n();

  return (
    <Card
      as="article"
      className="detail-card"
      tone={activationStateTone(workCenter.activationState)}
    >
      <div className="card-title-row">
        <h4>{workCenter.name}</h4>
        <StatusBadge
          tone={activationStateTone(workCenter.activationState)}
          label={describeWorkCenterAvailability(workCenter)}
        />
      </div>
      <StatusStrip workCenter={workCenter} />
      <dl>
        <dt>Descripción</dt>
        <dd>{workCenter.description ?? "Sin descripción disponible"}</dd>
        <dt>Hace falta</dt>
        <dd>{workCenter.initialNeed ?? "No se informó una necesidad inicial"}</dd>
        <dt>Sobra</dt>
        <dd>{workCenter.surplus ?? "No se informó sobrante"}</dd>
        <dt>Avisos recibidos</dt>
        <dd>{describeSignalSummary(workCenter)}</dd>
      </dl>
      <ul className="signal-list" aria-label="Últimos avisos recibidos">
        {workCenter.latestSignals.map((signal) => (
          <li key={signal.signalId}>
            {t("web.work_center.signal.source", {
              signalType: describeSignalType(signal.signalType),
              source: describeSourceChannel(signal.sourceChannel, t),
            })}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StatusStrip({
  workCenter,
}: {
  workCenter: WorkCenterSummary | WorkCenterDetail;
}) {
  return (
    <MetaRow
      aria-label={`${workCenter.name} estado para voluntarios`}
      items={[
        {
          key: "status",
          label: "Situación",
          value: describeWorkCenterStatus(workCenter.status),
          tone: workCenterStatusTone(workCenter.status),
        },
        {
          key: "activation",
          label: "Uso",
          value: describeWorkCenterAvailability(workCenter),
          tone: activationStateTone(workCenter.activationState),
        },
        {
          key: "freshness",
          label: "Actualización",
          value: describeFreshness(workCenter.freshness),
          tone: freshnessTone(workCenter.freshness),
        },
        {
          key: "confidence",
          label: "Confianza",
          value: describeConfidence(workCenter.confidence),
          tone: confidenceTone(workCenter.confidence),
        },
        {
          key: "risk",
          label: "Precaución",
          value: describeRisk(workCenter.risk),
          tone: riskTone(workCenter.risk),
        },
      ]}
    />
  );
}

function formatLocation(location: WorkCenterSummary["location"]): string {
  if (!location) return "No coordinates";
  return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
}

function formatSosAlertLocation(
  alert: SosAlert,
  t: ReturnType<typeof useI18n>["t"],
): string {
  if (!alert.location) return t("web.sos.location.missing");
  if (alert.location.accuracyMeters !== undefined)
    return t("web.sos.location.accuracy", {
      accuracyMeters: alert.location.accuracyMeters,
    });
  return t("web.sos.location.present");
}

function formatFanout(
  fanout: SosFanoutStatus,
  t: ReturnType<typeof useI18n>["t"],
): string {
  return t("web.sos.fanout", {
    total: fanout.total,
    queued: fanout.queued,
    pending: fanout.pending,
    failed: fanout.failed,
    cancelled: fanout.cancelled,
  });
}

function upsertSosAlert(alerts: SosAlert[], alert: SosAlert): SosAlert[] {
  const existing = alerts.filter(
    (candidate) => candidate.sosAlertId !== alert.sosAlertId,
  );
  return [alert, ...existing];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function formatPrivateLinkError(
  error: unknown,
  t: ReturnType<typeof useI18n>["t"],
): string {
  const message = errorMessage(error);
  if (
    message === "invalid_payload" ||
    message === "permission_denied" ||
    message === "invalid_link_scope" ||
    message === "link_correlation_mismatch" ||
    message === "link_expired"
  ) {
    return t(`web.family.error.${message}`);
  }

  return t("web.family.link.unavailable");
}

function getPrivateLinkParams(): {
  token: string;
  correlationId: string;
} | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token")?.trim();
  const correlationId =
    params.get("correlationId")?.trim() ?? params.get("correlation_id")?.trim();

  return token && correlationId ? { token, correlationId } : null;
}

function getBrowserFingerprint(): string {
  if (typeof window === "undefined") return "browser-fingerprint-unavailable";

  const storageKey = "zona-cero-family-reunification-fingerprint";
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const randomId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const generated = `browser-${randomId}`;
  window.sessionStorage.setItem(storageKey, generated);
  return generated;
}

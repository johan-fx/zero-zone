import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DispatchTaskListResponse,
  DispatchTaskResponse,
  ResourceReportListResponse,
  SosAlertCreateResponse,
  SosAlertStatusResponse,
  SyncPullResponse,
} from "@zona-cero/contracts";
import {
  familyReunificationSearchResponseFixture,
  privateFamilyReunificationConsumeResponseFixture,
  privateFamilyReunificationIssueResponseFixture,
  privateFamilyReunificationValidateResponseFixture,
  sosAlertCreateResponseHappyFixture,
  sosAlertStatusHappyFixture,
  workCenterDetailHappyFixture,
  workCenterListHappyFixture,
} from "../../../packages/testing/src";
import { App } from "./App";
vi.mock("./features/operations-map/OperationsMapPanel", () => ({
  OperationsMapPanel: ({
    styleName,
    copy,
  }: {
    styleName: string;
    copy?: { eyebrow: string; title: string; summary?: string };
  }) => (
    <div
      data-testid="mock-operations-map-panel"
      data-style-name={styleName}
      data-title={copy?.title ?? "Map overview"}
    >
      Map panel: {copy?.eyebrow ?? "Operational map"} /{" "}
      {copy?.title ?? "Map overview"}
      {copy?.summary ? <p>{copy.summary}</p> : null}
    </div>
  ),
}));

import {
  millisecondsUntilNextThemeBoundary,
  readStoredThemeOverride,
  resolveAutomaticThemeMode,
  themeOverrideStorageKey,
} from "./themeMode";

const freshSyncPullFixture: SyncPullResponse = {
  operations: [],
  cursor: null,
  hasMore: false,
  freshness: {
    status: "fresh",
    lastFreshAt: "2026-07-01T08:00:00.000Z",
    lastSyncedAt: "2026-07-01T08:00:00.000Z",
    cursorLag: 0,
    hasConflicts: false,
    channels: [
      {
        channel: "mobile",
        status: "fresh",
        lastFreshAt: "2026-07-01T08:00:00.000Z",
        lastSyncedAt: "2026-07-01T08:00:00.000Z",
        cursorLag: 0,
        hasConflicts: false,
      },
    ],
  },
  conflicts: [],
};

const resourceReportListFixture: ResourceReportListResponse = {
  resourceReports: [
    {
      resourceReportId: "resource-needed-water",
      incidentId: "incident-zc-demo",
      cellId: "cell-zc-demo",
      workCenterId: "center-north-triage",
      category: "water",
      quantityApprox: "20 bottles",
      urgency: "high",
      constraints: ["sealed bottles"],
      reportKind: "needed",
      freshness: "fresh",
      confidence: "low",
      risk: "medium",
      sourceChannel: "telegram",
      createdAt: "2026-06-30T10:00:00.000Z",
      updatedAt: "2026-06-30T10:00:00.000Z",
    },
    {
      resourceReportId: "resource-surplus-blankets",
      incidentId: "incident-zc-demo",
      cellId: "cell-zc-demo",
      category: "blankets",
      quantityApprox: "10 boxes",
      urgency: "medium",
      constraints: [],
      reportKind: "surplus",
      freshness: "fresh",
      confidence: "medium",
      risk: "low",
      sourceChannel: "web-ui",
      createdAt: "2026-06-30T10:00:00.000Z",
      updatedAt: "2026-06-30T10:00:00.000Z",
    },
  ],
};

const dispatchTaskListFixture: DispatchTaskListResponse = {
  dispatchTasks: [
    {
      dispatchTaskId: "dispatch-task-water-1",
      incidentId: "incident-zc-demo",
      cellId: "cell-zc-demo",
      category: "water",
      quantityApprox: "20 bottles",
      fromResourceReportId: "resource-surplus-water",
      toResourceReportId: "resource-needed-water",
      targetWorkCenterId: "center-north-triage",
      status: "pending",
      notes: "Use sealed bottles",
      sourceChannel: "web-ui",
      createdAt: "2026-06-30T10:00:00.000Z",
      updatedAt: "2026-06-30T10:00:00.000Z",
    },
  ],
};

const dispatchTaskResponseFixture: DispatchTaskResponse = {
  dispatchTask: {
    ...dispatchTaskListFixture.dispatchTasks[0]!,
    status: "accepted",
    updatedAt: "2026-06-30T10:05:00.000Z",
  },
  audit: { auditEventId: "audit_dispatch_task_updated" },
  idempotent: false,
};

const sosStatusFixture: SosAlertStatusResponse = sosAlertStatusHappyFixture;
const sosCreateFixture: SosAlertCreateResponse = {
  ...sosAlertCreateResponseHappyFixture,
  sosAlert: {
    ...sosAlertCreateResponseHappyFixture.sosAlert,
    sosAlertId: "sos-web-critical-1",
    sourceChannel: "web-ui",
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.pushState({}, "", "/");
  window.sessionStorage.clear();
  window.localStorage.clear();
  delete document.documentElement.dataset.zcTheme;
  delete document.documentElement.dataset.zcThemeMode;
});

describe("web ui work center shell", () => {
  it("resolves automatic theme from local time boundaries", () => {
    expect(resolveAutomaticThemeMode(new Date(2026, 6, 4, 6, 59))).toBe(
      "night",
    );
    expect(resolveAutomaticThemeMode(new Date(2026, 6, 4, 7, 0))).toBe("day");
    expect(resolveAutomaticThemeMode(new Date(2026, 6, 4, 19, 59))).toBe("day");
    expect(resolveAutomaticThemeMode(new Date(2026, 6, 4, 20, 0))).toBe(
      "night",
    );
  });

  it("schedules automatic theme refreshes at the next day/night boundary", () => {
    expect(
      millisecondsUntilNextThemeBoundary(new Date(2026, 6, 4, 6, 59, 30)),
    ).toBe(30_000);
    expect(
      millisecondsUntilNextThemeBoundary(new Date(2026, 6, 4, 19, 59, 30)),
    ).toBe(30_000);
    expect(
      millisecondsUntilNextThemeBoundary(new Date(2026, 6, 4, 20, 0, 0)),
    ).toBe(39_600_000);
  });

  it("falls back to auto when stored theme access is unavailable", () => {
    const storage = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } as unknown as Storage;

    expect(readStoredThemeOverride(storage)).toBe("auto");
  });

  it("applies and persists the global theme mode selector", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 4, 21, 0));
    mockOperationsShellFetch();
    const { webTelemetry } = await import("./telemetry");
    const initialLoadedEvents = webTelemetry.events.filter(
      (event) => event.action === "app.loaded",
    ).length;

    render(<App />);

    await waitFor(() =>
      expect(
        webTelemetry.events.filter((event) => event.action === "app.loaded"),
      ).toHaveLength(initialLoadedEvents + 1),
    );
    expect(await screen.findByLabelText("Modo de tema")).toBeInTheDocument();
    expect(screen.getByLabelText("Auto")).toBeChecked();
    expect(screen.getByText("Actual: Noche")).toBeInTheDocument();
    expect(document.documentElement.dataset.zcTheme).toBe("dark");
    expect(document.documentElement.dataset.zcThemeMode).toBe("auto");

    fireEvent.click(screen.getByLabelText("Día"));
    await Promise.resolve();

    expect(
      webTelemetry.events.filter((event) => event.action === "app.loaded"),
    ).toHaveLength(initialLoadedEvents + 1);
    expect(screen.getByLabelText("Día")).toBeChecked();
    expect(screen.getByText("Actual: Día")).toBeInTheDocument();
    expect(document.documentElement.dataset.zcTheme).toBe("light");
    expect(document.documentElement.dataset.zcThemeMode).toBe("day");
    expect(window.localStorage.getItem(themeOverrideStorageKey)).toBe("day");

    cleanup();
    mockOperationsShellFetch();
    render(<App />);

    expect(await screen.findByLabelText("Modo de tema")).toBeInTheDocument();
    expect(screen.getByLabelText("Día")).toBeChecked();
    expect(document.documentElement.dataset.zcTheme).toBe("light");
  });

  it("cleans up global theme attributes on unmount", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 4, 9, 0));
    mockOperationsShellFetch();

    const { unmount } = render(<App />);

    expect(await screen.findByLabelText("Modo de tema")).toBeInTheDocument();
    expect(document.documentElement.dataset.zcTheme).toBe("light");
    expect(document.documentElement.dataset.zcThemeMode).toBe("auto");

    unmount();

    expect(document.documentElement.dataset.zcTheme).toBeUndefined();
    expect(document.documentElement.dataset.zcThemeMode).toBeUndefined();
  });

  it("sets document language from query locale and renders the language selector", async () => {
    window.history.pushState({}, "", "/?lang=es");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/health"))
        return jsonResponse({
          service: "zona-cero-api",
          ok: true,
          version: "test",
        });
      if (
        url.includes("/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull")
      )
        return jsonResponse(freshSyncPullFixture);
      if (url.endsWith("/incidents/incident-zc-demo/work-centers"))
        return jsonResponse({ workCenters: [] });
      if (url.endsWith("/incidents/incident-zc-demo/resource-reports"))
        return jsonResponse({ resourceReports: [] });
      if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks"))
        return jsonResponse({ dispatchTasks: [] });
      if (url.endsWith("/incidents/incident-zc-demo/sos"))
        return jsonResponse({
          sosAlerts: [],
          fanout: {
            total: 0,
            queued: 0,
            pending: 0,
            failed: 0,
            cancelled: 0,
          },
        });
      return new Response("not found", { status: 404 });
    });

    render(<App />);

    expect(document.documentElement.lang).toBe("es");
    expect(screen.getByLabelText("Idioma")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Ayuda cercana para vecinos y voluntarios",
      }),
    ).toBeInTheDocument();
  });

  it("renders backend health plus work center list, detail and map-lite from shared contracts", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({
          service: "zona-cero-api",
          ok: true,
          version: "test",
        });
      }
      if (
        url.includes("/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull")
      ) {
        return jsonResponse(freshSyncPullFixture);
      }
      if (url.endsWith("/incidents/incident-zc-demo/work-centers")) {
        return jsonResponse(workCenterListHappyFixture);
      }
      if (
        url.endsWith(
          "/incidents/incident-zc-demo/work-centers/center-north-triage",
        )
      ) {
        return jsonResponse(workCenterDetailHappyFixture);
      }
      if (url.endsWith("/incidents/incident-zc-demo/resource-reports")) {
        return jsonResponse(resourceReportListFixture);
      }
      if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks")) {
        return jsonResponse(dispatchTaskListFixture);
      }
      if (
        url.endsWith(
          "/incidents/incident-zc-demo/dispatch-tasks/dispatch-task-water-1",
        )
      ) {
        return jsonResponse(dispatchTaskResponseFixture);
      }
      if (url.endsWith("/incidents/incident-zc-demo/sos")) {
        return jsonResponse(sosStatusFixture);
      }
      return new Response("not found", { status: 404 });
    });

    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: /Ayuda cercana para vecinos y voluntarios/i,
      }),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId("api-health")).toHaveTextContent(
        "zona-cero-api está online",
      ),
    );

    // Inicio landing renders tone-coded overview tiles with live counts once data is ready.
    await waitFor(() =>
      expect(screen.getAllByText("1 puntos").length).toBeGreaterThan(0),
    );
    expect(
      screen.getByRole("button", { name: /Buscar punto/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ver avisos/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Abrir encargo/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Abrir SOS/ }),
    ).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Mapa" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Puntos de ayuda" }));
    await waitFor(() =>
      expect(screen.getAllByText("North triage point").length).toBeGreaterThan(
        0,
      ),
    );

    const helpSection = screen
      .getByRole("heading", { name: "Puntos de ayuda" })
      .closest("section")!;
    expect(
      within(helpSection).getByText(/mapa público por país/i),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(helpSection).getByTestId("mock-operations-map-panel"),
      ).toHaveAttribute("data-title", "Mapa de ayuda por país"),
    );
    const helpText = helpSection.textContent ?? "";
    expect(helpText.indexOf("Map panel: Mapa público por país")).toBeLessThan(
      helpText.indexOf("Lista"),
    );
    expect(
      within(helpSection).getByRole("region", { name: "Lista y detalle" }),
    ).toBeInTheDocument();

    expect(screen.getByText("41.3800, 2.1700")).toBeInTheDocument();
    expect(
      screen.getByText(/Triage and water distribution/),
    ).toBeInTheDocument();
    expect(screen.getByText("Aviso inicial por Telegram")).toBeInTheDocument();

    const status = screen.getAllByLabelText(
      "North triage point estado para voluntarios",
    )[0];
    expect(within(status).getByText("Reportado")).toBeInTheDocument();
    expect(within(status).getByText("Pendiente de confirmar")).toBeInTheDocument();
    expect(within(status).getByText("Reciente")).toBeInTheDocument();
    expect(within(status).getByText("Baja")).toBeInTheDocument();
    expect(within(status).getByText("Media")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Avisar que falta algo" }),
    );
    expect(
      screen.getByRole("heading", { name: "Avisar que falta algo" }),
    ).toBeInTheDocument();
    const resourcesSection = screen
      .getByRole("heading", { name: "Avisar que falta algo" })
      .closest("section")!;
    expect(
      within(resourcesSection).getByText("20 bottles"),
    ).toBeInTheDocument();
    expect(within(resourcesSection).getByText("Urgente")).toBeInTheDocument();
    expect(within(resourcesSection).getByText("10 boxes")).toBeInTheDocument();
    expect(
      within(resourcesSection).getByText("Importante"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mi encargo" }));
    expect(
      screen.getByRole("heading", { name: "Mi encargo" }),
    ).toBeInTheDocument();
    const dispatchSection = screen
      .getByRole("heading", { name: "Mi encargo" })
      .closest("section")!;
    expect(within(dispatchSection).getByText("20 bottles")).toBeInTheDocument();
    expect(within(dispatchSection).getByText("Disponible")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "SOS cercano" }));
    expect(
      screen.getByRole("heading", { name: "SOS cercano" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Aviso SOS recibido"),
    ).toBeInTheDocument();
    const sosCard = screen
      .getByText("Aviso SOS recibido")
      .closest("article")!;
    expect(within(sosCard).getByText("Activo")).toBeInTheDocument();
    expect(within(sosCard).getByText("Emergencia reportada")).toBeInTheDocument();
    expect(screen.getByLabelText("Estado de avisos SOS")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Inicio" }));
    expect(
      screen.getByRole("button", { name: /Buscar punto/ }),
    ).toBeInTheDocument();
  });

  it("passes English civil map copy and exposes the help-points list as a named region", async () => {
    window.localStorage.setItem("zona-cero-locale", "en");
    mockOperationsShellFetch();

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Help points" }));

    const helpSection = screen
      .getByRole("heading", { name: "Help points" })
      .closest("section")!;

    await waitFor(() =>
      expect(
        within(helpSection).getByTestId("mock-operations-map-panel"),
      ).toHaveAttribute("data-title", "Country help map"),
    );
    expect(
      within(helpSection).getByText(/public country-level information/i),
    ).toBeInTheDocument();
    expect(
      within(helpSection).getByRole("region", { name: "List and detail" }),
    ).toBeInTheDocument();
    expect(
      within(helpSection).queryByText("Mapa de ayuda por país"),
    ).not.toBeInTheDocument();
  });


  it("keeps the operational map route hidden from navigation but directly reachable", async () => {
    window.history.pushState({}, "", "/#/map");
    mockOperationsShellFetch();

    render(<App />);

    expect(screen.queryByRole("button", { name: "Mapa" })).not.toBeInTheDocument();
    expect(
      await screen.findByTestId("mock-operations-map-panel"),
    ).toHaveAttribute("data-title", "Map overview");
  });

  it("requires explicit confirmation before cancelling a dispatch task", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health"))
        return jsonResponse({ service: "zona-cero-api", ok: true, version: "test" });
      if (url.includes("/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull"))
        return jsonResponse(freshSyncPullFixture);
      if (url.endsWith("/incidents/incident-zc-demo/work-centers"))
        return jsonResponse(workCenterListHappyFixture);
      if (url.endsWith("/incidents/incident-zc-demo/work-centers/center-north-triage"))
        return jsonResponse(workCenterDetailHappyFixture);
      if (url.endsWith("/incidents/incident-zc-demo/resource-reports"))
        return jsonResponse(resourceReportListFixture);
      if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks"))
        return jsonResponse(dispatchTaskListFixture);
      if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks/dispatch-task-water-1") && init?.method === "PATCH")
        return jsonResponse({
          ...dispatchTaskResponseFixture,
          dispatchTask: { ...dispatchTaskResponseFixture.dispatchTask, status: "cancelled" },
        });
      if (url.endsWith("/incidents/incident-zc-demo/sos"))
        return jsonResponse(sosStatusFixture);
      return new Response("not found", { status: 404 });
    });

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Mi encargo" }));
    fireEvent.click(await screen.findByRole("button", { name: "No puedo hacerlo: water" }));

    expect(confirm).toHaveBeenCalledWith(
      "¿Seguro que no puedes hacer este encargo de 20 bottles (water)? Otro voluntario podrá tomarlo.",
    );
    expect(
      fetcher.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/incidents/incident-zc-demo/dispatch-tasks/dispatch-task-water-1") &&
          init?.method === "PATCH",
      ),
    ).toBe(false);
  });

  it("shows backend freshness channel limitation banners for stale, expired, missing, cursor lag, and conflicts", async () => {
    const stalePull: SyncPullResponse = {
      ...freshSyncPullFixture,
      freshness: {
        ...freshSyncPullFixture.freshness,
        status: "stale",
        cursorLag: 4,
        hasConflicts: true,
      },
      conflicts: [
        {
          opId: "op-conflict-1",
          entityId: "center-north-triage",
          entityType: "work_center",
          code: "operation_conflict",
          message: "entity already exists with another source operation",
        },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/health"))
        return jsonResponse({
          service: "zona-cero-api",
          ok: true,
          version: "test",
        });
      if (
        url.includes("/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull")
      )
        return jsonResponse(stalePull);
      if (url.endsWith("/incidents/incident-zc-demo/work-centers"))
        return jsonResponse(workCenterListHappyFixture);
      if (
        url.endsWith(
          "/incidents/incident-zc-demo/work-centers/center-north-triage",
        )
      )
        return jsonResponse(workCenterDetailHappyFixture);
      if (url.endsWith("/incidents/incident-zc-demo/resource-reports"))
        return jsonResponse(resourceReportListFixture);
      if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks"))
        return jsonResponse(dispatchTaskListFixture);
      if (url.endsWith("/incidents/incident-zc-demo/sos"))
        return jsonResponse(sosStatusFixture);
      return new Response("not found", { status: 404 });
    });

    render(<App />);

    const staleTitle = await screen.findByText("Puede haber cambios recientes");
    const banner = staleTitle.closest('[role="status"]');
    expect(banner).toHaveTextContent("Puede haber cambios recientes");
    expect(banner).toHaveTextContent(
      "4 cambios recientes todavía no aparecen aquí",
    );
    expect(banner).toHaveTextContent(
      "Hay datos que un coordinador debe revisar antes de actuar",
    );
    expect(banner).not.toHaveTextContent(
      /offline save|offline sync|saved offline/i,
    );
  });

  it("shows expired and missing backend freshness without promising offline-first behavior", async () => {
    for (const status of ["expired", "missing"] as const) {
      cleanup();
      vi.restoreAllMocks();
      const pull: SyncPullResponse = {
        ...freshSyncPullFixture,
        freshness: {
          ...freshSyncPullFixture.freshness,
          status,
          lastFreshAt:
            status === "missing"
              ? null
              : freshSyncPullFixture.freshness.lastFreshAt,
          lastSyncedAt:
            status === "missing"
              ? null
              : freshSyncPullFixture.freshness.lastSyncedAt,
        },
      };
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith("/health"))
          return jsonResponse({
            service: "zona-cero-api",
            ok: true,
            version: "test",
          });
        if (
          url.includes(
            "/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull",
          )
        )
          return jsonResponse(pull);
        if (url.endsWith("/incidents/incident-zc-demo/work-centers"))
          return jsonResponse({ workCenters: [] });
        if (url.endsWith("/incidents/incident-zc-demo/resource-reports"))
          return jsonResponse({ resourceReports: [] });
        if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks"))
          return jsonResponse({ dispatchTasks: [] });
        if (url.endsWith("/incidents/incident-zc-demo/sos"))
          return jsonResponse({
            sosAlerts: [],
            fanout: {
              total: 0,
              queued: 0,
              pending: 0,
              failed: 0,
              cancelled: 0,
            },
          });
        return new Response("not found", { status: 404 });
      });

      render(<App />);
      const title = await screen.findByText(
        status === "expired"
          ? "La información puede estar desactualizada"
          : "Falta una comprobación de cambios",
      );
      const banner = title.closest('[role="status"]');
      expect(banner).toHaveTextContent(
        status === "expired"
          ? "La información puede estar desactualizada"
          : "Falta una comprobación de cambios",
      );
      expect(banner).not.toHaveTextContent(
        /offline save|offline sync|saved offline/i,
      );
    }
  });

  it("does not show noisy channel limitation warnings when backend freshness is fresh", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/health"))
        return jsonResponse({
          service: "zona-cero-api",
          ok: true,
          version: "test",
        });
      if (
        url.includes("/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull")
      )
        return jsonResponse(freshSyncPullFixture);
      if (url.endsWith("/incidents/incident-zc-demo/work-centers"))
        return jsonResponse(workCenterListHappyFixture);
      if (
        url.endsWith(
          "/incidents/incident-zc-demo/work-centers/center-north-triage",
        )
      )
        return jsonResponse(workCenterDetailHappyFixture);
      if (url.endsWith("/incidents/incident-zc-demo/resource-reports"))
        return jsonResponse(resourceReportListFixture);
      if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks"))
        return jsonResponse(dispatchTaskListFixture);
      if (url.endsWith("/incidents/incident-zc-demo/sos"))
        return jsonResponse(sosStatusFixture);
      return new Response("not found", { status: 404 });
    });

    render(<App />);

    await waitFor(() =>
      expect(screen.getByTestId("api-health")).toHaveTextContent(
        "zona-cero-api está online",
      ),
    );
    expect(
      screen.queryByText("Puede haber cambios recientes"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("La información puede estar desactualizada"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Falta una comprobación de cambios"),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(
      /offline save|offline sync|saved offline/i,
    );
  });

  it("displays stable API errors for work center loading failures", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({
          service: "zona-cero-api",
          ok: true,
          version: "test",
        });
      }
      return new Response(JSON.stringify({ error: "permission_denied" }), {
        status: 403,
      });
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Puntos de ayuda" }));
    await waitFor(() =>
      expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
        "Work center list failed with status 403",
      ),
    );
  });

  it("displays backend-derived status values without recalculating activation logic", async () => {
    const backendOnlyList = {
      workCenters: [
        {
          ...workCenterListHappyFixture.workCenters[0],
          status: "active",
          activationState: "needs_review",
          freshness: "expired",
          confidence: "high",
          risk: "low",
          signalCount: 0,
          corroboratingSignalCount: 0,
        },
      ],
    } as const;
    const backendOnlyDetail = {
      workCenter: {
        ...workCenterDetailHappyFixture.workCenter,
        ...backendOnlyList.workCenters[0],
        latestSignals: [],
      },
    } as const;

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return jsonResponse({
          service: "zona-cero-api",
          ok: true,
          version: "test",
        });
      }
      if (url.endsWith("/incidents/incident-zc-demo/work-centers")) {
        return jsonResponse(backendOnlyList);
      }
      if (url.endsWith("/incidents/incident-zc-demo/resource-reports")) {
        return jsonResponse(resourceReportListFixture);
      }
      if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks")) {
        return jsonResponse(dispatchTaskListFixture);
      }
      if (url.endsWith("/incidents/incident-zc-demo/sos")) {
        return jsonResponse(sosStatusFixture);
      }
      return jsonResponse(backendOnlyDetail);
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Puntos de ayuda" }));
    await waitFor(() =>
      expect(screen.getAllByText("Revisar antes de ir").length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText("Reportado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sin confirmar").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Baja").length).toBeGreaterThan(0);
  });

  it("requires exact SOS confirmation before calling the backend", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/health"))
          return jsonResponse({
            service: "zona-cero-api",
            ok: true,
            version: "test",
          });
        if (
          url.includes(
            "/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull",
          )
        )
          return jsonResponse(freshSyncPullFixture);
        if (url.endsWith("/incidents/incident-zc-demo/work-centers"))
          return jsonResponse(workCenterListHappyFixture);
        if (
          url.endsWith(
            "/incidents/incident-zc-demo/work-centers/center-north-triage",
          )
        )
          return jsonResponse(workCenterDetailHappyFixture);
        if (url.endsWith("/incidents/incident-zc-demo/resource-reports"))
          return jsonResponse(resourceReportListFixture);
        if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks"))
          return jsonResponse(dispatchTaskListFixture);
        if (
          url.endsWith("/incidents/incident-zc-demo/sos") &&
          init?.method === "POST"
        )
          return jsonResponse(sosCreateFixture);
        if (url.endsWith("/incidents/incident-zc-demo/sos"))
          return jsonResponse(sosStatusFixture);
        return new Response("not found", { status: 404 });
      });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "SOS cercano" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "SOS cercano" }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("Escribe CONFIRM SOS para enviar"), {
      target: { value: "confirm" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar SOS" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Escribe CONFIRM SOS exactamente",
    );
    expect(fetcher).not.toHaveBeenCalledWith(
      "http://127.0.0.1:8787/incidents/incident-zc-demo/sos",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("submits SOS and renders the backend acknowledgement honestly", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/health"))
          return jsonResponse({
            service: "zona-cero-api",
            ok: true,
            version: "test",
          });
        if (
          url.includes(
            "/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull",
          )
        )
          return jsonResponse(freshSyncPullFixture);
        if (url.endsWith("/incidents/incident-zc-demo/work-centers"))
          return jsonResponse(workCenterListHappyFixture);
        if (
          url.endsWith(
            "/incidents/incident-zc-demo/work-centers/center-north-triage",
          )
        )
          return jsonResponse(workCenterDetailHappyFixture);
        if (url.endsWith("/incidents/incident-zc-demo/resource-reports"))
          return jsonResponse(resourceReportListFixture);
        if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks"))
          return jsonResponse(dispatchTaskListFixture);
        if (
          url.endsWith("/incidents/incident-zc-demo/sos") &&
          init?.method === "POST"
        )
          return jsonResponse(sosCreateFixture);
        if (url.endsWith("/incidents/incident-zc-demo/sos"))
          return jsonResponse({
            sosAlerts: [],
            fanout: {
              total: 0,
              queued: 0,
              pending: 0,
              failed: 0,
              cancelled: 0,
            },
          });
        return new Response("not found", { status: 404 });
      });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "SOS cercano" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "SOS cercano" }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("Escribe CONFIRM SOS para enviar"), {
      target: { value: "CONFIRM SOS" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar SOS" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Aviso SOS enviado");
    expect(status).toHaveTextContent("Entrega, rescate y ubicación exacta no están confirmados");
    expect(screen.getAllByText("Aviso SOS recibido").length).toBeGreaterThan(0);

    const postCall = fetcher.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith("/incidents/incident-zc-demo/sos") &&
        init?.method === "POST",
    );
    expect(postCall).toBeDefined();
    const payload = JSON.parse(String(postCall?.[1]?.body)) as {
      externalId: string;
      displayName?: string;
      payload: { reportedAt?: string };
    };
    expect(payload.externalId).toBe("web-user-1001");
    expect(payload.displayName).toBe("Field Web");
    expect(payload.payload.reportedAt).toEqual(expect.any(String));
  });

  it("blocks duplicate SOS submits while the request is in-flight", async () => {
    let resolvePost: (response: Response) => void = () => undefined;
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/health"))
          return jsonResponse({
            service: "zona-cero-api",
            ok: true,
            version: "test",
          });
        if (
          url.includes(
            "/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull",
          )
        )
          return jsonResponse(freshSyncPullFixture);
        if (url.endsWith("/incidents/incident-zc-demo/work-centers"))
          return jsonResponse(workCenterListHappyFixture);
        if (
          url.endsWith(
            "/incidents/incident-zc-demo/work-centers/center-north-triage",
          )
        )
          return jsonResponse(workCenterDetailHappyFixture);
        if (url.endsWith("/incidents/incident-zc-demo/resource-reports"))
          return jsonResponse(resourceReportListFixture);
        if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks"))
          return jsonResponse(dispatchTaskListFixture);
        if (
          url.endsWith("/incidents/incident-zc-demo/sos") &&
          init?.method === "POST"
        ) {
          return new Promise<Response>((resolve) => {
            resolvePost = resolve;
          });
        }
        if (url.endsWith("/incidents/incident-zc-demo/sos"))
          return jsonResponse({
            sosAlerts: [],
            fanout: {
              total: 0,
              queued: 0,
              pending: 0,
              failed: 0,
              cancelled: 0,
            },
          });
        return new Response("not found", { status: 404 });
      });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "SOS cercano" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "SOS cercano" }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("Escribe CONFIRM SOS para enviar"), {
      target: { value: "CONFIRM SOS" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar SOS" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Enviando SOS…" }),
      ).toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enviando SOS…" }));

    const postCalls = fetcher.mock.calls.filter(
      ([url, init]) =>
        String(url).endsWith("/incidents/incident-zc-demo/sos") &&
        init?.method === "POST",
    );
    expect(postCalls).toHaveLength(1);

    resolvePost(jsonResponse(sosCreateFixture));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Aviso SOS enviado",
    );
  });

  it("shows SOS backend errors without inventing delivery state", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/health"))
        return jsonResponse({
          service: "zona-cero-api",
          ok: true,
          version: "test",
        });
      if (
        url.includes("/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull")
      )
        return jsonResponse(freshSyncPullFixture);
      if (url.endsWith("/incidents/incident-zc-demo/work-centers"))
        return jsonResponse(workCenterListHappyFixture);
      if (
        url.endsWith(
          "/incidents/incident-zc-demo/work-centers/center-north-triage",
        )
      )
        return jsonResponse(workCenterDetailHappyFixture);
      if (url.endsWith("/incidents/incident-zc-demo/resource-reports"))
        return jsonResponse(resourceReportListFixture);
      if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks"))
        return jsonResponse(dispatchTaskListFixture);
      if (
        url.endsWith("/incidents/incident-zc-demo/sos") &&
        init?.method === "POST"
      )
        return new Response(JSON.stringify({ error: "permission_denied" }), {
          status: 403,
        });
      if (url.endsWith("/incidents/incident-zc-demo/sos"))
        return jsonResponse(sosStatusFixture);
      return new Response("not found", { status: 404 });
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "SOS cercano" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "SOS cercano" }),
      ).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText("Escribe CONFIRM SOS para enviar"), {
      target: { value: "CONFIRM SOS" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar SOS" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "SOS creation failed with status 403",
    );
  });

  it("renders the private family reunification flow with safety limits and minimized payloads", async () => {
    window.history.pushState(
      {},
      "",
      `/family-reunification?token=${privateFamilyReunificationIssueResponseFixture.token}&correlationId=${privateFamilyReunificationIssueResponseFixture.correlationId}`,
    );
    window.sessionStorage.setItem(
      "cf-turnstile-response",
      "test-turnstile-token",
    );

    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith("/private-links/validate"))
          return jsonResponse(
            privateFamilyReunificationValidateResponseFixture,
          );
        if (
          url.endsWith("/private-links/family-reunification/search") &&
          init?.method === "POST"
        ) {
          return jsonResponse(familyReunificationSearchResponseFixture);
        }
        if (url.endsWith("/private-links/consume") && init?.method === "POST") {
          return jsonResponse(privateFamilyReunificationConsumeResponseFixture);
        }
        return new Response("not found", { status: 404 });
      });

    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Búsqueda segura de identidad y derivación presencial",
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Búsqueda privada minimizada" }),
      ).toBeInTheDocument(),
    );

    expect(
      screen.getByText("No se solicitan ni muestran fotos."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No se solicita ni muestra ubicación exacta."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No se solicita ni muestra identidad completa de menores."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/photo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/exact location/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Rango de edad aproximado"), {
      target: { value: "child" },
    });
    fireEvent.change(screen.getByLabelText("Pista de relación"), {
      target: { value: "parent looking for child" },
    });
    fireEvent.change(screen.getByLabelText("Zona amplia de último avistamiento"), {
      target: { value: "north gate area" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar de forma segura" }));

    expect(
      await screen.findByText("Posible coincidencia presencial"),
    ).toBeInTheDocument();
    expect(screen.getByText("Verificación requerida: sí")).toBeInTheDocument();

    const searchCall = fetcher.mock.calls.find(([url]) =>
      String(url).endsWith("/private-links/family-reunification/search"),
    );
    expect(searchCall).toBeDefined();
    const payload = JSON.parse(String(searchCall?.[1]?.body)) as Record<
      string,
      unknown
    > & { query: Record<string, unknown> };
    expect(payload.token).toBe(
      privateFamilyReunificationIssueResponseFixture.token,
    );
    expect(payload.correlationId).toBe(
      privateFamilyReunificationIssueResponseFixture.correlationId,
    );
    expect(payload.fingerprint).toEqual(expect.stringMatching(/^browser-/));
    expect(payload.query).toEqual({
      ageBand: "child",
      relationHint: "parent looking for child",
      lastKnownAreaLabel: "north gate area",
    });
    expect(payload.query).not.toHaveProperty("fullName");
    expect(payload.query).not.toHaveProperty("photo");
    expect(payload.query).not.toHaveProperty("exactLocation");
    expect(payload).not.toHaveProperty("turnstileToken");
    expect(searchCall?.[1]?.headers).toMatchObject({
      "cf-turnstile-response": "test-turnstile-token",
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Continuar a verificación presencial",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Continúa con verificación presencial",
      ),
    );

    const consumeCall = fetcher.mock.calls.find(([url]) =>
      String(url).endsWith("/private-links/consume"),
    );
    const consumePayload = JSON.parse(String(consumeCall?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(consumePayload).toMatchObject({
      scope: "family_reunification.search",
      correlationId:
        privateFamilyReunificationIssueResponseFixture.correlationId,
      referralReason: "family_reunification_in_person_verification",
    });
  });

  it("renders private family reunification validation and search copy in Spanish", async () => {
    window.history.pushState(
      {},
      "",
      `/family-reunification?lang=es&token=${privateFamilyReunificationIssueResponseFixture.token}&correlationId=${privateFamilyReunificationIssueResponseFixture.correlationId}`,
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/private-links/validate"))
        return jsonResponse(privateFamilyReunificationValidateResponseFixture);
      if (
        url.endsWith("/private-links/family-reunification/search") &&
        init?.method === "POST"
      ) {
        return jsonResponse(familyReunificationSearchResponseFixture);
      }
      if (url.endsWith("/private-links/consume") && init?.method === "POST") {
        return jsonResponse(privateFamilyReunificationConsumeResponseFixture);
      }
      return new Response("not found", { status: 404 });
    });

    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "Búsqueda segura de identidad y derivación presencial",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Comprobando enlace privado" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Búsqueda privada minimizada" }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText("Checking private link")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Rango de edad aproximado"), {
      target: { value: "child" },
    });
    fireEvent.change(screen.getByLabelText("Pista de relación"), {
      target: { value: "madre busca a su hijo" },
    });
    fireEvent.change(
      screen.getByLabelText("Zona amplia de último avistamiento"),
      { target: { value: "puerta norte" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Buscar de forma segura" }),
    );

    expect(
      await screen.findByText("Posible coincidencia presencial"),
    ).toBeInTheDocument();
    expect(screen.getByText("Rango de edad: Niñez")).toBeInTheDocument();
    expect(screen.getByText("Verificación requerida: sí")).toBeInTheDocument();
    expect(document.body).toHaveTextContent(
      "La mesa familiar puede comparar detalles de relación en persona.",
    );
    expect(document.body).toHaveTextContent(
      "Continúa con verificación presencial.",
    );
    expect(document.body).not.toHaveTextContent(/\bchild\b/);
    expect(document.body).not.toHaveTextContent(/\bteen\b/);
    expect(document.body).not.toHaveTextContent(/\badult\b/);
    expect(document.body).not.toHaveTextContent(/\bolder_adult\b/);
    expect(document.body).not.toHaveTextContent(
      "family desk can compare details in person",
    );
    expect(document.body).not.toHaveTextContent(
      "Visit the family reunification desk for identity-safe verification.",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Continuar a verificación presencial",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Continúa con verificación presencial",
      ),
    );
    expect(document.body).not.toHaveTextContent(
      "Continue with in-person verification. Do not share photos, exact location, or full minor identity in chat.",
    );
  });

  it("renders private family reunification validation errors in Spanish", async () => {
    window.history.pushState(
      {},
      "",
      `/family-reunification?lang=es&token=${privateFamilyReunificationIssueResponseFixture.token}&correlationId=${privateFamilyReunificationIssueResponseFixture.correlationId}`,
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/private-links/validate")) {
        return new Response(JSON.stringify({ error: "link_expired" }), {
          status: 410,
        });
      }
      return new Response("not found", { status: 404 });
    });

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El enlace privado expiró",
    );
    expect(
      screen.getByText(/Ve al punto de reunificación familiar/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Private link unavailable"),
    ).not.toBeInTheDocument();
  });

  it("shows safe visible errors for invalid or expired private links", async () => {
    window.history.pushState(
      {},
      "",
      `/family-reunification?token=${privateFamilyReunificationIssueResponseFixture.token}&correlationId=${privateFamilyReunificationIssueResponseFixture.correlationId}`,
    );
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/private-links/validate")) {
        return new Response(JSON.stringify({ error: "link_expired" }), {
          status: 410,
        });
      }
      return new Response("not found", { status: 404 });
    });

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El enlace privado expiró",
    );
    expect(
      screen.getByText(/Ve al punto de reunificación familiar/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function mockOperationsShellFetch() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/health"))
      return jsonResponse({
        service: "zona-cero-api",
        ok: true,
        version: "test",
      });
    if (
      url.includes("/incidents/incident-zc-demo/cells/cell-zc-demo/sync/pull")
    )
      return jsonResponse(freshSyncPullFixture);
    if (url.endsWith("/incidents/incident-zc-demo/work-centers"))
      return jsonResponse({ workCenters: [] });
    if (url.endsWith("/incidents/incident-zc-demo/resource-reports"))
      return jsonResponse({ resourceReports: [] });
    if (url.endsWith("/incidents/incident-zc-demo/dispatch-tasks"))
      return jsonResponse({ dispatchTasks: [] });
    if (url.endsWith("/incidents/incident-zc-demo/sos")) {
      return jsonResponse({
        sosAlerts: [],
        fanout: { total: 0, queued: 0, pending: 0, failed: 0, cancelled: 0 },
      });
    }
    return new Response("not found", { status: 404 });
  });
}

describe("web ui telemetry and turnstile forwarding", () => {
  it("keeps web telemetry sanitized and non-blocking", async () => {
    const { createWebTelemetryEvent, emitChannelTelemetry } =
      await import("./telemetry");
    const emit = vi.fn().mockRejectedValue(new Error("sink down"));

    expect(() => {
      emitChannelTelemetry(
        { emit },
        createWebTelemetryEvent({
          action: "private_link.rejected",
          result: "rejected",
          errorCode: "rate_limited",
        }),
      );
    }).not.toThrow();
    await Promise.resolve();

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "private_link.attempted",
        channel: "web-ui",
        scope: "web.private_link",
        action: "private_link.rejected",
        errorCode: "rate_limited",
      }),
    );
    expect(JSON.stringify(emit.mock.calls)).not.toContain("token");
    expect(JSON.stringify(emit.mock.calls)).not.toContain("fingerprint");
    expect(JSON.stringify(emit.mock.calls)).not.toContain("relationHint");
  });

  it("forwards Turnstile header only when a token is provided", async () => {
    const { createTurnstileHeaders } = await import("./api");

    expect(createTurnstileHeaders()).toEqual({});
    expect(createTurnstileHeaders({ turnstileToken: "  token-123  " })).toEqual(
      {
        "cf-turnstile-response": "token-123",
      },
    );
  });
});

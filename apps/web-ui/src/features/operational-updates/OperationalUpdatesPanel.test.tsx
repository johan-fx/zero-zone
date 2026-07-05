import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OperationalUpdatesPanel } from "./OperationalUpdatesPanel";

const updateFixture = {
  updateId: "upd-sos-1",
  incidentId: "incident-zc-demo",
  cellId: "cell-zc-demo",
  type: "sos_alert",
  urgency: "critical",
  title: "Critical SOS nearby",
  summary: "A critical SOS was reported near this cell.",
  body: "Confirm only if you have safe context.",
  source: { kind: "sos_alert", entityId: "sos-public-1" },
  subject: {
    entityType: "sos_alert",
    entityId: "sos-public-1",
    incidentId: "incident-zc-demo",
    displayRef: "SOS public ref",
  },
  actions: [
    { type: "ack", label: "Acknowledge" },
    { type: "corroborate", label: "Corroborate" },
    { type: "link", label: "Open detail" },
  ],
  delivery: { channel: "web-ui", status: "pending", attemptCount: 0 },
  createdAt: "2026-07-05T12:00:00.000Z",
  updatedAt: "2026-07-05T12:00:00.000Z",
  metadata: { confidence: 0.78 },
} as const;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("OperationalUpdatesPanel", () => {
  it("lists proactive updates with honest authority limits and acknowledges safely", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/incidents/incident-zc-demo/cells/cell-zc-demo/updates?limit=10&channel=web-ui&externalId=web-user-1001")) {
        return jsonResponse({ updates: [updateFixture], cursor: null, hasMore: false });
      }
      if (url.endsWith("/incidents/incident-zc-demo/updates/upd-sos-1/ack")) {
        return jsonResponse({
          update: { ...updateFixture, delivery: { channel: "web-ui", status: "acked", attemptCount: 1 } },
          action: {
            actionId: "act-1",
            updateId: "upd-sos-1",
            actionType: "ack",
            status: "accepted",
            idempotent: false,
            createdAt: "2026-07-05T12:01:00.000Z",
          },
        });
      }
      return new Response("not found", { status: 404 });
    });

    render(
      <OperationalUpdatesPanel
        incidentId="incident-zc-demo"
        cellId="cell-zc-demo"
        externalId="web-user-1001"
        displayName="Field Web"
      />,
    );

    expect(screen.getByText("Loading operational updates…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Critical SOS nearby" })).toBeInTheDocument();
    expect(screen.getByText(/Acknowledgement is not a rescue request/i)).toBeInTheDocument();
    expect(screen.getByText(/corroboration does not grant authority/i)).toBeInTheDocument();
    expect(screen.getByText(/social trust never grants sensitive permissions/i)).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getByText(/Use for awareness and coordination only/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Acknowledge awareness" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Acknowledged for awareness. This is not a rescue request.");
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8787/incidents/incident-zc-demo/updates/upd-sos-1/ack",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"channel":"web-ui"'),
      }),
    );
    await waitFor(() => expect(screen.getByText(/acked, updated/i)).toBeInTheDocument());
  });

  it("creates safe detail links instead of exposing raw source identifiers", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/incidents/incident-zc-demo/cells/cell-zc-demo/updates?limit=10&channel=web-ui&externalId=web-user-1001")) {
        return jsonResponse({ updates: [updateFixture], cursor: null, hasMore: false });
      }
      if (url.endsWith("/incidents/incident-zc-demo/updates/upd-sos-1/links")) {
        return jsonResponse({
          update: updateFixture,
          action: {
            actionId: "act-2",
            updateId: "upd-sos-1",
            actionType: "link",
            status: "accepted",
            idempotent: false,
            createdAt: "2026-07-05T12:02:00.000Z",
          },
          link: {
            href: "/operational-updates/private-detail#token=opaque&scope=operational_update.detail&correlationId=corr-update",
            scope: "operational_update.detail",
            expiresAt: "2026-07-05T12:17:00.000Z",
          },
        });
      }
      return new Response("not found", { status: 404 });
    });

    render(<OperationalUpdatesPanel incidentId="incident-zc-demo" cellId="cell-zc-demo" externalId="web-user-1001" />);

    fireEvent.click(await screen.findByRole("button", { name: "Get safe detail link" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Safe detail link created.");
    expect(screen.getByRole("link", { name: "Open safe detail" })).toHaveAttribute(
      "href",
      "/operational-updates/private-detail#token=opaque&scope=operational_update.detail&correlationId=corr-update",
    );
    expect(screen.queryByText("web-user-1001")).not.toBeInTheDocument();
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

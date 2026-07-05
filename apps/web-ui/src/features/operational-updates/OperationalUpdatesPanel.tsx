import { useEffect, useMemo, useState } from "react";

import type { OperationalUpdate, OperationalUpdateActionType } from "@zona-cero/contracts";
import { StatusBadge } from "@zona-cero/ui/web";
import {
  acknowledgeOperationalUpdate,
  corroborateOperationalUpdate,
  createOperationalUpdateLink,
  disputeOperationalUpdate,
  fetchOperationalUpdates,
  openOperationalUpdate,
  readOperationalUpdate,
} from "../../api";

type UpdatesState =
  | { status: "loading" }
  | { status: "ready"; updates: OperationalUpdate[]; cursor: string | null; hasMore: boolean }
  | { status: "error"; message: string };

type ActionState = {
  updateId: string;
  status: "loading" | "success" | "error";
  message: string;
  detailHref?: string;
} | null;

export function OperationalUpdatesPanel({
  incidentId,
  cellId,
  externalId,
  displayName,
}: {
  incidentId: string;
  cellId: string;
  externalId: string;
  displayName?: string;
}) {
  const [updatesState, setUpdatesState] = useState<UpdatesState>({ status: "loading" });
  const [actionState, setActionState] = useState<ActionState>(null);
  const identity = useMemo(
    () => ({
      channel: "web-ui" as const,
      externalId,
      ...(displayName ? { displayName } : {}),
    }),
    [displayName, externalId],
  );

  useEffect(() => {
    let active = true;
    setUpdatesState({ status: "loading" });

    fetchOperationalUpdates(incidentId, cellId, { limit: 10, channel: identity.channel, externalId: identity.externalId })
      .then((response) => {
        if (active) {
          setUpdatesState({
            status: "ready",
            updates: response.updates,
            cursor: response.cursor,
            hasMore: response.hasMore,
          });
        }
      })
      .catch((error: unknown) => {
        if (active) setUpdatesState({ status: "error", message: errorMessage(error) });
      });

    return () => {
      active = false;
    };
  }, [cellId, identity.channel, identity.externalId, incidentId]);

  async function handleAction(update: OperationalUpdate, action: OperationalUpdateActionType) {
    setActionState({ updateId: update.updateId, status: "loading", message: `Sending ${action}…` });
    try {
      const idempotencyKey = `web-ui:${action}:${update.updateId}`;
      const baseRequest = { ...identity, idempotencyKey, occurredAt: new Date().toISOString() };
      const response =
        action === "ack"
          ? await acknowledgeOperationalUpdate(incidentId, update.updateId, baseRequest)
          : action === "read"
            ? await readOperationalUpdate(incidentId, update.updateId, baseRequest)
            : action === "open"
              ? await openOperationalUpdate(incidentId, update.updateId, baseRequest)
              : action === "corroborate"
                ? await corroborateOperationalUpdate(incidentId, update.updateId, {
                    ...baseRequest,
                    confidence: 0.7,
                    note: "Web operator saw matching context; this does not grant authority.",
                  })
                : action === "dispute"
                  ? await disputeOperationalUpdate(incidentId, update.updateId, {
                      ...baseRequest,
                      reason: "context_mismatch",
                      note: "Web operator flagged this for review before action.",
                    })
                  : await createOperationalUpdateLink(incidentId, update.updateId, {
                      ...baseRequest,
                      returnState: `web-ui:update:${update.updateId}`,
                    });

      setUpdatesState((previous) =>
        previous.status === "ready"
          ? {
              ...previous,
              updates: previous.updates.map((candidate) =>
                candidate.updateId === response.update.updateId ? response.update : candidate,
              ),
            }
          : previous,
      );
      setActionState({
        updateId: update.updateId,
        status: "success",
        message: actionMessage(action),
        detailHref: readDetailHref(response),
      });
    } catch (error: unknown) {
      setActionState({ updateId: update.updateId, status: "error", message: errorMessage(error) });
    }
  }

  return (
    <section className="operational-updates" aria-labelledby="operational-updates-title" aria-live="polite">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Operational inbox</p>
          <h2 id="operational-updates-title">Proactive updates</h2>
        </div>
        {updatesState.status === "ready" ? <StatusBadge tone="info" label={`${updatesState.updates.length} updates`} /> : null}
      </div>
      <p className="summary">
        Short field updates for this cell. Acknowledgement is not a rescue request, corroboration does not grant authority,
        and social trust never grants sensitive permissions.
      </p>

      {updatesState.status === "loading" ? <p>Loading operational updates…</p> : null}
      {updatesState.status === "error" ? <p role="alert">{updatesState.message}</p> : null}
      {updatesState.status === "ready" && updatesState.updates.length === 0 ? <p role="status">No proactive updates for this cell yet.</p> : null}
      {updatesState.status === "ready" && updatesState.updates.length > 0 ? (
        <ul className="operational-update-list">
          {updatesState.updates.map((update) => (
            <li key={update.updateId} className="operational-update-card">
              <div className="card-title-row">
                <div>
                  <h3>{update.title}</h3>
                  <p>{update.summary}</p>
                </div>
                <StatusBadge tone={urgencyTone(update.urgency)} label={update.urgency} />
              </div>
              {update.body ? <p className="summary">{update.body}</p> : null}
              <dl>
                <dt>Reason</dt>
                <dd>{describeType(update.type)}</dd>
                <dt>Confidence</dt>
                <dd>{formatMetadata(update.metadata?.confidence) ?? update.subject?.displayRef ?? "Context pending"}</dd>
                <dt>Freshness</dt>
                <dd>{formatFreshness(update)}</dd>
                <dt>Authority</dt>
                <dd>Use for awareness and coordination only; it does not unlock restricted incident data.</dd>
                {describeReasonCode(update.reasonCode) ? (
                  <>
                    <dt>Why you're seeing this</dt>
                    <dd>
                      <span className="reason-code-badge">{describeReasonCode(update.reasonCode)}</span>
                    </dd>
                  </>
                ) : null}
              </dl>
              <div className="action-row">
                {update.actions.map((action) => (
                  <button key={action.type} type="button" onClick={() => void handleAction(update, action.type)}>
                    {safeActionLabel(action.type, action.label)}
                  </button>
                ))}
              </div>
              {actionState?.updateId === update.updateId ? (
                <p role={actionState.status === "error" ? "alert" : "status"}>
                  {actionState.message}
                  {actionState.detailHref ? (
                    <>
                      {" "}
                      <a href={actionState.detailHref}>Open safe detail</a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function urgencyTone(urgency: OperationalUpdate["urgency"]) {
  if (urgency === "critical") return "sos";
  if (urgency === "high") return "risk";
  if (urgency === "medium") return "warning";
  return "info";
}

function describeType(type: OperationalUpdate["type"]): string {
  return type.replaceAll("_", " ");
}

// Honest, non-authoritative explanation of why this targeted update reached the operator.
// A possible match is never a reservation, assignment, or authority. A missing reasonCode
// hides the row and never breaks rendering.
function describeReasonCode(reasonCode: OperationalUpdate["reasonCode"]): string | null {
  if (!reasonCode) return null;
  if (reasonCode === "resource.match.offer_for_open_need") {
    return "You're seeing this because it matches a resource you requested. Possible match, not a reservation; coordinate before you move.";
  }
  if (reasonCode === "resource.match.need_for_open_offer") {
    return "You're seeing this because it matches a resource you offered. Possible match, not an official assignment.";
  }
  if (reasonCode === "resource.report.cell_broadcast") {
    return "General update for your cell.";
  }
  return null;
}

function formatFreshness(update: OperationalUpdate): string {
  const status = update.delivery?.status ? `${update.delivery.status}, ` : "";
  return `${status}updated ${new Date(update.updatedAt).toLocaleString()}`;
}

function formatMetadata(value: unknown): string | null {
  if (typeof value === "number") return `${Math.round(value * 100)}%`;
  if (typeof value === "string") return value;
  return null;
}

function safeActionLabel(type: OperationalUpdateActionType, label: string): string {
  if (type === "ack") return "Acknowledge awareness";
  if (type === "corroborate") return "Corroborate context";
  if (type === "dispute") return "Dispute context";
  if (type === "open") return "Mark opened";
  if (type === "link") return "Get safe detail link";
  return label;
}

function actionMessage(type: OperationalUpdateActionType): string {
  if (type === "ack") return "Acknowledged for awareness. This is not a rescue request.";
  if (type === "corroborate") return "Corroboration sent. This does not grant authority.";
  if (type === "dispute") return "Dispute sent for human review before action.";
  if (type === "link") return "Safe detail link created.";
  return "Update action recorded.";
}

function readDetailHref(response: unknown): string | undefined {
  if (!response || typeof response !== "object" || !("link" in response)) return undefined;
  const link = (response as { link?: { href?: unknown } }).link;
  return typeof link?.href === "string" ? link.href : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown operational update error";
}

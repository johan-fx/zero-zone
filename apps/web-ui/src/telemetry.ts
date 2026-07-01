import {
  OperationalEventSchema,
  type OperationalEvent,
} from "@zona-cero/contracts";

export type ChannelTelemetryPort = {
  emit(event: OperationalEvent): void | Promise<void>;
};

export type WebTelemetryAction =
  | "app.loaded"
  | "health.loaded"
  | "health.failed"
  | "freshness.loaded"
  | "freshness.failed"
  | "work_centers.loaded"
  | "work_centers.failed"
  | "resources.loaded"
  | "resources.failed"
  | "dispatch.loaded"
  | "dispatch.failed"
  | "dispatch.completed"
  | "dispatch.rejected"
  | "sos.started"
  | "sos.completed"
  | "sos.rejected"
  | "private_link.started"
  | "private_link.completed"
  | "private_link.rejected"
  | "private_link.rate_limited"
  | "private_link.security_challenge"
  | "private_link.expired"
  | "turnstile.forwarded"
  | "turnstile.missing";

export function createWebTelemetryEvent(input: {
  action: WebTelemetryAction;
  result: OperationalEvent["result"];
  scope?: string;
  errorCode?: OperationalEvent["errorCode"];
  latencyMs?: number;
}): OperationalEvent {
  const isPrivateLink =
    input.action.startsWith("private_link.") ||
    input.action.startsWith("turnstile.");
  return OperationalEventSchema.parse({
    event: input.action.startsWith("turnstile.")
      ? "turnstile.checked"
      : isPrivateLink
        ? "private_link.attempted"
        : "operation.processed",
    category:
      input.action.startsWith("turnstile.") || isPrivateLink
        ? "security"
        : "sync",
    result: input.result,
    channel: "web-ui",
    scope:
      input.scope ?? (isPrivateLink ? "web.private_link" : "web.operations"),
    action: input.action,
    errorCode: input.errorCode ?? null,
    ...(input.latencyMs === undefined ? {} : { latencyMs: input.latencyMs }),
    sampled: true,
  });
}

export function emitChannelTelemetry(
  telemetry: ChannelTelemetryPort | undefined,
  event: OperationalEvent,
): void {
  if (!telemetry) return;
  const parsed = OperationalEventSchema.parse(event);
  void Promise.resolve()
    .then(() => telemetry.emit(parsed))
    .catch(() => undefined);
}

export function createLocalTelemetrySink(): ChannelTelemetryPort & {
  readonly events: OperationalEvent[];
} {
  const events: OperationalEvent[] = [];
  return {
    get events() {
      return events;
    },
    emit(event) {
      events.push(OperationalEventSchema.parse(event));
    },
  };
}

export const webTelemetry = createLocalTelemetrySink();

export function classifyWebError(
  error: unknown,
): Pick<OperationalEvent, "result" | "errorCode"> {
  const message = error instanceof Error ? error.message : String(error);
  if (/rate_limited/i.test(message))
    return { result: "rejected", errorCode: "rate_limited" };
  if (/security_challenge_required/i.test(message))
    return { result: "rejected", errorCode: "security_challenge_required" };
  if (/turnstile_failed/i.test(message))
    return { result: "rejected", errorCode: "turnstile_failed" };
  if (/link_expired/i.test(message))
    return { result: "rejected", errorCode: "link_expired" };
  if (
    /permission_denied|invalid_link_scope|link_correlation_mismatch/i.test(
      message,
    )
  )
    return { result: "rejected", errorCode: "permission_denied" };
  return { result: "rejected", errorCode: null };
}

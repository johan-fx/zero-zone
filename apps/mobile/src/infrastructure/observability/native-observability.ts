import { OperationalEventSchema, contractErrorCodes, type ContractErrorCode, type OperationalEvent } from '@zona-cero/contracts';

export type NativeObservabilityComponent = 'sync' | 'map_pack' | 'outbox' | 'battery' | 'field_failure';
export type NativeMetricName = 'sync.completed' | 'sync.failed' | 'map_pack.lifecycle' | 'outbox.snapshot' | 'battery.snapshot' | 'field_failure.recorded';
export type NativeFailureKind = 'none' | 'network' | 'rate_limit' | 'security_challenge' | 'turnstile' | 'conflict' | 'validation' | 'storage' | 'unknown';
export type ProgressBucket = 0 | 25 | 50 | 75 | 100;
export type BytesBucket = '0' | '<1mb' | '1-10mb' | '10-50mb' | '50-100mb' | '100mb+';
export type CountBucket = '0' | '1' | '2-5' | '6-10' | '11-50' | '50+';
export type BatteryBucket = 'unknown' | 'critical' | 'low' | 'medium' | 'high' | 'full';

export type NativeOperationalEvent = OperationalEvent & {
  channel: 'mobile';
  component: NativeObservabilityComponent;
  metric: NativeMetricName;
  durationMs?: number;
  pushed?: number;
  pulled?: number;
  confirmed?: number;
  conflicts?: number;
  rejected?: number;
  retried?: number;
  pendingOutboxBucket?: CountBucket;
  failedOutboxBucket?: CountBucket;
  mapPackState?: 'queued' | 'downloading' | 'downloaded' | 'partial' | 'failed' | 'update_recommended';
  progressBucket?: ProgressBucket;
  estimatedBytesBucket?: BytesBucket;
  downloadedBytesBucket?: BytesBucket;
  batteryBucket?: BatteryBucket;
  charging?: boolean;
  failureKind?: NativeFailureKind;
};

export type NativeObservabilitySink = {
  record(event: NativeOperationalEvent): void | Promise<void>;
};

export const noopNativeObservabilitySink: NativeObservabilitySink = {
  record: () => undefined,
};

export function emitNativeOperationalEvent(sink: NativeObservabilitySink | undefined, event: NativeOperationalEvent): void {
  const target = sink ?? noopNativeObservabilitySink;

  try {
    const result = target.record(sanitizeNativeOperationalEvent(event));

    if (result && typeof result === 'object' && 'catch' in result && typeof result.catch === 'function') {
      result.catch(() => undefined);
    }
  } catch {
    // Observability is best-effort and must never block operational flows.
  }
}

export function sanitizeNativeOperationalEvent(event: NativeOperationalEvent): NativeOperationalEvent {
  const base = OperationalEventSchema.parse({
    event: event.event,
    category: event.category,
    result: event.result,
    channel: 'mobile',
    scope: sanitizeScope(event.scope),
    action: sanitizeAction(event.action),
    opType: event.opType,
    errorCode: sanitizeContractErrorCode(event.errorCode),
    latencyMs: sanitizeNonNegativeInteger(event.latencyMs),
    sampled: event.sampled,
  });

  return {
    ...base,
    channel: 'mobile',
    component: event.component,
    metric: event.metric,
    durationMs: sanitizeNonNegativeInteger(event.durationMs),
    pushed: sanitizeCount(event.pushed),
    pulled: sanitizeCount(event.pulled),
    confirmed: sanitizeCount(event.confirmed),
    conflicts: sanitizeCount(event.conflicts),
    rejected: sanitizeCount(event.rejected),
    retried: sanitizeCount(event.retried),
    pendingOutboxBucket: event.pendingOutboxBucket,
    failedOutboxBucket: event.failedOutboxBucket,
    mapPackState: event.mapPackState,
    progressBucket: event.progressBucket,
    estimatedBytesBucket: event.estimatedBytesBucket,
    downloadedBytesBucket: event.downloadedBytesBucket,
    batteryBucket: event.batteryBucket,
    charging: event.charging,
    failureKind: event.failureKind ?? 'none',
  };
}

export function createSyncObservabilityEvent(input: {
  result: 'accepted' | 'rejected';
  durationMs: number;
  pushed: number;
  pulled: number;
  confirmed: number;
  conflicts: number;
  rejected: number;
  retried?: number;
  error?: unknown;
  errorCode?: string | null;
}): NativeOperationalEvent {
  const failureKind = input.result === 'accepted' ? 'none' : classifyFailure(input.errorCode ?? input.error);

  return {
    event: 'operation.processed',
    category: 'sync',
    result: input.result,
    channel: 'mobile',
    scope: 'mobile.sync',
    action: input.result === 'accepted' ? 'sync.completed' : 'sync.failed',
    errorCode: input.result === 'accepted' ? null : sanitizeContractErrorCode(input.errorCode),
    latencyMs: sanitizeNonNegativeInteger(input.durationMs),
    sampled: true,
    component: 'sync',
    metric: input.result === 'accepted' ? 'sync.completed' : 'sync.failed',
    durationMs: sanitizeNonNegativeInteger(input.durationMs),
    pushed: sanitizeCount(input.pushed),
    pulled: sanitizeCount(input.pulled),
    confirmed: sanitizeCount(input.confirmed),
    conflicts: sanitizeCount(input.conflicts),
    rejected: sanitizeCount(input.rejected),
    retried: sanitizeCount(input.retried),
    failureKind,
  };
}

export function createMapPackLifecycleEvent(input: {
  state: NativeOperationalEvent['mapPackState'];
  progress: number;
  estimatedBytes: number;
  downloadedBytes: number;
  error?: unknown;
  errorCode?: string | null;
}): NativeOperationalEvent {
  const failed = input.state === 'failed' || input.state === 'partial';

  return {
    event: 'operation.processed',
    category: 'sync',
    result: failed ? 'rejected' : 'accepted',
    channel: 'mobile',
    scope: 'mobile.map_pack',
    action: `map_pack.${input.state}`,
    errorCode: failed ? sanitizeContractErrorCode(input.errorCode) : null,
    sampled: true,
    component: 'map_pack',
    metric: 'map_pack.lifecycle',
    mapPackState: input.state,
    progressBucket: bucketProgress(input.progress),
    estimatedBytesBucket: bucketBytes(input.estimatedBytes),
    downloadedBytesBucket: bucketBytes(input.downloadedBytes),
    failureKind: failed ? classifyFailure(input.errorCode ?? input.error) : 'none',
  };
}

export function createOutboxSnapshotEvent(input: { pending: number; failed: number }): NativeOperationalEvent {
  return {
    event: 'operation.processed',
    category: 'sync',
    result: 'accepted',
    channel: 'mobile',
    scope: 'mobile.outbox',
    action: 'outbox.snapshot',
    sampled: true,
    component: 'outbox',
    metric: 'outbox.snapshot',
    pendingOutboxBucket: bucketCount(input.pending),
    failedOutboxBucket: bucketCount(input.failed),
    failureKind: 'none',
  };
}

export function createBatterySnapshotEvent(input: { batteryLevel?: number | null; charging?: boolean }): NativeOperationalEvent {
  return {
    event: 'operational.audit.recorded',
    category: 'audit',
    result: 'accepted',
    channel: 'mobile',
    scope: 'mobile.battery',
    action: 'battery.snapshot',
    sampled: true,
    component: 'battery',
    metric: 'battery.snapshot',
    batteryBucket: bucketBattery(input.batteryLevel),
    charging: input.charging,
    failureKind: 'none',
  };
}

export function bucketProgress(progress: number): ProgressBucket {
  if (!Number.isFinite(progress) || progress <= 0) return 0;
  if (progress >= 1) return 100;
  if (progress <= 0.25) return 25;
  if (progress <= 0.5) return 50;
  if (progress <= 0.75) return 75;
  return 100;
}

export function bucketBytes(bytes: number): BytesBucket {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0';
  const mb = bytes / 1_000_000;
  if (mb < 1) return '<1mb';
  if (mb < 10) return '1-10mb';
  if (mb < 50) return '10-50mb';
  if (mb < 100) return '50-100mb';
  return '100mb+';
}

export function bucketCount(count: number): CountBucket {
  if (!Number.isFinite(count) || count <= 0) return '0';
  if (count === 1) return '1';
  if (count <= 5) return '2-5';
  if (count <= 10) return '6-10';
  if (count <= 50) return '11-50';
  return '50+';
}

export function bucketBattery(level: number | null | undefined): BatteryBucket {
  if (level == null || !Number.isFinite(level)) return 'unknown';
  if (level <= 0.1) return 'critical';
  if (level <= 0.25) return 'low';
  if (level <= 0.5) return 'medium';
  if (level < 0.95) return 'high';
  return 'full';
}

export function classifyFailure(error: unknown): NativeFailureKind {
  const code = typeof error === 'string' ? error : error instanceof Error ? error.name : null;

  if (code === 'rate_limited') return 'rate_limit';
  if (code === 'security_challenge_required') return 'security_challenge';
  if (code === 'turnstile_failed') return 'turnstile';
  if (code === 'operation_conflict') return 'conflict';
  if (code === 'invalid_payload' || code === 'invalid_operation_version' || code === 'unsupported_operation_type') return 'validation';
  if (code === 'QuotaExceededError' || code === 'storage_full') return 'storage';
  if (code === 'network_error' || code === 'TypeError') return 'network';

  return 'unknown';
}

function sanitizeContractErrorCode(code: unknown): ContractErrorCode | null {
  return typeof code === 'string' && (contractErrorCodes as readonly string[]).includes(code) ? (code as ContractErrorCode) : null;
}

function sanitizeScope(scope: unknown): string | undefined {
  return typeof scope === 'string' && isSafeLabel(scope) ? scope.slice(0, 128) : undefined;
}

function sanitizeAction(action: unknown): string | undefined {
  return typeof action === 'string' && isSafeLabel(action) ? action.slice(0, 128) : undefined;
}

function isSafeLabel(value: string): boolean {
  return /^[a-z0-9._:-]+$/i.test(value);
}

function sanitizeCount(count: number | undefined): number | undefined {
  return sanitizeNonNegativeInteger(count);
}

function sanitizeNonNegativeInteger(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value));
}

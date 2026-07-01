/// <reference types="jest" />

import {
  bucketBattery,
  bucketBytes,
  bucketCount,
  bucketProgress,
  createBatterySnapshotEvent,
  createMapPackLifecycleEvent,
  createOutboxSnapshotEvent,
  createSyncObservabilityEvent,
  emitNativeOperationalEvent,
  sanitizeNativeOperationalEvent,
  type NativeOperationalEvent,
} from './native-observability';

describe('native observability sanitization', () => {
  it('keeps only aggregate non-PII sync metrics and sanitized error codes', () => {
    const event = createSyncObservabilityEvent({
      result: 'rejected',
      durationMs: 12.4,
      pushed: 2,
      pulled: 0,
      confirmed: 1,
      conflicts: 0,
      rejected: 1,
      retried: 2,
      errorCode: 'rate_limited',
      error: new Error('raw location 41.387,2.168 secret token'),
    });

    expect(event).toEqual(
      expect.objectContaining({
        event: 'operation.processed',
        category: 'sync',
        result: 'rejected',
        channel: 'mobile',
        scope: 'mobile.sync',
        action: 'sync.failed',
        errorCode: 'rate_limited',
        failureKind: 'rate_limit',
        durationMs: 12,
        pushed: 2,
        retried: 2,
      }),
    );
    expect(JSON.stringify(event)).not.toContain('raw location');
    expect(JSON.stringify(event)).not.toContain('secret token');
  });

  it('drops raw labels and unsupported error strings during sanitization', () => {
    const event = sanitizeNativeOperationalEvent({
      event: 'operation.processed',
      category: 'sync',
      result: 'rejected',
      channel: 'mobile',
      scope: 'incident-1/cell-a/private name',
      action: 'sync.failed',
      errorCode: 'network down near 41.387,2.168' as never,
      sampled: true,
      component: 'sync',
      metric: 'sync.failed',
      failureKind: 'network',
    });

    expect(event.scope).toBeUndefined();
    expect(event.errorCode).toBeNull();
    expect(JSON.stringify(event)).not.toContain('41.387');
  });

  it('bucketizes map progress, bytes, outbox, and battery snapshots', () => {
    expect(bucketProgress(0.51)).toBe(75);
    expect(bucketBytes(42_000_000)).toBe('10-50mb');
    expect(bucketCount(11)).toBe('11-50');
    expect(bucketBattery(0.2)).toBe('low');

    expect(createMapPackLifecycleEvent({ state: 'downloading', progress: 0.52, estimatedBytes: 42_000_000, downloadedBytes: 21_000_000 })).toEqual(
      expect.objectContaining({ mapPackState: 'downloading', progressBucket: 75, estimatedBytesBucket: '10-50mb', downloadedBytesBucket: '10-50mb' }),
    );
    expect(createOutboxSnapshotEvent({ pending: 7, failed: 0 })).toEqual(expect.objectContaining({ pendingOutboxBucket: '6-10', failedOutboxBucket: '0' }));
    expect(createBatterySnapshotEvent({ batteryLevel: 0.98, charging: true })).toEqual(expect.objectContaining({ batteryBucket: 'full', charging: true }));
  });

  it('never lets sync or map flows depend on sink availability', () => {
    const event: NativeOperationalEvent = createSyncObservabilityEvent({ result: 'accepted', durationMs: 1, pushed: 0, pulled: 0, confirmed: 0, conflicts: 0, rejected: 0 });

    expect(() => emitNativeOperationalEvent({ record: () => { throw new Error('sink unavailable'); } }, event)).not.toThrow();
    expect(() => emitNativeOperationalEvent({ record: () => Promise.reject(new Error('sink unavailable')) }, event)).not.toThrow();
  });
});

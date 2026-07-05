import type {
  DispatchTaskStatus,
  ResourceReportUrgency,
  SosAlertStatus,
  SosFanoutJobStatus,
  SyncFreshnessStatus,
  TrustStatus,
  TrustVisibility,
  WorkCenterActivationState,
  WorkCenterConfidence,
  WorkCenterFreshness,
  WorkCenterRisk,
  WorkCenterStatus,
} from '@zona-cero/contracts';
import type { StatusTone } from '@zona-cero/ui';

// Central place mapping backend enums to the shared StatusTone palette, so
// "critical" or "stale" always reads the same color/marker everywhere in
// the web UI instead of each section inventing its own color logic.

export function freshnessTone(freshness: SyncFreshnessStatus | WorkCenterFreshness): StatusTone {
  switch (freshness) {
    case 'fresh':
      return 'success';
    case 'stale':
      return 'stale';
    case 'expired':
      return 'conflict';
    case 'missing':
      return 'pending';
    default:
      return 'info';
  }
}

export function riskTone(risk: WorkCenterRisk): StatusTone {
  switch (risk) {
    case 'low':
      return 'success';
    case 'medium':
      return 'warning';
    case 'high':
      return 'risk';
    default:
      return 'info';
  }
}

export function confidenceTone(confidence: WorkCenterConfidence): StatusTone {
  switch (confidence) {
    case 'high':
      return 'success';
    case 'medium':
      return 'info';
    case 'low':
      return 'warning';
    default:
      return 'info';
  }
}

export function activationStateTone(activationState: WorkCenterActivationState): StatusTone {
  switch (activationState) {
    case 'active':
      return 'success';
    case 'pending_corroboration':
      return 'pending';
    case 'needs_review':
      return 'warning';
    default:
      return 'info';
  }
}

export function workCenterStatusTone(status: WorkCenterStatus): StatusTone {
  switch (status) {
    case 'active':
      return 'success';
    case 'reported':
      return 'pending';
    case 'inactive':
      return 'stale';
    case 'archived':
      return 'info';
    default:
      return 'info';
  }
}

export function urgencyTone(urgency: ResourceReportUrgency): StatusTone {
  switch (urgency) {
    case 'low':
      return 'success';
    case 'medium':
      return 'warning';
    case 'high':
      return 'risk';
    case 'critical':
      return 'sos';
    default:
      return 'info';
  }
}

export function trustStatusTone(status: TrustStatus): StatusTone {
  switch (status) {
    case 'field_attested':
    case 'trusted_by_context':
      return 'success';
    case 'pending_corroboration':
    case 'self_declared':
      return 'pending';
    case 'degraded':
      return 'warning';
    case 'disputed':
      return 'conflict';
    default:
      return 'info';
  }
}

export function trustVisibilityTone(visibility: TrustVisibility): StatusTone {
  switch (visibility) {
    case 'normal':
      return 'success';
    case 'elevated':
      return 'warning';
    case 'limited':
      return 'risk';
    case 'blocked':
      return 'conflict';
    default:
      return 'info';
  }
}

export function dispatchStatusTone(status: DispatchTaskStatus): StatusTone {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'accepted':
      return 'info';
    case 'en_route':
      return 'warning';
    case 'delivered':
      return 'success';
    case 'cancelled':
      return 'conflict';
    default:
      return 'info';
  }
}

export function sosAlertStatusTone(status: SosAlertStatus): StatusTone {
  return status === 'open' ? 'sos' : 'stale';
}

export function sosFanoutStatTone(stat: 'total' | SosFanoutJobStatus): StatusTone {
  switch (stat) {
    case 'total':
      return 'info';
    case 'queued':
      return 'pending';
    case 'pending':
      return 'warning';
    case 'failed':
      return 'conflict';
    case 'cancelled':
      return 'stale';
    default:
      return 'info';
  }
}

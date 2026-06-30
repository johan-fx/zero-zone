import type {
  OperationType,
  WorkCenterActivationState,
  WorkCenterConfidence,
  WorkCenterFreshness,
  WorkCenterPriority,
  WorkCenterRisk,
  WorkCenterSignalType,
  WorkCenterStatus,
} from '@zona-cero/contracts';

export type Channel = 'mobile' | 'web-ui' | 'telegram';
export type RoleTrustLevel = 'self_declared' | 'field_attested' | 'trusted_by_context' | 'org_verified';

const criticalOperationPrefixes = ['sos.', 'incident.verify'] as const;

export function isCriticalOperation(opType: OperationType): boolean {
  return criticalOperationPrefixes.some((prefix) => opType.startsWith(prefix));
}

export function canChannelSubmitOperation(channel: Channel, opType: OperationType): boolean {
  if (channel === 'web-ui') {
    return !opType.startsWith('presence.');
  }

  return true;
}

export function canAccessRestrictedIncidentData(roleTrustLevel: RoleTrustLevel): boolean {
  return roleTrustLevel === 'org_verified';
}

export type WorkCenterSignalInput = {
  signalType: WorkCenterSignalType;
  sourceId: string;
};

export type WorkCenterStateInput = {
  signals: WorkCenterSignalInput[];
  updatedAt: string;
  now?: Date;
  priority?: WorkCenterPriority;
};

export type WorkCenterDerivedState = {
  status: WorkCenterStatus;
  activationState: WorkCenterActivationState;
  freshness: WorkCenterFreshness;
  confidence: WorkCenterConfidence;
  risk: WorkCenterRisk;
  signalCount: number;
  corroboratingSignalCount: number;
};

const staleAfterMs = 24 * 60 * 60 * 1000;
const expiredAfterMs = 72 * 60 * 60 * 1000;

export function deriveWorkCenterState(input: WorkCenterStateInput): WorkCenterDerivedState {
  const signalCount = input.signals.length;
  const corroboratingSignalCount = countCorroboratingSignalTypes(input.signals);
  const activationState = deriveWorkCenterActivationState(input.signals);
  const freshness = deriveWorkCenterFreshness(input.updatedAt, input.now);
  const confidence = deriveWorkCenterConfidence({ activationState, corroboratingSignalCount });
  const risk = deriveWorkCenterRisk({ confidence, freshness, priority: input.priority ?? 'medium' });

  return {
    status: activationState === 'active' ? 'active' : 'reported',
    activationState,
    freshness,
    confidence,
    risk,
    signalCount,
    corroboratingSignalCount,
  };
}

export function deriveWorkCenterActivationState(signals: WorkCenterSignalInput[]): WorkCenterActivationState {
  if (countCorroboratingSignalTypes(signals) >= 2) {
    return 'active';
  }

  return 'pending_corroboration';
}

export function deriveWorkCenterFreshness(updatedAt: string, now: Date = new Date()): WorkCenterFreshness {
  const updatedAtMs = Date.parse(updatedAt);

  if (!Number.isFinite(updatedAtMs)) {
    return 'expired';
  }

  const ageMs = now.getTime() - updatedAtMs;

  if (ageMs <= staleAfterMs) {
    return 'fresh';
  }

  if (ageMs <= expiredAfterMs) {
    return 'stale';
  }

  return 'expired';
}

export function deriveWorkCenterConfidence(input: {
  activationState: WorkCenterActivationState;
  corroboratingSignalCount: number;
}): WorkCenterConfidence {
  if (input.activationState === 'active' && input.corroboratingSignalCount >= 3) {
    return 'high';
  }

  if (input.activationState === 'active' || input.corroboratingSignalCount >= 2) {
    return 'medium';
  }

  return 'low';
}

export function deriveWorkCenterRisk(input: {
  confidence: WorkCenterConfidence;
  freshness: WorkCenterFreshness;
  priority: WorkCenterPriority;
}): WorkCenterRisk {
  if (input.freshness === 'expired' || (input.priority === 'critical' && input.confidence === 'low')) {
    return 'high';
  }

  if (input.freshness === 'stale' || input.priority === 'high' || input.priority === 'critical') {
    return 'medium';
  }

  return 'low';
}

function countCorroboratingSignalTypes(signals: WorkCenterSignalInput[]): number {
  return new Set(signals.map((signal) => signal.signalType)).size;
}

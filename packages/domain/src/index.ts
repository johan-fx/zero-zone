import type {
  OperationType,
  Dispute,
  TrustSignal,
  TrustState,
  TrustSubject,
  ResourceReportKind,
  ResourceReportSummary,
  ResourceReportUrgency,
  WorkCenterRisk,
  WorkCenterActivationState,
  WorkCenterConfidence,
  WorkCenterFreshness,
  WorkCenterPriority,
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


export type ResourceReportStateInput = {
  updatedAt: string;
  reportKind: ResourceReportKind;
  urgency: ResourceReportUrgency;
  constraints?: string[];
  now?: Date;
};

export type ResourceReportDerivedState = {
  freshness: WorkCenterFreshness;
  confidence: WorkCenterConfidence;
  risk: WorkCenterRisk;
};

export function deriveResourceReportState(input: ResourceReportStateInput): ResourceReportDerivedState {
  const freshness = deriveWorkCenterFreshness(input.updatedAt, input.now);
  const confidence = input.constraints && input.constraints.length > 0 ? 'medium' : 'low';
  const risk = deriveWorkCenterRisk({ confidence, freshness, priority: input.urgency });

  return { freshness, confidence, risk };
}

export type ResourceReportMatch = {
  need: ResourceReportSummary;
  surplus: ResourceReportSummary;
  score: number;
  reasons: string[];
};

export type ResourceNeedRecommendation = {
  need: ResourceReportSummary;
  normalizedCategory: string;
  score: number;
  reasons: string[];
};

export type ResourceNeedRecommendationInput = {
  resourceLabel?: string | null;
  resourceType?: string | null;
  incidentId?: string | null;
  needs: ResourceReportSummary[];
};

export function matchResourceReports(reports: ResourceReportSummary[]): ResourceReportMatch[] {
  const needs = reports.filter((report) => report.reportKind === 'needed');
  const surpluses = reports.filter((report) => report.reportKind === 'surplus');
  const matches: ResourceReportMatch[] = [];

  for (const need of needs) {
    for (const surplus of surpluses) {
      if (need.incidentId !== surplus.incidentId || normalizeResourceCategory(need.category) !== normalizeResourceCategory(surplus.category)) {
        continue;
      }

      const sameCell = need.cellId === surplus.cellId;
      const sameWorkCenter = need.workCenterId !== undefined && need.workCenterId === surplus.workCenterId;

      if (!sameCell && !sameWorkCenter) {
        continue;
      }

      const reasons = [sameWorkCenter ? 'same_work_center' : 'same_cell', 'same_category'];
      const urgencyBoost = need.urgency === 'critical' || need.urgency === 'high' ? 0.1 : 0;
      const confidencePenalty = surplus.confidence === 'low' ? 0.1 : 0;
      const score = clampScore((sameWorkCenter ? 0.9 : 0.75) + urgencyBoost - confidencePenalty);
      matches.push({ need, surplus, score, reasons });
    }
  }

  return matches.sort((a, b) => b.score - a.score || a.need.resourceReportId.localeCompare(b.need.resourceReportId));
}

export function recommendResourceNeeds(input: ResourceNeedRecommendationInput): ResourceNeedRecommendation[] {
  const normalizedCategory = normalizeResourceCategory(input.resourceType ?? input.resourceLabel ?? '');

  if (!normalizedCategory) {
    return [];
  }

  return input.needs
    .filter((need) => need.reportKind === 'needed')
    .filter((need) => !input.incidentId || need.incidentId === input.incidentId)
    .filter((need) => normalizeResourceCategory(need.category) === normalizedCategory)
    .map((need) => scoreResourceNeedRecommendation(need, normalizedCategory))
    .sort(compareResourceNeedRecommendations);
}

export function normalizeResourceCategory(category: string): string {
  const normalized = category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return resourceCategorySynonyms[normalized] ?? normalized;
}

const resourceCategorySynonyms: Record<string, string> = {
  medicamento: 'medicine',
  medicamentos: 'medicine',
  medicina: 'medicine',
  medicinas: 'medicine',
  medicine: 'medicine',
  medicines: 'medicine',
  medication: 'medicine',
  medications: 'medicine',
  farmaco: 'medicine',
  farmacos: 'medicine',
  agua: 'water',
  'agua potable': 'water',
  water: 'water',
  comida: 'food',
  alimento: 'food',
  alimentos: 'food',
  food: 'food',
  manta: 'blankets',
  mantas: 'blankets',
  blanket: 'blankets',
  blankets: 'blankets',
  combustible: 'fuel',
  fuel: 'fuel',
  transporte: 'transport',
  transport: 'transport',
  refugio: 'shelter',
  shelter: 'shelter',
  equipamiento: 'equipment',
  equipo: 'equipment',
  equipment: 'equipment',
};

function scoreResourceNeedRecommendation(need: ResourceReportSummary, normalizedCategory: string): ResourceNeedRecommendation {
  const reasons = ['same_category'];
  let score = 0.35 + urgencyScore[need.urgency] + freshnessScore[need.freshness] + confidenceScore[need.confidence] - riskPenalty[need.risk];

  if (need.workCenterId) {
    score += 0.08;
    reasons.push('linked_work_center');
  }

  reasons.push(`urgency_${need.urgency}`, `freshness_${need.freshness}`, `confidence_${need.confidence}`, `risk_${need.risk}`);
  return { need, normalizedCategory, score: clampScore(score), reasons };
}

function compareResourceNeedRecommendations(a: ResourceNeedRecommendation, b: ResourceNeedRecommendation): number {
  return (
    urgencyRank[b.need.urgency] - urgencyRank[a.need.urgency]
    || b.score - a.score
    || freshnessRank[b.need.freshness] - freshnessRank[a.need.freshness]
    || confidenceRank[b.need.confidence] - confidenceRank[a.need.confidence]
    || riskRank[a.need.risk] - riskRank[b.need.risk]
    || Number(Boolean(b.need.workCenterId)) - Number(Boolean(a.need.workCenterId))
    || b.need.updatedAt.localeCompare(a.need.updatedAt)
    || a.need.resourceReportId.localeCompare(b.need.resourceReportId)
  );
}

const urgencyRank: Record<ResourceReportUrgency, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const urgencyScore: Record<ResourceReportUrgency, number> = { low: 0, medium: 0.14, high: 0.28, critical: 0.4 };
const freshnessRank: Record<WorkCenterFreshness, number> = { expired: 0, stale: 1, fresh: 2 };
const freshnessScore: Record<WorkCenterFreshness, number> = { expired: 0, stale: 0.06, fresh: 0.12 };
const confidenceRank: Record<WorkCenterConfidence, number> = { low: 0, medium: 1, high: 2 };
const confidenceScore: Record<WorkCenterConfidence, number> = { low: 0, medium: 0.06, high: 0.12 };
const riskRank: Record<WorkCenterRisk, number> = { low: 0, medium: 1, high: 2 };
const riskPenalty: Record<WorkCenterRisk, number> = { low: 0, medium: 0.04, high: 0.08 };

function clampScore(score: number): number {
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

export type CanonicalTrustSignalInput = Pick<TrustSignal, 'signalType' | 'sourceKind' | 'sourceChannel' | 'sourceExternalId' | 'confidence' | 'createdAt'>;
export type CanonicalDisputeInput = Pick<Dispute, 'reason' | 'sourceChannel' | 'sourceExternalId' | 'createdAt'>;

export type TrustScoringInput = {
  incidentId: string;
  subject: TrustSubject;
  signals: CanonicalTrustSignalInput[];
  disputes?: CanonicalDisputeInput[];
  contextualReputation?: number;
  now?: Date;
};

export function deriveCanonicalTrustState(input: TrustScoringInput): TrustState {
  const now = input.now ?? new Date();
  const signals = input.signals;
  const disputes = input.disputes ?? [];
  const positiveSignals = signals.filter((signal) => signal.signalType !== 'negative_report');
  const negativeSignals = signals.filter((signal) => signal.signalType === 'negative_report');
  const distinctSources = new Set(signals.map((signal) => `${signal.sourceChannel}:${signal.sourceExternalId}`));
  const distinctPositiveSourceKinds = new Set(positiveSignals.map((signal) => signal.sourceKind));
  const freshnessScore = strongestFreshnessScore(positiveSignals, now);
  const diversityScore = Math.min(0.25, Math.max(0, distinctSources.size - 1) * 0.08 + Math.max(0, distinctPositiveSourceKinds.size - 1) * 0.05);
  const presenceScore = positiveSignals.some((signal) => signal.signalType === 'presence_observed') ? 0.12 : 0;
  const selfScore = positiveSignals.some((signal) => signal.signalType === 'self_declaration') ? 0.18 : 0;
  const fieldScore = positiveSignals.some((signal) => signal.signalType === 'field_attestation') ? 0.36 : 0;
  const contextScore = positiveSignals.some((signal) => signal.signalType === 'context_corroboration') ? 0.28 : 0;
  const reputationScore = Math.min(0.15, Math.max(0, input.contextualReputation ?? 0));
  const confidenceScore = positiveSignals.reduce((sum, signal) => sum + signal.confidence, 0) * 0.08;
  const negativePenalty = negativeSignals.length * 0.18 + disputes.length * 0.25;
  const sybilPenalty = distinctSources.size > 0 && distinctSources.size <= 1 && positiveSignals.length >= 3 ? 0.2 : 0;
  const score = clampScore(freshnessScore + diversityScore + presenceScore + selfScore + fieldScore + contextScore + reputationScore + confidenceScore - negativePenalty - sybilPenalty);
  const status = deriveTrustStatus({ score, positiveSignals, negativeSignals, disputes, sybilPenalty });
  const visibility = status === 'disputed' || status === 'degraded' ? 'limited' : status === 'pending_corroboration' ? 'normal' : 'elevated';
  const explanation = buildTrustExplanation({ freshnessScore, diversityScore, presenceScore, reputationScore, negativePenalty, sybilPenalty, status, sourceCount: distinctSources.size });

  return {
    incidentId: input.incidentId,
    subject: input.subject,
    status,
    visibility,
    priorityWeight: score,
    score,
    explanation,
    signalCount: signals.length,
    disputeCount: disputes.length,
    updatedAt: now.toISOString(),
  };
}

function strongestFreshnessScore(signals: CanonicalTrustSignalInput[], now: Date): number {
  if (signals.length === 0) {
    return 0;
  }

  return Math.max(...signals.map((signal) => {
    const createdAtMs = Date.parse(signal.createdAt);
    if (!Number.isFinite(createdAtMs)) {
      return 0;
    }
    if (createdAtMs > now.getTime()) {
      return 0;
    }
    const ageMs = now.getTime() - createdAtMs;
    if (ageMs <= 6 * 60 * 60 * 1000) return 0.2;
    if (ageMs <= 24 * 60 * 60 * 1000) return 0.14;
    if (ageMs <= 72 * 60 * 60 * 1000) return 0.06;
    return 0;
  }));
}

function deriveTrustStatus(input: {
  score: number;
  positiveSignals: CanonicalTrustSignalInput[];
  negativeSignals: CanonicalTrustSignalInput[];
  disputes: CanonicalDisputeInput[];
  sybilPenalty: number;
}): TrustState['status'] {
  if (input.disputes.length > 0) {
    return 'disputed';
  }

  if (input.negativeSignals.length > 0 || input.sybilPenalty > 0) {
    return input.score >= 0.45 ? 'pending_corroboration' : 'degraded';
  }

  if (input.positiveSignals.some((signal) => signal.signalType === 'context_corroboration') && input.score >= 0.7) {
    return 'trusted_by_context';
  }

  if (input.positiveSignals.some((signal) => signal.signalType === 'field_attestation') && input.score >= 0.5) {
    return 'field_attested';
  }

  if (input.positiveSignals.some((signal) => signal.signalType === 'self_declaration')) {
    return input.score >= 0.35 ? 'self_declared' : 'pending_corroboration';
  }

  return 'pending_corroboration';
}

function buildTrustExplanation(input: {
  freshnessScore: number;
  diversityScore: number;
  presenceScore: number;
  reputationScore: number;
  negativePenalty: number;
  sybilPenalty: number;
  status: TrustState['status'];
  sourceCount: number;
}): string[] {
  const explanation = [`status:${input.status}`];
  if (input.freshnessScore > 0) explanation.push('fresh_signal');
  if (input.diversityScore > 0) explanation.push(`source_diversity:${input.sourceCount}`);
  if (input.presenceScore > 0) explanation.push('presence_observed');
  if (input.reputationScore > 0) explanation.push('contextual_reputation');
  if (input.negativePenalty > 0) explanation.push('negative_signals_or_disputes');
  if (input.sybilPenalty > 0) explanation.push('sybil_penalty_same_source_cluster');
  return explanation;
}

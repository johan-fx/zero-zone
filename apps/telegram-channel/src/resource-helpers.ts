import { type SupportedLocale, formatMessage } from '@zona-cero/i18n';

import {
  type IncidentSummary,
  type ResourceReportConnectedCreateRequest,
  type ResourceReportCreateResponse,
  type ResourceReportKind,
  type ResourceReportUrgency,
} from '@zona-cero/contracts';

import { isRecord, parseUrgency, readErrorCode } from './parsing';
import type { TelegramResourceNeedRecommendation, TelegramResourceNeedRecommendationInput, TelegramUpdateLike } from './types';

export function formatResourceNeedRecommendationList(locale: SupportedLocale, recommendations: TelegramResourceNeedRecommendation[]): string {
  return recommendations.map((recommendation, index) => {
    const destination = recommendation.workCenterName ?? recommendation.workCenterId ?? recommendation.incident.locationName;
    const category = recommendation.category ? ` · ${recommendation.category}` : '';
    const quantity = formatResourceNeedRecommendationQuantity(locale, recommendation);
    const urgency = recommendation.urgency ? ` · ${formatResourceUrgency(locale, recommendation.urgency)}` : '';
    const reason = formatResourceNeedRecommendationReason(locale, recommendation.reasons);
    return `${index + 1}. ${recommendation.incident.name} — ${destination}${category}${quantity}${urgency}${reason}`;
  }).join('\n');
}

export function formatResourceNeedRecommendationQuantity(locale: SupportedLocale, recommendation: TelegramResourceNeedRecommendation): string {
  const quantity = recommendation.quantityApprox?.trim();
  const category = recommendation.category?.trim();
  const unspecified = locale === 'es' ? 'cantidad no especificada' : 'quantity not specified';

  if (!quantity) return ` · ${unspecified}`;
  if (category && normalizeRecommendationText(quantity) === normalizeRecommendationText(category)) return ` · ${unspecified}`;
  return ` · ${quantity}`;
}

export function normalizeRecommendationText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function formatResourceNeedRecommendationReason(locale: SupportedLocale, reasons: string[] | undefined): string {
  if (!reasons || reasons.length === 0) return '';
  if (locale === 'es') {
    if (reasons.includes('linked_work_center')) return ' · motivo: misma categoría y necesidad vinculada a centro';
    return ' · motivo: misma categoría y prioridad operativa';
  }

  if (reasons.includes('linked_work_center')) return ' · reason: same category and work-center need';
  return ' · reason: same category and operational priority';
}

export function selectResourceNeedRecommendation(recommendations: TelegramResourceNeedRecommendation[], text: string): TelegramResourceNeedRecommendation | null {
  const index = Number.parseInt(text, 10);
  if (Number.isInteger(index) && String(index) === text && index >= 1 && index <= recommendations.length) return recommendations[index - 1] ?? null;
  return recommendations.find((recommendation) => recommendation.incident.incidentId === text || recommendation.workCenterId === text) ?? null;
}

export function sortResourceNeedRecommendations(recommendations: TelegramResourceNeedRecommendation[]): TelegramResourceNeedRecommendation[] {
  return [...recommendations].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.incident.incidentId.localeCompare(b.incident.incidentId));
}

export function createResourceNeedRecommendationInput(
  update: TelegramUpdateLike,
  externalUserId: string,
  displayName: string | undefined,
  preferredLocale: SupportedLocale,
): TelegramResourceNeedRecommendationInput | null {
  const messageText = update.message?.text?.trim() ?? '';
  if (!hasImplicitWhereNeededQuestion(messageText) || !hasResourceOfferLanguage(messageText)) return null;
  return {
    externalUserId,
    displayName,
    preferredLocale,
    messageText,
    category: inferResourceCategory(messageText),
    intent: 'where_needed',
    reportKind: 'surplus',
  };
}

export function hasImplicitWhereNeededQuestion(text: string): boolean {
  const normalized = normalizeResourceText(text);
  return normalized.includes('donde la necesitan') || normalized.includes('donde lo necesitan') || normalized.includes('donde se necesita') || normalized.includes('where needed') || normalized.includes('where is it needed');
}

export function hasResourceOfferLanguage(text: string): boolean {
  const normalized = normalizeResourceText(text);
  return normalized.includes('tengo ') || normalized.includes('tenemos ') || normalized.includes('dispongo ') || normalized.includes('i have ') || normalized.includes('we have ');
}

export function inferResourceCategory(text: string): string | undefined {
  const normalized = normalizeResourceText(text);
  if (['medicamento', 'medicamentos', 'medicina', 'medicinas', 'farmaco', 'farmacos', 'medicine', 'medication'].some((term) => normalized.includes(term))) return 'medication';
  if (['agua', 'water'].some((term) => normalized.includes(term))) return 'water';
  if (['comida', 'alimento', 'alimentos', 'food'].some((term) => normalized.includes(term))) return 'food';
  if (['manta', 'mantas', 'blanket', 'blankets'].some((term) => normalized.includes(term))) return 'blankets';
  if (['combustible', 'fuel'].some((term) => normalized.includes(term))) return 'fuel';
  if (['transporte', 'transport'].some((term) => normalized.includes(term))) return 'transport';
  if (['refugio', 'shelter'].some((term) => normalized.includes(term))) return 'shelter';
  if (['equipamiento', 'equipo', 'equipment'].some((term) => normalized.includes(term))) return 'equipment';
  return undefined;
}

export function normalizeResourceText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function isManualFallback(text: string): boolean {
  return ['manual', 'm', 'omitir', 'saltar', 'skip'].includes(text.trim().toLowerCase());
}

export function formatResourceReportKind(locale: SupportedLocale, reportKind: ResourceReportKind): string {
  if (locale === 'es') return reportKind === 'needed' ? 'necesario' : 'sobrante';
  return reportKind;
}

export function formatResourceUrgency(locale: SupportedLocale, urgency: ResourceReportUrgency): string {
  if (locale !== 'es') return urgency;
  const labels: Record<ResourceReportUrgency, string> = {
    low: 'baja',
    medium: 'media',
    high: 'alta',
    critical: 'crítica',
  };
  return labels[urgency];
}

export function formatResourceReportConfirmation(locale: SupportedLocale, incident: IncidentSummary, request: ResourceReportConnectedCreateRequest): string {
  const payload = request.payload;
  return formatMessage(locale, 'telegram.resource.confirmation', {
    incidentName: incident.name,
    reportKind: formatResourceReportKind(locale, payload.reportKind),
    category: payload.category,
    quantityApprox: payload.quantityApprox,
    urgency: formatResourceUrgency(locale, payload.urgency),
    constraints: payload.constraints.length ? payload.constraints.join(', ') : formatMessage(locale, 'telegram.resource.none'),
    workCenter: payload.workCenterId ?? formatMessage(locale, 'telegram.resource.not_linked'),
  });
}

export function formatResourceReportSuccess(locale: SupportedLocale, response: ResourceReportCreateResponse): string {
  return formatMessage(locale, 'telegram.resource.success', {
    reportKind: formatResourceReportKind(locale, response.resourceReport.reportKind),
    category: response.resourceReport.category,
    quantityApprox: response.resourceReport.quantityApprox,
    urgency: formatResourceUrgency(locale, response.resourceReport.urgency),
    auditEventId: response.audit.auditEventId,
  });
}

export function formatResourceReportError(locale: SupportedLocale, error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'permission_denied') return formatMessage(locale, 'telegram.resource.error.permission_denied');
  if (code === 'invalid_payload') return formatMessage(locale, 'telegram.resource.error.invalid_payload');
  return formatMessage(locale, 'telegram.resource.error.default');
}

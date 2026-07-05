import { formatMessage, type SupportedLocale } from '@zona-cero/i18n';

import { ResourceReportConnectedCreateRequestSchema } from '@zona-cero/contracts';

import { formatIncidentList, selectIncident } from './incident-selection';
import { getPreferredLocaleFromState, handleTelegramLanguageCommand, resolveTelegramLocale, withPreferredLocale } from './locale';
import { isCancellation, isConfirmation, isSkip, parseOptionalList, parseReportKind, parseUrgency, readErrorCode } from './parsing';
import {
  createResourceNeedRecommendationInput,
  formatResourceNeedRecommendationList,
  formatResourceReportConfirmation,
  formatResourceReportError,
  formatResourceReportSuccess,
  isManualFallback,
  selectResourceNeedRecommendation,
  sortResourceNeedRecommendations,
} from './resource-helpers';
import { getTelegramDisplayName, getTelegramExternalUserId, resolveTelegramCommand } from './telegram-update';
import { withTelegramFlowTelemetry } from './telemetry';
import type { TelegramFlowContext, TelegramResourceReportFlowResult, TelegramResourceReportPorts, TelegramResourceReportState, TelegramUpdateLike } from './types';

type TelegramResourceFlowContext = Extract<TelegramFlowContext, { sourceIntent: 'resource' }>;

export async function handleTelegramResourceReportFlow(
  state: TelegramResourceReportState,
  update: TelegramUpdateLike,
  ports: TelegramResourceReportPorts,
  flowContext?: TelegramResourceFlowContext,
): Promise<TelegramResourceReportFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;

  const result: TelegramResourceReportFlowResult = await withTelegramFlowTelemetry(
    ports,
    'telegram.resource_report',
    previousStep,
    startedAt,
    async (): Promise<TelegramResourceReportFlowResult> => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);
      const locale = resolveTelegramLocale(update, getPreferredLocaleFromState(state));
      const languageResult = handleTelegramLanguageCommand(update, locale);
      if (languageResult) return { state: withPreferredLocale(state, languageResult.locale), responseText: languageResult.responseText };

      if (command === '/cancel') return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.resource.cancelled') };
      if (command === '/resource' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'reported') {
        return startResourceIncidentSelection(update, ports, locale);
      }

      if (state.step === 'awaitingIncident') {
        const incident = selectIncident(state.incidents, text);
        if (!incident) return { state, responseText: formatMessage(locale, 'telegram.error.incident_not_found', { incidentList: formatIncidentList(state.incidents) }) };
        return { state: { step: 'awaitingKind', incident, externalUserId: state.externalUserId, displayName: state.displayName, preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.resource.kind.prompt') };
      }

      if (state.step === 'awaitingRecommendedNeedSelection') {
        if (isManualFallback(text)) return startResourceManualIncidentSelection(update, ports, locale, state.externalUserId, state.displayName);
        const recommendation = selectResourceNeedRecommendation(state.recommendations, text);
        if (!recommendation) return { state, responseText: formatMessage(locale, 'telegram.resource.recommendations.choose', { recommendationList: formatResourceNeedRecommendationList(locale, state.recommendations) }) };
        const base = {
          incident: recommendation.incident,
          externalUserId: state.externalUserId,
          displayName: state.displayName,
          preferredLocale: locale,
          reportKind: 'surplus' as const,
          ...(recommendation.workCenterId ? { recommendedWorkCenterId: recommendation.workCenterId } : {}),
        };
        if (state.category || recommendation.category) {
          return { state: { step: 'awaitingQuantity', ...base, category: state.category ?? recommendation.category ?? '' }, responseText: formatMessage(locale, 'telegram.resource.quantity.prompt') };
        }
        return { state: { step: 'awaitingCategory', ...base }, responseText: formatMessage(locale, 'telegram.resource.category.prompt') };
      }

      if (state.step === 'awaitingKind') {
        const reportKind = parseReportKind(text.toLowerCase());
        if (!reportKind) return { state, responseText: formatMessage(locale, 'telegram.resource.kind.invalid') };
        return { state: { step: 'awaitingCategory', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, preferredLocale: locale, reportKind }, responseText: formatMessage(locale, 'telegram.resource.category.prompt') };
      }

      if (state.step === 'awaitingCategory') {
        if (!text || text.startsWith('/')) return { state, responseText: formatMessage(locale, 'telegram.resource.category.required') };
        return { state: { step: 'awaitingQuantity', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, preferredLocale: locale, reportKind: state.reportKind, category: text, recommendedWorkCenterId: state.recommendedWorkCenterId }, responseText: formatMessage(locale, 'telegram.resource.quantity.prompt') };
      }

      if (state.step === 'awaitingQuantity') {
        if (!text || text.startsWith('/')) return { state, responseText: formatMessage(locale, 'telegram.resource.quantity.required') };
        return { state: { ...state, step: 'awaitingUrgency', preferredLocale: locale, quantityApprox: text }, responseText: formatMessage(locale, 'telegram.resource.urgency.prompt') };
      }

      if (state.step === 'awaitingUrgency') {
        const urgency = parseUrgency(text.toLowerCase());
        if (!urgency) return { state, responseText: formatMessage(locale, 'telegram.resource.urgency.invalid') };
        return { state: { ...state, step: 'awaitingConstraints', preferredLocale: locale, urgency }, responseText: formatMessage(locale, 'telegram.resource.constraints.prompt') };
      }

      if (state.step === 'awaitingConstraints') {
        const constraints = parseOptionalList(text);
        const request = ResourceReportConnectedCreateRequestSchema.parse({
          channel: 'telegram',
          externalId: state.externalUserId,
          displayName: state.displayName,
          payload: {
            category: state.category,
            quantityApprox: state.quantityApprox,
            urgency: state.urgency,
            constraints,
            reportKind: state.reportKind,
            ...(state.recommendedWorkCenterId ? { workCenterId: state.recommendedWorkCenterId } : {}),
          },
        });
        return { state: { step: 'awaitingWorkCenter', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, preferredLocale: locale, request }, responseText: formatMessage(locale, 'telegram.resource.work_center.prompt') };
      }

      if (state.step === 'awaitingWorkCenter') {
        const request = text && !isSkip(text) && !text.startsWith('/')
          ? ResourceReportConnectedCreateRequestSchema.parse({ ...state.request, payload: { ...state.request.payload, workCenterId: text } })
          : state.request;
        return { state: { step: 'awaitingConfirmation', incident: state.incident, externalUserId: state.externalUserId, displayName: state.displayName, preferredLocale: locale, request }, responseText: `${formatResourceReportConfirmation(locale, state.incident, request)}\n${resourceTrustContextCopy(locale, 'confirmation')}` };
      }

      if (state.step === 'awaitingConfirmation') {
        if (isCancellation(text)) return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.resource.cancelled') };
        if (!isConfirmation(text)) return { state, responseText: formatMessage(locale, 'telegram.resource.confirmation.required') };
        try {
          const response = await ports.createResourceReport(state.incident.incidentId, state.request);
          return { state: { step: 'reported', response }, responseText: `${formatResourceReportSuccess(locale, response)}\n${resourceTrustContextCopy(locale, 'success')}` };
        } catch (error) {
          const errorCode = readErrorCode(error);
          return {
            state: errorCode === 'permission_denied' ? { step: 'cancelled' } : state,
            responseText: formatResourceReportError(locale, error),
          };
        }
      }

      return { state, responseText: formatMessage(locale, 'telegram.resource.prompt') };
    },
  );

  return withTelegramResourceFlowContextPreface(result, flowContext);
}

function resourceTrustContextCopy(locale: SupportedLocale, phase: 'confirmation' | 'success'): string {
  if (locale === 'es') {
    return phase === 'confirmation'
      ? 'Confianza contextual: este aviso de recurso queda como información civil pendiente de señales. No promete disponibilidad ni entrega.'
      : 'Confianza contextual: el servidor podrá recibir corroboraciones o disputas; no calcules prioridad fuera del estado canónico.';
  }

  return phase === 'confirmation'
    ? 'Contextual trust: this resource report remains civil information pending signals. It does not promise availability or delivery.'
    : 'Contextual trust: the server can receive corroborations or disputes; do not calculate priority outside the canonical state.';
}

function withTelegramResourceFlowContextPreface(
  result: TelegramResourceReportFlowResult,
  flowContext?: TelegramResourceFlowContext,
): TelegramResourceReportFlowResult {
  const contextText = buildTelegramResourceIntentContext(flowContext?.facts ?? null, getPreferredLocaleFromState(result.state) ?? flowContext?.preferredLocale ?? 'es');
  return contextText ? { ...result, responseText: `${contextText}\n\n${result.responseText}` } : result;
}

function buildTelegramResourceIntentContext(facts: TelegramResourceFlowContext['facts'], locale: SupportedLocale): string | null {
  if (!facts) {
    return null;
  }

  const resourceLabel = resolveTelegramResourceIntentLabel(facts, locale);
  if (!resourceLabel) {
    return null;
  }

  if (facts.resourceDirection === 'offer' || facts.implicitQuestion === 'where_needed') {
    if (locale === 'es') {
      const agreement = resolveSpanishResourceAgreement(resourceLabel);
      return `Entiendo que tienes ${resourceLabel} ${agreement.available}. Te guiaré para ${agreement.registerPronoun} de forma segura; el reporte no se creará hasta que confirmes los datos.`;
    }

    return `I understand you have ${resourceLabel} available. I’ll guide you to register it safely; the report will not be created until you confirm the details.`;
  }

  if (facts.resourceDirection === 'need' || facts.implicitQuestion === 'where_available') {
    return locale === 'es'
      ? `Entiendo que necesitas ${resourceLabel}. Te guiaré para registrarlo de forma segura; el reporte no se creará hasta que confirmes los datos.`
      : `I understand you need ${resourceLabel}. I’ll guide you to register it safely; the report will not be created until you confirm the details.`;
  }

  return locale === 'es'
    ? `Entiendo que quieres reportar información sobre ${resourceLabel}. Te guiaré con las preguntas obligatorias antes de crear cualquier reporte.`
    : `I understand you want to report information about ${resourceLabel}. I’ll guide you through the required questions before creating any report.`;
}

function resolveSpanishResourceAgreement(resourceLabel: string): { available: 'disponible' | 'disponibles'; registerPronoun: 'registrarlo' | 'registrarlos' } {
  const normalizedLabel = resourceLabel.trim().toLowerCase();
  const plural = /(?:s|es)$/.test(normalizedLabel) && !/(?:gas|víveres)$/.test(normalizedLabel);
  return plural ? { available: 'disponibles', registerPronoun: 'registrarlos' } : { available: 'disponible', registerPronoun: 'registrarlo' };
}

function resolveTelegramResourceIntentLabel(facts: NonNullable<TelegramResourceFlowContext['facts']>, locale: SupportedLocale): string | null {
  const explicitLabel = facts.resourceLabel?.trim();
  if (explicitLabel) {
    return explicitLabel;
  }

  const fallbackLabels: Record<SupportedLocale, Partial<Record<NonNullable<TelegramResourceFlowContext['facts']>['resourceType'], string>>> = {
    es: {
      water: 'agua',
      food: 'comida',
      medicine: 'medicamentos',
      shelter: 'refugio',
      equipment: 'equipamiento',
      transport: 'transporte',
      fuel: 'combustible',
    },
    en: {
      water: 'water',
      food: 'food',
      medicine: 'medicine',
      shelter: 'shelter',
      equipment: 'equipment',
      transport: 'transport',
      fuel: 'fuel',
    },
  };

  return fallbackLabels[locale][facts.resourceType] ?? null;
}

async function startResourceIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramResourceReportPorts,
  preferredLocale?: SupportedLocale,
): Promise<TelegramResourceReportFlowResult> {
  const locale = resolveTelegramLocale(update, preferredLocale);
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.resource.user.required') };

  const displayName = getTelegramDisplayName(update);
  const recommendationInput = createResourceNeedRecommendationInput(update, externalUserId, displayName, locale);
  if (recommendationInput && ports.listResourceNeedRecommendations) {
    try {
      const { recommendations } = await ports.listResourceNeedRecommendations(recommendationInput);
      const topRecommendations = sortResourceNeedRecommendations(recommendations).slice(0, 3);
      if (topRecommendations.length > 0) {
        return {
          state: {
            step: 'awaitingRecommendedNeedSelection',
            recommendations: topRecommendations,
            externalUserId,
            displayName,
            preferredLocale: locale,
            ...(recommendationInput.category ? { category: recommendationInput.category } : {}),
          },
          responseText: formatMessage(locale, 'telegram.resource.recommendations.found', {
            recommendationList: formatResourceNeedRecommendationList(locale, topRecommendations),
          }),
        };
      }
      return startResourceManualIncidentSelection(update, ports, locale, externalUserId, displayName, true);
    } catch {
      // Recommendation lookup is an optional UX accelerator. Fall through to the manual incident flow.
    }
  }

  return startResourceManualIncidentSelection(update, ports, locale, externalUserId, displayName);
}


async function startResourceManualIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramResourceReportPorts,
  locale: SupportedLocale,
  externalUserId: string,
  displayName?: string,
  includeRecommendationFallback = false,
): Promise<TelegramResourceReportFlowResult> {
  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.error.no_active_incidents') };
    const incidentList = formatIncidentList(incidents);
    return {
      state: { step: 'awaitingIncident', incidents, externalUserId, displayName, preferredLocale: locale },
      responseText: includeRecommendationFallback
        ? formatMessage(locale, 'telegram.resource.recommendations.none', { incidentList })
        : formatMessage(locale, 'telegram.resource.start', { incidentList }),
    };
  } catch {
    return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.error.incidents_load_failed') };
  }
}

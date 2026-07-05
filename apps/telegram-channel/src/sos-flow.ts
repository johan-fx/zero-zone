import { formatMessage } from '@zona-cero/i18n';

import { SosConnectedCreateRequestSchema, TelegramSosIntentFactsSchema, type TelegramSosIntentFacts, type SupportedLocale } from '@zona-cero/contracts';

import { formatIncidentList, selectIncident } from './incident-selection';
import { getPreferredLocaleFromState, handleTelegramLanguageCommand, resolveTelegramLocale, withPreferredLocale } from './locale';
import { isCancellation, isStrongSosConfirmation } from './parsing';
import { formatSosConfirmation, formatSosError, formatSosSuccess } from './sos-helpers';
import { getTelegramDisplayName, getTelegramExternalUserId, resolveTelegramCommand } from './telegram-update';
import { withTelegramFlowTelemetry } from './telemetry';
import type { TelegramFlowContext, TelegramSosFlowResult, TelegramSosPorts, TelegramSosState, TelegramUpdateLike } from './types';

type TelegramSosFlowContext = Extract<TelegramFlowContext, { sourceIntent: 'sos' }>;

export async function handleTelegramSosFlow(
  state: TelegramSosState,
  update: TelegramUpdateLike,
  ports: TelegramSosPorts,
  flowContext?: TelegramSosFlowContext,
): Promise<TelegramSosFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;

  const result: TelegramSosFlowResult = await withTelegramFlowTelemetry(
    ports,
    'telegram.sos',
    previousStep,
    startedAt,
    async () => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);
      const locale = resolveTelegramLocale(update, getPreferredLocaleFromState(state) ?? flowContext?.preferredLocale);
      const languageResult = handleTelegramLanguageCommand(update, locale);
      if (languageResult) return { state: withPreferredLocale(state, languageResult.locale), responseText: languageResult.responseText };

      if (command === '/cancel') {
        return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.sos.cancelled') };
      }

      if (command === '/sos' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'submitted') {
        return startSosIncidentSelection(update, ports, locale);
      }

      if (state.step === 'awaitingIncident') {
        const incident = selectIncident(state.incidents, text);
        if (!incident) {
          return {
            state,
            responseText: formatMessage(locale, 'telegram.error.incident_not_found', { incidentList: formatIncidentList(state.incidents) }),
          };
        }

        const request = SosConnectedCreateRequestSchema.parse({
          channel: 'telegram',
          externalId: state.externalUserId,
          displayName: state.displayName,
          payload: { severity: 'critical', reportedAt: new Date().toISOString() },
        });

        return {
          state: {
            step: 'awaitingConfirmation',
            incident,
            externalUserId: state.externalUserId,
            displayName: state.displayName,
            request,
            preferredLocale: locale,
          },
          responseText: `${formatSosConfirmation(locale, incident)}\n${sosTrustContextCopy(locale, 'confirmation')}`,
        };
      }

      if (state.step === 'awaitingConfirmation') {
        if (isCancellation(text)) {
          return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.sos.cancelled') };
        }

        if (!isStrongSosConfirmation(text)) {
          return {
            state,
            responseText: formatMessage(locale, 'telegram.sos.confirmation.required'),
          };
        }

        try {
          const response = await ports.createSosAlert(state.incident.incidentId, state.request);
          return { state: { step: 'submitted', response }, responseText: `${formatSosSuccess(locale, response)}\n${sosTrustContextCopy(locale, 'success')}` };
        } catch (error) {
          return { state, responseText: formatSosError(locale, error) };
        }
      }

      return { state, responseText: formatMessage(locale, 'telegram.sos.command') };
    },
  );

  return withTelegramSosFlowContextPreface(result, flowContext);
}

function sosTrustContextCopy(locale: SupportedLocale, phase: 'confirmation' | 'success'): string {
  if (locale === 'es') {
    return phase === 'confirmation'
      ? 'Seguridad: SOS avisa a la red civil conectada, pero no promete rescate ni autoridad oficial. Confirma solo si necesitas registrar el aviso crítico.'
      : 'Confianza contextual: este SOS puede ser corroborado o disputado después; sigue buscando ayuda local segura si puedes.';
  }

  return phase === 'confirmation'
    ? 'Safety: SOS notifies the connected civil network, but it does not promise rescue or official authority. Confirm only if you need to register the critical alert.'
    : 'Contextual trust: this SOS can be corroborated or disputed later; keep seeking safe local help if you can.';
}

async function startSosIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramSosPorts,
  locale: ReturnType<typeof resolveTelegramLocale>,
): Promise<TelegramSosFlowResult> {
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.sos.user.required') };

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.sos.no.incidents') };
    return {
      state: { step: 'awaitingIncident', incidents, externalUserId, displayName: getTelegramDisplayName(update), preferredLocale: locale },
      responseText: formatMessage(locale, 'telegram.sos.start', { incidentList: formatIncidentList(incidents) }),
    };
  } catch {
    return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.sos.incidents_load_failed') };
  }
}

function withTelegramSosFlowContextPreface(
  result: TelegramSosFlowResult,
  flowContext?: TelegramSosFlowContext,
): TelegramSosFlowResult {
  const locale = getPreferredLocaleFromState(result.state) ?? flowContext?.preferredLocale ?? 'es';
  const contextText = buildTelegramSosIntentContext(flowContext?.facts ?? null, locale);
  return contextText ? { ...result, responseText: `${contextText}\n\n${result.responseText}` } : result;
}

function buildTelegramSosIntentContext(facts: TelegramSosFlowContext['facts'], locale: SupportedLocale): string | null {
  const parsed = TelegramSosIntentFactsSchema.safeParse(facts ?? {});
  if (!parsed.success) return null;

  const summary = formatSosFactsSummary(locale, parsed.data);
  if (!summary) return null;

  return locale === 'es'
    ? `Resumen seguro detectado:\n${summary}\nEstos datos se muestran solo en este mensaje inicial y no se guardan hasta que completes la confirmación SOS.`
    : `Safe detected summary:\n${summary}\nThese details are shown only in this initial message and are not stored until you complete SOS confirmation.`;
}

function formatSosFactsSummary(locale: SupportedLocale, facts: TelegramSosIntentFacts): string | null {
  const labels = locale === 'es'
    ? { severity: 'Gravedad', locationHint: 'Ubicación aproximada', medicalNeed: 'Necesidad médica', peopleCount: 'Personas afectadas', hazardHint: 'Riesgo' }
    : { severity: 'Severity', locationHint: 'Location hint', medicalNeed: 'Medical need', peopleCount: 'People affected', hazardHint: 'Hazard hint' };

  const lines = [
    facts.severity && facts.severity !== 'other' ? `${labels.severity}: ${facts.severity}` : null,
    facts.locationHint ? `${labels.locationHint}: ${facts.locationHint.trim()}` : null,
    facts.medicalNeed ? `${labels.medicalNeed}: ${facts.medicalNeed.trim()}` : null,
    facts.peopleCount ? `${labels.peopleCount}: ${facts.peopleCount}` : null,
    facts.hazardHint ? `${labels.hazardHint}: ${facts.hazardHint.trim()}` : null,
  ].filter(Boolean);

  return lines.length > 0 ? lines.join('\n') : null;
}

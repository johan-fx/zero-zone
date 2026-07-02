import { formatMessage } from '@zona-cero/i18n';

import { SosConnectedCreateRequestSchema } from '@zona-cero/contracts';

import { formatIncidentList, selectIncident } from './incident-selection';
import { getPreferredLocaleFromState, handleTelegramLanguageCommand, resolveTelegramLocale, withPreferredLocale } from './locale';
import { isCancellation, isStrongSosConfirmation } from './parsing';
import { formatSosConfirmation, formatSosError, formatSosSuccess } from './sos-helpers';
import { getTelegramDisplayName, getTelegramExternalUserId, resolveTelegramCommand } from './telegram-update';
import { withTelegramFlowTelemetry } from './telemetry';
import type { TelegramSosFlowResult, TelegramSosPorts, TelegramSosState, TelegramUpdateLike } from './types';

export async function handleTelegramSosFlow(
  state: TelegramSosState,
  update: TelegramUpdateLike,
  ports: TelegramSosPorts,
): Promise<TelegramSosFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;

  return withTelegramFlowTelemetry(
    ports,
    'telegram.sos',
    previousStep,
    startedAt,
    async () => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);
      const locale = resolveTelegramLocale(update, getPreferredLocaleFromState(state));
      const languageResult = handleTelegramLanguageCommand(update, locale);
      if (languageResult) return { state: withPreferredLocale(state, languageResult.locale), responseText: languageResult.responseText };

      if (command === '/cancel') {
        return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.sos.cancelled') };
      }

      if (command === '/sos' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'submitted') {
        return startSosIncidentSelection(update, ports);
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
          responseText: formatSosConfirmation(locale, incident),
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
          return { state: { step: 'submitted', response }, responseText: formatSosSuccess(locale, response) };
        } catch (error) {
          return { state, responseText: formatSosError(locale, error) };
        }
      }

      return { state, responseText: formatMessage(locale, 'telegram.sos.command') };
    },
  );
}

async function startSosIncidentSelection(update: TelegramUpdateLike, ports: TelegramSosPorts): Promise<TelegramSosFlowResult> {
  const locale = resolveTelegramLocale(update);
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

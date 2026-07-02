import { formatMessage, type SupportedLocale } from '@zona-cero/i18n';

import { IncidentJoinRequestSchema } from '@zona-cero/contracts';

import { formatIncidentList, formatJoinSuccess, formatRoles, selectIncident, selectRole } from './incident-selection';
import { getPreferredLocaleFromState, handleTelegramLanguageCommand, resolveTelegramLocale, withPreferredLocale } from './locale';
import { getTelegramExternalUserId, resolveTelegramCommand } from './telegram-update';
import { withTelegramFlowTelemetry } from './telemetry';
import type { TelegramFlowContext, TelegramIncidentJoinFlowResult, TelegramIncidentJoinPorts, TelegramIncidentJoinState, TelegramUpdateLike } from './types';

export async function handleTelegramIncidentJoinFlow(
  state: TelegramIncidentJoinState,
  update: TelegramUpdateLike,
  ports: TelegramIncidentJoinPorts,
  flowContext?: Extract<TelegramFlowContext, { sourceIntent: 'incident_join' }>,
): Promise<TelegramIncidentJoinFlowResult> {
  void flowContext;
  const startedAt = Date.now();
  const previousStep = state.step;

  return withTelegramFlowTelemetry(
    ports,
    'telegram.incident_join',
    previousStep,
    startedAt,
    async () => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);
      const locale = resolveTelegramLocale(update, getPreferredLocaleFromState(state));
      const languageResult = handleTelegramLanguageCommand(update, locale);
      if (languageResult) return { state: withPreferredLocale(state, languageResult.locale), responseText: languageResult.responseText };

      if (command === '/cancel') {
        return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.join.cancelled') };
      }

      if (command === '/start' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'joined') {
        return startIncidentSelection(update, ports, locale);
      }

      if (state.step === 'awaitingIncident') {
        const incident = selectIncident(state.incidents, text);
        if (!incident) {
          return {
            state,
            responseText: formatMessage(locale, 'telegram.error.incident_not_found', { incidentList: formatIncidentList(state.incidents) }),
          };
        }

        return {
          state: { step: 'awaitingPseudonym', incident, externalUserId: state.externalUserId, preferredLocale: locale },
          responseText: formatMessage(locale, 'telegram.join.selected', { incidentName: incident.name }),
        };
      }

      if (state.step === 'awaitingPseudonym') {
        if (!text || text.startsWith('/')) {
          return { state, responseText: formatMessage(locale, 'telegram.join.pseudonym.required') };
        }

        try {
          const config = await ports.getIncidentConfig(state.incident.incidentId);
          if (config.incident.incidentId !== state.incident.incidentId) {
            return { state, responseText: formatMessage(locale, 'telegram.join.config_mismatch') };
          }

          return {
            state: { step: 'awaitingRole', config, externalUserId: state.externalUserId, pseudonym: text, preferredLocale: locale },
            responseText: formatMessage(locale, 'telegram.join.role.choose', { roleList: formatRoles(config.roles) }),
          };
        } catch {
          return { state, responseText: formatMessage(locale, 'telegram.join.roles_load_failed') };
        }
      }

      if (state.step === 'awaitingRole') {
        const role = selectRole(state.config.roles, text);
        if (!role) {
          return { state, responseText: formatMessage(locale, 'telegram.join.role.invalid', { roleList: formatRoles(state.config.roles) }) };
        }

        const request = IncidentJoinRequestSchema.parse({
          channel: 'telegram',
          externalId: state.externalUserId,
          displayName: state.pseudonym,
          role,
          preferredLocale: locale,
        });

        try {
          const response = await ports.joinIncident(state.config.incident.incidentId, request);
          return { state: { step: 'joined', response }, responseText: formatJoinSuccess(locale, response) };
        } catch {
          return { state, responseText: formatMessage(locale, 'telegram.join.error.default') };
        }
      }

      return { state, responseText: formatMessage(locale, 'telegram.join.prompt') };
    },
  );
}


async function startIncidentSelection(update: TelegramUpdateLike, ports: TelegramIncidentJoinPorts, preferredLocale?: SupportedLocale): Promise<TelegramIncidentJoinFlowResult> {
  const locale = resolveTelegramLocale(update, preferredLocale);
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) {
    return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.join.user.required') };
  }

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) {
      return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.error.no_active_incidents') };
    }

    return {
      state: { step: 'awaitingIncident', incidents, externalUserId, preferredLocale: locale },
      responseText: formatMessage(locale, 'telegram.join.start', { incidentList: formatIncidentList(incidents) }),
    };
  } catch {
    return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.error.incidents_load_failed') };
  }
}

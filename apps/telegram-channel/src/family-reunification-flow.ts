import { formatMessage } from '@zona-cero/i18n';

import {
  createFamilyReunificationPrivateLinkRequest,
  formatFamilyReunificationLinkError,
  formatFamilyReunificationLinkSuccess,
  formatFamilyReunificationPrivateUrl,
  isFamilyReunificationCommand,
} from './family-helpers';
import { formatIncidentList, selectIncident } from './incident-selection';
import { getPreferredLocaleFromState, handleTelegramLanguageCommand, resolveTelegramLocale, withPreferredLocale } from './locale';
import { getTelegramDisplayName, getTelegramExternalUserId, resolveTelegramCommand } from './telegram-update';
import { withTelegramFlowTelemetry } from './telemetry';
import type { TelegramFamilyReunificationFlowResult, TelegramFamilyReunificationPorts, TelegramFamilyReunificationState, TelegramFlowContext, TelegramUpdateLike } from './types';

export async function handleTelegramFamilyReunificationFlow(
  state: TelegramFamilyReunificationState,
  update: TelegramUpdateLike,
  ports: TelegramFamilyReunificationPorts,
  flowContext?: Extract<TelegramFlowContext, { sourceIntent: 'family_reunification' }>,
): Promise<TelegramFamilyReunificationFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;

  return withTelegramFlowTelemetry(
    ports,
    'telegram.private_link',
    previousStep,
    startedAt,
    async () => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);
      const contextLocale = flowContext?.preferredLocale;
      const locale = resolveTelegramLocale(update, getPreferredLocaleFromState(state) ?? contextLocale);
      const isNaturalFamilyReunificationIntent = flowContext?.sourceIntent === 'family_reunification' && !isFamilyReunificationCommand(command);
      const languageResult = handleTelegramLanguageCommand(update, locale);
      if (languageResult) return { state: withPreferredLocale(state, languageResult.locale), responseText: languageResult.responseText };

      if (command === '/cancel') {
        return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.family.cancelled') };
      }

      if (isFamilyReunificationCommand(command) || state.step === 'idle' || state.step === 'cancelled' || state.step === 'linked') {
        return startFamilyReunificationIncidentSelection(update, ports, {
          locale,
          messageId: isNaturalFamilyReunificationIntent ? 'telegram.family.intent.start' : 'telegram.family.start',
        });
      }

      if (state.step === 'awaitingIncident') {
        const incident = selectIncident(state.incidents, text);
        if (!incident) {
          return {
            state,
            responseText: formatMessage(locale, 'telegram.error.incident_not_found', { incidentList: formatIncidentList(state.incidents) }),
          };
        }

        const request = createFamilyReunificationPrivateLinkRequest();

        try {
          const response = await ports.createPrivateLink(incident.incidentId, request);
          const url = ports.formatPrivateLinkUrl?.(response) ?? formatFamilyReunificationPrivateUrl(response);
          return {
            state: { step: 'linked', response },
            responseText: formatFamilyReunificationLinkSuccess(locale, url),
          };
        } catch {
          return { state, responseText: formatFamilyReunificationLinkError(locale) };
        }
      }

      return { state, responseText: formatMessage(locale, 'telegram.family.prompt') };
    },
  );
}

async function startFamilyReunificationIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramFamilyReunificationPorts,
  options: {
    locale?: Extract<TelegramFlowContext, { sourceIntent: 'family_reunification' }>['preferredLocale'];
    messageId?: 'telegram.family.start' | 'telegram.family.intent.start';
  } = {},
): Promise<TelegramFamilyReunificationFlowResult> {
  const locale = options.locale ?? resolveTelegramLocale(update);
  const messageId = options.messageId ?? 'telegram.family.start';
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.family.user.required') };

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.family.no.incidents') };
    return {
      state: { step: 'awaitingIncident', incidents, externalUserId, displayName: getTelegramDisplayName(update), preferredLocale: locale },
      responseText: formatMessage(locale, messageId, { incidentList: formatIncidentList(incidents) }),
    };
  } catch {
    return { state: { step: 'idle', preferredLocale: locale }, responseText: formatFamilyReunificationLinkError(locale) };
  }
}

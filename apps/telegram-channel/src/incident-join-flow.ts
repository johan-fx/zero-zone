import { formatMessage, type SupportedLocale } from '@zona-cero/i18n';

import { IncidentJoinRequestSchema, type IncidentRole } from '@zona-cero/contracts';

import { formatIncidentList, formatJoinSuccess, formatRoles, selectIncident, selectIncidentBySafeHint, selectRole } from './incident-selection';
import { getPreferredLocaleFromState, handleTelegramLanguageCommand, resolveTelegramLocale, withPreferredLocale } from './locale';
import { getTelegramExternalUserId, resolveTelegramCommand } from './telegram-update';
import { withTelegramFlowTelemetry } from './telemetry';
import type { TelegramFlowContext, TelegramIncidentJoinFlowResult, TelegramIncidentJoinPorts, TelegramIncidentJoinState, TelegramUpdateLike } from './types';

type TelegramIncidentJoinFlowContext = Extract<TelegramFlowContext, { sourceIntent: 'incident_join' }>;

export async function handleTelegramIncidentJoinFlow(
  state: TelegramIncidentJoinState,
  update: TelegramUpdateLike,
  ports: TelegramIncidentJoinPorts,
  flowContext?: TelegramIncidentJoinFlowContext,
): Promise<TelegramIncidentJoinFlowResult> {
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
      const locale = resolveTelegramLocale(update, getPreferredLocaleFromState(state) ?? flowContext?.facts?.localeHint ?? flowContext?.preferredLocale);
      const languageResult = handleTelegramLanguageCommand(update, locale);
      if (languageResult) return { state: withPreferredLocale(state, languageResult.locale), responseText: languageResult.responseText };

      if (command === '/cancel') {
        return { state: { step: 'cancelled' }, responseText: formatMessage(locale, 'telegram.join.cancelled') };
      }

      if (command === '/start' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'joined') {
        return startIncidentSelection(update, ports, locale, flowContext);
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
          state: {
            step: 'awaitingPseudonym',
            incident,
            externalUserId: state.externalUserId,
            preferredLocale: locale,
            displayNameHint: state.displayNameHint,
            desiredRole: state.desiredRole,
          },
          responseText: formatPseudonymPrompt(locale, incident.name, state.displayNameHint),
        };
      }

      if (state.step === 'awaitingPseudonym') {
        const pseudonym = resolvePseudonymInput(text, state.displayNameHint);
        if (!pseudonym) {
          return { state, responseText: formatMessage(locale, 'telegram.join.pseudonym.required') };
        }

        try {
          const config = await ports.getIncidentConfig(state.incident.incidentId);
          if (config.incident.incidentId !== state.incident.incidentId) {
            return { state, responseText: formatMessage(locale, 'telegram.join.config_mismatch') };
          }

          return {
            state: {
              step: 'awaitingRole',
              config,
              externalUserId: state.externalUserId,
              pseudonym,
              preferredLocale: locale,
              desiredRole: state.desiredRole,
            },
            responseText: formatRolePrompt(locale, config.roles, state.desiredRole),
          };
        } catch {
          return { state, responseText: formatMessage(locale, 'telegram.join.roles_load_failed') };
        }
      }

      if (state.step === 'awaitingRole') {
        const role = resolveRoleInput(state.config.roles, text, state.desiredRole);
        if (!role) {
          return { state, responseText: formatRoleInvalidPrompt(locale, state.config.roles, state.desiredRole) };
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


async function startIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramIncidentJoinPorts,
  preferredLocale?: SupportedLocale,
  flowContext?: TelegramIncidentJoinFlowContext,
): Promise<TelegramIncidentJoinFlowResult> {
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

    const displayNameHint = flowContext?.facts?.displayNameHint?.trim() || undefined;
    const desiredRole = flowContext?.facts?.desiredRole;
    const incidentHintSelection = selectIncidentBySafeHint(incidents, flowContext?.facts?.incidentHint);
    if (incidentHintSelection.status === 'single') {
      return {
        state: {
          step: 'awaitingPseudonym',
          incident: incidentHintSelection.incident,
          externalUserId,
          preferredLocale: locale,
          displayNameHint,
          desiredRole,
        },
        responseText: formatPseudonymPrompt(locale, incidentHintSelection.incident.name, displayNameHint),
      };
    }

    const incidentList = formatIncidentList(incidentHintSelection.status === 'ambiguous' ? incidentHintSelection.incidents : incidents);
    return {
      state: { step: 'awaitingIncident', incidents, externalUserId, preferredLocale: locale, displayNameHint, desiredRole },
      responseText: incidentHintSelection.status === 'ambiguous'
        ? formatMessage(locale, 'telegram.join.incident_hint.ambiguous', { incidentList })
        : formatMessage(locale, 'telegram.join.start', { incidentList }),
    };
  } catch {
    return { state: { step: 'idle', preferredLocale: locale }, responseText: formatMessage(locale, 'telegram.error.incidents_load_failed') };
  }
}

function formatPseudonymPrompt(locale: SupportedLocale, incidentName: string, displayNameHint?: string): string {
  return displayNameHint
    ? formatMessage(locale, 'telegram.join.pseudonym.candidate', { incidentName, displayNameHint })
    : formatMessage(locale, 'telegram.join.selected', { incidentName });
}

function formatRolePrompt(locale: SupportedLocale, roles: IncidentRole[], desiredRole?: IncidentRole): string {
  return desiredRole && roles.includes(desiredRole)
    ? formatMessage(locale, 'telegram.join.role.candidate', { desiredRole, roleList: formatRoles(roles) })
    : formatMessage(locale, 'telegram.join.role.choose', { roleList: formatRoles(roles) });
}

function formatRoleInvalidPrompt(locale: SupportedLocale, roles: IncidentRole[], desiredRole?: IncidentRole): string {
  return desiredRole && roles.includes(desiredRole)
    ? formatMessage(locale, 'telegram.join.role.candidate.invalid', { desiredRole, roleList: formatRoles(roles) })
    : formatMessage(locale, 'telegram.join.role.invalid', { roleList: formatRoles(roles) });
}

function resolvePseudonymInput(text: string, displayNameHint?: string): string | null {
  if (!text || text.startsWith('/')) return null;
  if (displayNameHint && isConfirmation(text)) return displayNameHint;
  return text;
}

function resolveRoleInput(roles: IncidentRole[], text: string, desiredRole?: IncidentRole): IncidentRole | null {
  if (desiredRole && roles.includes(desiredRole) && isConfirmation(text)) return desiredRole;
  if (desiredRole && isRejection(text)) return null;
  return selectRole(roles, text);
}

function isConfirmation(text: string): boolean {
  return /^(yes|y|si|sí|confirm|confirmar|ok|vale)$/i.test(text.trim());
}

function isRejection(text: string): boolean {
  return /^(no|n)$/i.test(text.trim());
}

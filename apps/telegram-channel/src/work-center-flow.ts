import { formatMessage } from '@zona-cero/i18n';

import { WorkCenterConnectedCreateRequestSchema } from '@zona-cero/contracts';

import { formatIncidentList, selectIncident } from './incident-selection';
import { isCancellation, isConfirmation } from './parsing';
import { resolveTelegramLocale } from './locale';
import { getTelegramDisplayName, getTelegramExternalUserId, resolveTelegramCommand } from './telegram-update';
import { withTelegramFlowTelemetry } from './telemetry';
import type { TelegramUpdateLike, TelegramWorkCenterReportFlowResult, TelegramWorkCenterReportPorts, TelegramWorkCenterReportState } from './types';
import { formatWorkCenterReportError, formatWorkCenterReportSuccess, getTelegramChannelLimitation } from './work-center-helpers';

export async function handleTelegramWorkCenterReportFlow(
  state: TelegramWorkCenterReportState,
  update: TelegramUpdateLike,
  ports: TelegramWorkCenterReportPorts,
): Promise<TelegramWorkCenterReportFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;

  return withTelegramFlowTelemetry(
    ports,
    'telegram.work_center',
    previousStep,
    startedAt,
    async () => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);
      const locale = resolveTelegramLocale(update);

      if (command === '/cancel') {
        return { state: { step: 'cancelled' }, responseText: 'Work center report cancelled. Send /workcenter to begin again.' };
      }

      if (command === '/workcenter' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'reported') {
        return startWorkCenterIncidentSelection(update, ports);
      }

      if (state.step === 'awaitingIncident') {
        const incident = selectIncident(state.incidents, text);
        if (!incident) {
          return {
            state,
            responseText: formatMessage(locale, 'telegram.error.incident_not_found', { incidentList: formatIncidentList(state.incidents) }),
          };
        }

        const limitation = await getTelegramChannelLimitation(ports, incident.incidentId, locale);

        return {
          state: {
            step: 'awaitingName',
            incident,
            externalUserId: state.externalUserId,
            displayName: state.displayName,
          },
          responseText: [limitation, 'Send the work center name. Use /cancel to stop.'].filter(Boolean).join('\n'),
        };
      }

      if (state.step === 'awaitingName') {
        if (!text || text.startsWith('/')) {
          return { state, responseText: 'Work center name is required. Send a visible name, or /cancel to stop.' };
        }

        const parsed = WorkCenterConnectedCreateRequestSchema.safeParse({
          channel: 'telegram',
          externalId: state.externalUserId,
          displayName: state.displayName,
          payload: { name: text },
        });

        if (!parsed.success) {
          return { state, responseText: 'Invalid work center report. Send a non-empty work center name, or /cancel to stop.' };
        }

        return {
          state: {
            step: 'awaitingConfirmation',
            incident: state.incident,
            externalUserId: state.externalUserId,
            displayName: state.displayName,
            request: parsed.data,
          },
          responseText: `Confirm work center report:\nIncident: ${state.incident.name}\nName: ${parsed.data.payload.name}\nReply yes to submit, or /cancel to stop.`,
        };
      }

      if (state.step === 'awaitingConfirmation') {
        if (isCancellation(text)) {
          return { state: { step: 'cancelled' }, responseText: 'Work center report cancelled. Send /workcenter to begin again.' };
        }

        if (!isConfirmation(text)) {
          return { state, responseText: 'Reply yes to submit the work center report, no to cancel, or /cancel to stop.' };
        }

        try {
          const response = await ports.createWorkCenter(state.incident.incidentId, state.request);
          return { state: { step: 'reported', response }, responseText: formatWorkCenterReportSuccess(response) };
        } catch (error) {
          return { state, responseText: formatWorkCenterReportError(error) };
        }
      }

      return { state, responseText: 'Send /workcenter to begin the work center report flow.' };
    },
  );
}


async function startWorkCenterIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramWorkCenterReportPorts,
): Promise<TelegramWorkCenterReportFlowResult> {
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) {
    return { state: { step: 'idle' }, responseText: 'Telegram user id is required to report a work center.' };
  }

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) {
      return { state: { step: 'idle' }, responseText: 'No active incidents are available right now.' };
    }

    return {
      state: {
        step: 'awaitingIncident',
        incidents,
        externalUserId,
        displayName: getTelegramDisplayName(update),
      },
      responseText: `Choose an incident before reporting a work center:\n${formatIncidentList(incidents)}`,
    };
  } catch {
    return { state: { step: 'idle' }, responseText: 'Could not load incidents from the backend. Please try again later.' };
  }

}

import { formatMessage, type SupportedLocale } from '@zona-cero/i18n';

import { WorkCenterConnectedCreateRequestSchema, type TelegramWorkCenterIntentFacts, type WorkCenterConnectedCreateRequest, type WorkCenterLocation } from '@zona-cero/contracts';

import { formatIncidentList, selectIncident } from './incident-selection';
import { isCancellation, isConfirmation } from './parsing';
import { resolveTelegramLocale } from './locale';
import { getTelegramDisplayName, getTelegramExternalUserId, resolveTelegramCommand } from './telegram-update';
import { withTelegramFlowTelemetry } from './telemetry';
import type { TelegramFlowContext, TelegramNativeLocation, TelegramUpdateLike, TelegramWorkCenterPrefill, TelegramWorkCenterReportFlowResult, TelegramWorkCenterReportPorts, TelegramWorkCenterReportState } from './types';
import { formatWorkCenterReportError, formatWorkCenterReportSuccess, getTelegramChannelLimitation } from './work-center-helpers';

type TelegramWorkCenterFlowContext = Extract<TelegramFlowContext, { sourceIntent: 'workcenter' }>;

export async function handleTelegramWorkCenterReportFlow(
  state: TelegramWorkCenterReportState,
  update: TelegramUpdateLike,
  ports: TelegramWorkCenterReportPorts,
  flowContext?: TelegramWorkCenterFlowContext,
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
      const locale = resolveTelegramLocale(update, flowContext?.preferredLocale);
      const nativeLocation = parseTelegramNativeLocation(update.message?.location);
      const contextPrefill = state.step === 'awaitingIncident' || state.step === 'awaitingName' ? state.prefill : buildSafeWorkCenterPrefill(flowContext);
      const prefill = mergeWorkCenterPrefill(contextPrefill, nativeLocation);

      if (command === '/cancel') {
        return { state: { step: 'cancelled' }, responseText: workCenterCopy(locale, 'cancelled') };
      }

      if (command === '/workcenter' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'reported') {
        return startWorkCenterIncidentSelection(update, ports, prefill);
      }

      if (state.step === 'awaitingIncident') {
        if (nativeLocation && !text) {
          return {
            state: { ...state, prefill },
            responseText: `Location saved for this work center. Choose an incident before continuing:\n${formatIncidentList(state.incidents)}`,
          };
        }

        const incident = selectIncident(state.incidents, text);
        if (!incident) {
          return {
            state,
            responseText: formatMessage(locale, 'telegram.error.incident_not_found', { incidentList: formatIncidentList(state.incidents) }),
          };
        }

        const limitation = await getTelegramChannelLimitation(ports, incident.incidentId, locale);
        const baseState = {
          incident,
          externalUserId: state.externalUserId,
          displayName: state.displayName,
        };

        if (prefill?.name) {
          const request = buildWorkCenterRequest(state.externalUserId, state.displayName, prefill);
          if (request) {
            return {
              state: { step: 'awaitingConfirmation', ...baseState, request },
              responseText: [limitation, formatWorkCenterReportConfirmation(locale, incident.name, request), trustContextCopy(locale, 'confirmation')].filter(Boolean).join('\n'),
            };
          }
        }

        return {
          state: {
            step: 'awaitingName',
            ...baseState,
            ...(prefill ? { prefill } : {}),
          },
          responseText: [limitation, workCenterCopy(locale, prefill ? 'nameMissingWithPrefill' : 'namePrompt')].filter(Boolean).join('\n'),
        };
      }

      if (state.step === 'awaitingName') {
        if (!text || text.startsWith('/')) {
          return {
            state: nativeLocation ? { ...state, prefill } : state,
            responseText: nativeLocation ? workCenterCopy(locale, 'locationSavedNameRequired') : workCenterCopy(locale, 'nameRequired'),
          };
        }

        const request = buildWorkCenterRequest(state.externalUserId, state.displayName, { ...prefill, name: text });

        if (!request) {
          return { state, responseText: workCenterCopy(locale, 'invalid') };
        }

        return {
          state: {
            step: 'awaitingConfirmation',
            incident: state.incident,
            externalUserId: state.externalUserId,
            displayName: state.displayName,
            request,
          },
          responseText: [formatWorkCenterReportConfirmation(locale, state.incident.name, request), trustContextCopy(locale, 'confirmation')].join('\n'),
        };
      }

      if (state.step === 'awaitingConfirmation') {
        if (isCancellation(text)) {
          return { state: { step: 'cancelled' }, responseText: workCenterCopy(locale, 'cancelled') };
        }

        if (!isConfirmation(text)) {
          if (nativeLocation) {
            const request = buildWorkCenterRequest(state.externalUserId, state.displayName, { ...state.request.payload, location: nativeLocation });
            if (request) {
              return {
                state: { ...state, request },
                responseText: [formatWorkCenterReportConfirmation(locale, state.incident.name, request), trustContextCopy(locale, 'confirmation')].join('\n'),
              };
            }
          }

          const correctedName = parseNameCorrection(text);
          if (correctedName) {
            const request = buildWorkCenterRequest(state.externalUserId, state.displayName, { ...state.request.payload, name: correctedName });
            if (request) {
              return {
                state: { ...state, request },
                responseText: [formatWorkCenterReportConfirmation(locale, state.incident.name, request), trustContextCopy(locale, 'confirmation')].join('\n'),
              };
            }
          }

          return { state, responseText: workCenterCopy(locale, 'confirmationRequired') };
        }

        try {
          const response = await ports.createWorkCenter(state.incident.incidentId, state.request);
          return { state: { step: 'reported', response }, responseText: `${formatWorkCenterReportSuccess(response)}\n${trustContextCopy(locale, 'success')}` };
        } catch (error) {
          return { state, responseText: formatWorkCenterReportError(error) };
        }
      }

      return { state, responseText: workCenterCopy(locale, 'startPrompt') };
    },
  );
}


async function startWorkCenterIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramWorkCenterReportPorts,
  prefill?: TelegramWorkCenterPrefill,
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
        ...(prefill ? { prefill } : {}),
      },
      responseText: `Choose an incident before reporting a work center:\n${formatIncidentList(incidents)}`,
    };
  } catch {
    return { state: { step: 'idle' }, responseText: 'Could not load incidents from the backend. Please try again later.' };
  }

}

function mergeWorkCenterPrefill(prefill: TelegramWorkCenterPrefill | undefined, location: WorkCenterLocation | null): TelegramWorkCenterPrefill | undefined {
  if (!location) return prefill;
  return { ...prefill, location };
}

function buildSafeWorkCenterPrefill(flowContext?: TelegramWorkCenterFlowContext): TelegramWorkCenterPrefill | undefined {
  const source = flowContext?.prefill ?? {};
  const prefill: TelegramWorkCenterPrefill = {};

  if (isSafeFactText(source.name, 120)) prefill.name = source.name.trim();
  if (isSafeFactText(source.locationHint, 160)) prefill.description = `Location hint: ${source.locationHint.trim()}`;
  if (isWorkCenterPriority(source.priority)) prefill.priority = source.priority;
  if (isSafeFactText(source.initialNeed, 160)) prefill.initialNeed = source.initialNeed.trim();
  if (isSafeFactText(source.surplus, 160)) prefill.surplus = source.surplus.trim();

  return Object.keys(prefill).length > 0 ? prefill : undefined;
}

function buildWorkCenterRequest(
  externalUserId: string,
  displayName: string | undefined,
  prefill: TelegramWorkCenterPrefill,
): WorkCenterConnectedCreateRequest | null {
  const parsed = WorkCenterConnectedCreateRequestSchema.safeParse({
    channel: 'telegram',
    externalId: externalUserId,
    displayName,
    payload: prefill,
  });

  return parsed.success ? parsed.data : null;
}

function formatWorkCenterReportConfirmation(locale: SupportedLocale, incidentName: string, request: WorkCenterConnectedCreateRequest): string {
  const labels = locale === 'es'
    ? { title: 'Confirma el reporte de puesto de trabajo:', incident: 'Incidente', name: 'Nombre', description: 'Ubicación aproximada', coordinates: 'Coordenadas aproximadas', priority: 'Prioridad', initialNeed: 'Necesidad inicial', surplus: 'Sobrante', confirm: 'Responde sí para enviar, escribe "nombre: nuevo nombre" para corregir, o /cancel para detener.' }
    : { title: 'Confirm work center report:', incident: 'Incident', name: 'Name', description: 'Location hint', coordinates: 'Approximate coordinates', priority: 'Priority', initialNeed: 'Initial need', surplus: 'Surplus', confirm: 'Reply yes to submit, type "name: new name" to correct, or /cancel to stop.' };

  const payload = request.payload;
  return [
    labels.title,
    `${labels.incident}: ${incidentName}`,
    `${labels.name}: ${payload.name}`,
    payload.description ? `${labels.description}: ${payload.description.replace(/^Location hint: /, '')}` : null,
    payload.location ? `${labels.coordinates}: ${formatApproximateCoordinates(payload.location)}` : null,
    `${labels.priority}: ${payload.priority}`,
    payload.initialNeed ? `${labels.initialNeed}: ${payload.initialNeed}` : null,
    payload.surplus ? `${labels.surplus}: ${payload.surplus}` : null,
    labels.confirm,
  ].filter(Boolean).join('\n');
}

function trustContextCopy(locale: SupportedLocale, phase: 'confirmation' | 'success'): string {
  if (locale === 'es') {
    return phase === 'confirmation'
      ? 'Confianza contextual: este punto empezará como información civil pendiente de corroboración. No representa autoridad oficial ni rescate garantizado.'
      : 'Confianza contextual: otras personas pueden corroborar o disputar este punto; usa el estado del servidor como señal, no como garantía.';
  }

  return phase === 'confirmation'
    ? 'Contextual trust: this point starts as civil information pending corroboration. It is not official authority or guaranteed rescue.'
    : 'Contextual trust: others can corroborate or dispute this point; use the server state as a signal, not a guarantee.';
}

function parseTelegramNativeLocation(location: TelegramNativeLocation | undefined): WorkCenterLocation | null {
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') return null;
  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  if (location.latitude < -90 || location.latitude > 90 || location.longitude < -180 || location.longitude > 180) return null;

  return { latitude: location.latitude, longitude: location.longitude };
}

function formatApproximateCoordinates(location: WorkCenterLocation): string {
  return `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
}

function parseNameCorrection(text: string): string | null {
  const match = /^(?:name|nombre)\s*:\s*(.+)$/i.exec(text.trim());
  const value = match?.[1]?.trim();
  return value && !value.startsWith('/') ? value : null;
}

function isSafeFactText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isWorkCenterPriority(value: unknown): value is NonNullable<TelegramWorkCenterIntentFacts['priority']> {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical';
}

function workCenterCopy(locale: SupportedLocale, key: 'cancelled' | 'namePrompt' | 'nameMissingWithPrefill' | 'nameRequired' | 'locationSavedNameRequired' | 'invalid' | 'confirmationRequired' | 'startPrompt'): string {
  const copy = {
    en: {
      cancelled: 'Work center report cancelled. Send /workcenter to begin again.',
      namePrompt: 'Send the work center name. Use /cancel to stop.',
      nameMissingWithPrefill: 'I have the details. Send only the work center name, or /cancel to stop.',
      nameRequired: 'Work center name is required. Send a visible name, or /cancel to stop.',
      locationSavedNameRequired: 'Location saved. Send a visible work center name, or /cancel to stop.',
      invalid: 'Invalid work center report. Send a non-empty work center name, or /cancel to stop.',
      confirmationRequired: 'Reply yes to submit the work center report, no to cancel, type "name: new name" to correct, or /cancel to stop.',
      startPrompt: 'Send /workcenter to begin the work center report flow.',
    },
    es: {
      cancelled: 'Reporte de puesto de trabajo cancelado. Envía /workcenter para empezar de nuevo.',
      namePrompt: 'Envía el nombre del puesto de trabajo. Usa /cancel para detener.',
      nameMissingWithPrefill: 'Ya tengo los detalles. Envía solo el nombre del puesto de trabajo, o /cancel para detener.',
      nameRequired: 'El nombre del puesto de trabajo es obligatorio. Envía un nombre visible, o /cancel para detener.',
      locationSavedNameRequired: 'Ubicación guardada. Envía un nombre visible del puesto de trabajo, o /cancel para detener.',
      invalid: 'Reporte de puesto de trabajo inválido. Envía un nombre no vacío, o /cancel para detener.',
      confirmationRequired: 'Responde sí para enviar el reporte, no para cancelar, escribe "nombre: nuevo nombre" para corregir, o /cancel para detener.',
      startPrompt: 'Envía /workcenter para iniciar el reporte de puesto de trabajo.',
    },
  } as const;

  return copy[locale][key];
}

import { DispatchTaskConnectedUpdateRequestSchema } from '@zona-cero/contracts';

import { formatIncidentList, selectIncident } from './incident-selection';
import { formatDispatchTaskError, formatDispatchTaskList, formatDispatchTaskSuccess, normalizeDispatchStatusText, orderDispatchTaskCandidates, selectDispatchTask } from './dispatch-helpers';
import { isCancellation, isConfirmation, parseDispatchStatus } from './parsing';
import { getTelegramExternalUserId, resolveTelegramCommand } from './telegram-update';
import { withTelegramFlowTelemetry } from './telemetry';
import type { TelegramDispatchTaskFlowResult, TelegramDispatchTaskPorts, TelegramDispatchTaskPrefill, TelegramDispatchTaskState, TelegramFlowContext, TelegramUpdateLike } from './types';

export async function handleTelegramDispatchTaskFlow(
  state: TelegramDispatchTaskState,
  update: TelegramUpdateLike,
  ports: TelegramDispatchTaskPorts,
  flowContext?: Extract<TelegramFlowContext, { sourceIntent: 'dispatch' }>,
): Promise<TelegramDispatchTaskFlowResult> {
  const startedAt = Date.now();
  const previousStep = state.step;
  const contextPrefill = createDispatchTaskPrefill(flowContext);

  return withTelegramFlowTelemetry(
    ports,
    'telegram.dispatch_task',
    previousStep,
    startedAt,
    async () => {
      const text = update.message?.text?.trim() ?? '';
      const command = resolveTelegramCommand(update);

      if (command === '/cancel') return { state: { step: 'cancelled' }, responseText: 'Dispatch task update cancelled. Send /dispatch to begin again.' };
      if (command === '/dispatch' || state.step === 'idle' || state.step === 'cancelled' || state.step === 'updated') return startDispatchIncidentSelection(update, ports, contextPrefill);

      if (state.step === 'awaitingIncident') {
        const prefill = mergeDispatchTaskPrefill(state.prefill, contextPrefill);
        const incident = selectIncident(state.incidents, text);
        if (!incident) return { state, responseText: `Incident not found. Reply with a number or incident id from the list.
      ${formatIncidentList(state.incidents)}` };
        try {
          const { dispatchTasks } = await ports.listDispatchTasks(incident.incidentId);
          if (dispatchTasks.length === 0) return { state: { step: 'idle' }, responseText: 'No dispatch tasks are available for this incident.' };
          const orderedTasks = orderDispatchTaskCandidates(dispatchTasks, prefill);
          return { state: { step: 'awaitingTask', incident, tasks: orderedTasks, externalUserId: state.externalUserId, ...(prefill ? { prefill } : {}) }, responseText: `Choose a dispatch task:
      ${formatDispatchTaskList(orderedTasks)}` };
        } catch {
          return { state, responseText: 'Could not load dispatch tasks from the backend. Please try again later.' };
        }
      }

      if (state.step === 'awaitingTask') {
        const prefill = mergeDispatchTaskPrefill(state.prefill, contextPrefill);
        const task = selectDispatchTask(state.tasks, text);
        if (!task) return { state, responseText: `Dispatch task not found. Reply with a number or task id.
      ${formatDispatchTaskList(state.tasks)}` };
        const statusCandidate = getUsableStatusCandidate(prefill);
        if (statusCandidate) return confirmDispatchTaskStatus(state.incident, task, state.externalUserId, statusCandidate);
        return { state: { step: 'awaitingStatus', incident: state.incident, task, externalUserId: state.externalUserId }, responseText: 'Reply with the new status: accepted, en_route, delivered, or cancelled.' };
      }

      if (state.step === 'awaitingStatus') {
        const status = getUsableStatusCandidate(contextPrefill) ?? parseDispatchStatus(normalizeDispatchStatusText(text));
        if (!status || status === 'pending') return { state, responseText: 'Invalid status. Reply accepted, en_route, delivered, or cancelled.' };
        return confirmDispatchTaskStatus(state.incident, state.task, state.externalUserId, status);
      }

      if (state.step === 'awaitingConfirmation') {
        if (isCancellation(text)) return { state: { step: 'cancelled' }, responseText: 'Dispatch task update cancelled. Send /dispatch to begin again.' };
        if (!isConfirmation(text)) return { state, responseText: 'Reply yes to update the dispatch task, no to cancel, or /cancel to stop.' };
        try {
          const response = await ports.updateDispatchTask(state.incident.incidentId, state.task.dispatchTaskId, state.request);
          return { state: { step: 'updated', response }, responseText: formatDispatchTaskSuccess(response) };
        } catch (error) {
          return { state, responseText: formatDispatchTaskError(error) };
        }
      }

      return { state, responseText: 'Send /dispatch to begin the dispatch task flow.' };
    },
  );
}

async function startDispatchIncidentSelection(
  update: TelegramUpdateLike,
  ports: TelegramDispatchTaskPorts,
  prefill?: TelegramDispatchTaskPrefill,
): Promise<TelegramDispatchTaskFlowResult> {
  const externalUserId = getTelegramExternalUserId(update);
  if (!externalUserId) return { state: { step: 'idle' }, responseText: 'Telegram user id is required to update dispatch tasks.' };

  try {
    const { incidents } = await ports.listIncidents();
    if (incidents.length === 0) return { state: { step: 'idle' }, responseText: 'No active incidents are available right now.' };
    return { state: { step: 'awaitingIncident', incidents, externalUserId, ...(prefill ? { prefill } : {}) }, responseText: `Choose an incident before updating dispatch tasks:
${formatIncidentList(incidents)}` };
  } catch {
    return { state: { step: 'idle' }, responseText: 'Could not load incidents from the backend. Please try again later.' };
  }
}

function confirmDispatchTaskStatus(
  incident: Extract<TelegramDispatchTaskState, { step: 'awaitingStatus' }>['incident'],
  task: Extract<TelegramDispatchTaskState, { step: 'awaitingStatus' }>['task'],
  externalUserId: string,
  status: Exclude<ReturnType<typeof parseDispatchStatus>, null | 'pending'>,
): TelegramDispatchTaskFlowResult {
  const request = DispatchTaskConnectedUpdateRequestSchema.parse({ channel: 'telegram', externalId: externalUserId, status });
  return {
    state: { step: 'awaitingConfirmation', incident, task, externalUserId, request },
    responseText: `Confirm dispatch task update:
      Task: ${task.dispatchTaskId}
      Status: ${status}
      Reply yes to submit, or /cancel to stop.`,
  };
}

function createDispatchTaskPrefill(flowContext?: Extract<TelegramFlowContext, { sourceIntent: 'dispatch' }>): TelegramDispatchTaskPrefill | undefined {
  if (!flowContext) return undefined;
  return sanitizeDispatchTaskPrefill({ ...(flowContext.facts ?? {}), ...flowContext.prefill });
}

function mergeDispatchTaskPrefill(
  current: TelegramDispatchTaskPrefill | undefined,
  incoming: TelegramDispatchTaskPrefill | undefined,
): TelegramDispatchTaskPrefill | undefined {
  return sanitizeDispatchTaskPrefill({ ...(current ?? {}), ...(incoming ?? {}) });
}

function sanitizeDispatchTaskPrefill(value: TelegramDispatchTaskPrefill): TelegramDispatchTaskPrefill | undefined {
  const prefill: TelegramDispatchTaskPrefill = {};
  if (value.taskHint) prefill.taskHint = value.taskHint;
  if (value.category) prefill.category = value.category;
  if (value.quantityApprox) prefill.quantityApprox = value.quantityApprox;
  if (value.destinationHint) prefill.destinationHint = value.destinationHint;
  if (value.status) prefill.status = value.status;
  if (value.statusCandidate) prefill.statusCandidate = value.statusCandidate;
  return Object.keys(prefill).length > 0 ? prefill : undefined;
}

function getUsableStatusCandidate(prefill?: TelegramDispatchTaskPrefill): Exclude<ReturnType<typeof parseDispatchStatus>, null | 'pending'> | null {
  const candidate = prefill?.statusCandidate ?? prefill?.status;
  const status = parseDispatchStatus(candidate);
  return status && status !== 'pending' ? status : null;
}

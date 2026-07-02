import type { DispatchTask, DispatchTaskResponse } from '@zona-cero/contracts';

import { readErrorCode } from './parsing';

export function normalizeDispatchStatusText(text: string): string {
  const normalized = text.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_');
  if (['accept', 'accepted', 'aceptar', 'aceptada', 'aceptado'].includes(normalized)) return 'accepted';
  if (['en_camino', 'en_route', 'route'].includes(normalized)) return 'en_route';
  if (['delivered', 'entregada', 'entregado'].includes(normalized)) return 'delivered';
  if (['cancel', 'cancelled', 'canceled', 'cancelada', 'cancelado'].includes(normalized)) return 'cancelled';
  return normalized;
}

export function selectDispatchTask(tasks: DispatchTask[], text: string): DispatchTask | null {
  const index = Number.parseInt(text, 10);
  if (Number.isInteger(index) && String(index) === text && index >= 1 && index <= tasks.length) return tasks[index - 1] ?? null;
  return tasks.find((task) => task.dispatchTaskId === text) ?? null;
}

export function formatDispatchTaskList(tasks: DispatchTask[]): string {
  return tasks.map((task, index) => `${index + 1}. ${task.category} · ${task.quantityApprox} · ${task.status} (${task.dispatchTaskId})`).join('\n');
}

export function formatDispatchTaskSuccess(response: DispatchTaskResponse): string {
  return [`Dispatch task updated: ${response.dispatchTask.dispatchTaskId}.`, `Status: ${response.dispatchTask.status}`].join('\n');
}

export function formatDispatchTaskError(error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'permission_denied') return 'Permission denied. The backend rejected this dispatch task update.';
  if (code === 'not_found') return 'Dispatch task not found. Send /dispatch and choose an available task.';
  if (code === 'invalid_payload') return 'Invalid dispatch task update. Use a canonical status: accepted, en_route, delivered, or cancelled.';
  return 'Could not update the dispatch task. The backend rejected or failed the request.';
}

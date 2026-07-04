import type { DispatchTask, DispatchTaskResponse } from '@zona-cero/contracts';

import { readErrorCode } from './parsing';
import type { TelegramDispatchTaskPrefill } from './types';

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

export function orderDispatchTaskCandidates(tasks: DispatchTask[], prefill?: TelegramDispatchTaskPrefill): DispatchTask[] {
  if (!prefill || Object.keys(prefill).length === 0) return tasks;

  const ranked = tasks.map((task, index) => ({ task, index, score: scoreDispatchTask(task, prefill) }));
  return ranked.slice().sort((left, right) => right.score - left.score || left.index - right.index).map(({ task }) => task);
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

function scoreDispatchTask(task: DispatchTask, prefill: TelegramDispatchTaskPrefill): number {
  let score = 0;
  const taskHint = normalizeSearchText(prefill.taskHint);
  const category = normalizeSearchText(prefill.category);
  const quantityApprox = normalizeSearchText(prefill.quantityApprox);
  const destinationHint = normalizeSearchText(prefill.destinationHint);
  const statusCandidate = prefill.statusCandidate ?? prefill.status;
  const searchable = normalizeSearchText([
    task.dispatchTaskId,
    task.category,
    task.quantityApprox,
    task.notes,
    task.targetWorkCenterId,
    task.toResourceReportId,
    task.fromResourceReportId,
  ].filter(Boolean).join(' '));

  if (taskHint) {
    if (normalizeSearchText(task.dispatchTaskId) === taskHint) score += 100;
    else if (searchable.includes(taskHint)) score += 45;
    else score += scoreTokenOverlap(searchable, taskHint) * 8;
  }

  if (category) {
    const taskCategory = normalizeSearchText(task.category);
    if (taskCategory === category) score += 35;
    else if (taskCategory.includes(category) || category.includes(taskCategory)) score += 20;
  }

  if (quantityApprox) {
    const taskQuantity = normalizeSearchText(task.quantityApprox);
    if (taskQuantity === quantityApprox) score += 25;
    else if (taskQuantity.includes(quantityApprox) || quantityApprox.includes(taskQuantity)) score += 14;
    else score += scoreTokenOverlap(taskQuantity, quantityApprox) * 3;
  }

  if (destinationHint) {
    const destinationSearchable = normalizeSearchText([task.targetWorkCenterId, task.toResourceReportId, task.notes].filter(Boolean).join(' '));
    if (destinationSearchable.includes(destinationHint)) score += 30;
    else score += scoreTokenOverlap(destinationSearchable, destinationHint) * 5;
  }

  if (statusCandidate && statusCandidate !== 'pending') {
    score += task.status === statusCandidate ? -4 : 4;
  }

  return score;
}

function normalizeSearchText(value: string | undefined): string {
  return value?.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ') ?? '';
}

function scoreTokenOverlap(haystack: string, needle: string): number {
  const tokens = needle.split(' ').filter((token) => token.length >= 3);
  return tokens.filter((token) => haystack.includes(token)).length;
}

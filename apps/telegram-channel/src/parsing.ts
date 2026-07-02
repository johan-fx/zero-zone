import type { DispatchTaskStatus, ResourceReportKind, ResourceReportUrgency } from '@zona-cero/contracts';

export function parseReportKind(value: unknown): ResourceReportKind | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['needed', 'need', 'necesario', 'necesaria', 'necesarios', 'necesarias', 'necesitado', 'necesitada'].includes(normalized)) return 'needed';
  if (['surplus', 'available', 'offer', 'sobrante', 'sobrantes', 'disponible', 'disponibles', 'oferta'].includes(normalized)) return 'surplus';
  return null;
}

export function parseUrgency(value: unknown): ResourceReportUrgency | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['low', 'baja', 'bajo'].includes(normalized)) return 'low';
  if (['medium', 'media', 'medio'].includes(normalized)) return 'medium';
  if (['high', 'alta', 'alto'].includes(normalized)) return 'high';
  if (['critical', 'critica', 'crítica', 'critico', 'crítico'].includes(normalized)) return 'critical';
  return null;
}

export function parseDispatchStatus(value: unknown): DispatchTaskStatus | null {
  if (value === 'pending' || value === 'accepted' || value === 'en_route' || value === 'delivered' || value === 'cancelled') return value;
  return null;
}

export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length > 0);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const allowedKeys = new Set(keys);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}


export function isConfirmation(text: string): boolean {
  return ['yes', 'y', 'confirm', 'ok', 'si', 'sí', 'confirmar'].includes(text.trim().toLowerCase());
}

export function isCancellation(text: string): boolean {
  return ['no', 'n', 'cancel', 'cancelar'].includes(text.trim().toLowerCase());
}

export function isStrongSosConfirmation(text: string): boolean {
  return text.trim() === 'CONFIRM SOS';
}

export function parseOptionalList(text: string): string[] {
  if (isSkip(text)) return [];
  return text.split(',').map((item) => item.trim()).filter(Boolean);
}

export function isSkip(text: string): boolean {
  return ['skip', 'none', 'no', 'n/a', 'omitir', 'saltar', 'ninguna', 'ninguno'].includes(text.trim().toLowerCase());
}

export function readErrorCode(error: unknown): string | null {
  if (!isRecord(error)) {
    return null;
  }

  if (typeof error.code === 'string') {
    return error.code;
  }

  if (typeof error.error === 'string') {
    return error.error;
  }

  return null;
}

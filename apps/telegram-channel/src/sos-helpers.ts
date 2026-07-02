import { type SupportedLocale, formatMessage } from '@zona-cero/i18n';

import type { IncidentSummary, SosAlertCreateResponse } from '@zona-cero/contracts';

import { readErrorCode } from './parsing';
export function formatSosConfirmation(locale: SupportedLocale, incident: IncidentSummary): string {
  return formatMessage(locale, 'telegram.sos.confirmation', { incidentName: incident.name });
}

export function formatSosSuccess(locale: SupportedLocale, response: SosAlertCreateResponse): string {
  return formatMessage(locale, 'telegram.sos.success', {
    sosAlertId: response.sosAlert.sosAlertId,
    status: response.sosAlert.status,
    total: response.fanout.total,
    queued: response.fanout.queued,
    pending: response.fanout.pending,
    failed: response.fanout.failed,
    cancelled: response.fanout.cancelled,
  });
}

export function formatSosError(locale: SupportedLocale, error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'permission_denied') return formatMessage(locale, 'telegram.sos.error.permission_denied');
  if (code === 'not_found') return formatMessage(locale, 'telegram.sos.error.not_found');
  if (code === 'invalid_payload') return formatMessage(locale, 'telegram.sos.error.invalid_payload');
  return formatMessage(locale, 'telegram.sos.error.default');
}

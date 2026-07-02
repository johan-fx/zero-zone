import { type SupportedLocale, formatMessage } from '@zona-cero/i18n';

import type { SyncFreshness, WorkCenterCreateResponse } from '@zona-cero/contracts';

import { readErrorCode } from './parsing';
import type { TelegramWorkCenterReportPorts } from './types';

export function formatTelegramChannelLimitation(freshness: SyncFreshness, locale: SupportedLocale = 'es'): string | null {
  if (freshness.status === 'fresh' && freshness.cursorLag === 0 && !freshness.hasConflicts) return null;

  const details: string[] = [];
  if (freshness.cursorLag > 0) details.push(formatMessage(locale, 'telegram.freshness.cursor_lag', { count: freshness.cursorLag }));
  if (freshness.hasConflicts) details.push(formatMessage(locale, 'telegram.freshness.conflicts'));

  const suffix = details.length > 0 ? ` ${details.join('; ')}.` : '';

  if (freshness.status === 'missing') return formatMessage(locale, 'telegram.freshness.missing', { suffix });
  if (freshness.status === 'expired') return formatMessage(locale, 'telegram.freshness.expired', { suffix });
  return formatMessage(locale, 'telegram.freshness.stale', { suffix });
}

export async function getTelegramChannelLimitation(ports: TelegramWorkCenterReportPorts, incidentId: string, locale: SupportedLocale = 'es'): Promise<string | null> {
  if (!ports.getChannelFreshness) return null;

  try {
    return formatTelegramChannelLimitation(await ports.getChannelFreshness(incidentId), locale);
  } catch {
    return formatMessage(locale, 'telegram.freshness.unavailable');
  }
}

export function formatWorkCenterReportSuccess(response: WorkCenterCreateResponse): string {
  return [`Work center reported: ${response.workCenter.name}.`, `Audit: ${response.audit.auditEventId}`].join('\n');
}

export function formatWorkCenterReportError(error: unknown): string {
  const code = readErrorCode(error);
  if (code === 'permission_denied') {
    return 'Permission denied. Join this incident first with /start, then report the work center again.';
  }

  if (code === 'invalid_payload') {
    return 'Invalid work center report. Send /workcenter and try again with a non-empty name.';
  }

  return 'Could not report the work center. The backend rejected or failed the request.';
}

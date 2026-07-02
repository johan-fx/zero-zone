import { formatMessage } from '@zona-cero/i18n';

import type { TelegramWebhookResult } from '@zona-cero/contracts';

import { isFamilyReunificationCommand } from './family-helpers';
import { handleTelegramLanguageCommand, resolveTelegramLocale } from './locale';
import { createTelegramTelemetryEvent, emitChannelTelemetry } from './telemetry';
import { resolveTelegramCommand } from './telegram-update';
import type { TelegramTelemetryOptions, TelegramUpdateLike } from './types';

export function handleTelegramWebhookUpdate(
  update: TelegramUpdateLike,
  options: TelegramTelemetryOptions = {},
): TelegramWebhookResult {
  const command = resolveTelegramCommand(update);
  if (command) {
    emitChannelTelemetry(
      options.telemetry,
      createTelegramTelemetryEvent({
        scope: 'telegram.command',
        action: command,
        result: 'accepted',
      }),
    );
  }

  const locale = resolveTelegramLocale(update);
  const languageResult = handleTelegramLanguageCommand(update);
  if (languageResult) return languageResult;

  if (command === '/start') {
    return {
      accepted: true,
      command,
      responseText: formatMessage(locale, 'telegram.start.ready'),
    };
  }

  if (command === '/sos') {
    return {
      accepted: true,
      command,
      responseText: formatMessage(locale, 'telegram.sos.command'),
    };
  }

  if (isFamilyReunificationCommand(command)) {
    return {
      accepted: true,
      command,
      responseText: formatMessage(locale, 'telegram.family.command'),
    };
  }

  return {
    accepted: true,
    command,
    responseText: formatMessage(locale, 'telegram.default.received'),
  };
}

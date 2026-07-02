import { formatMessage, resolveLocaleFromCandidates, type SupportedLocale } from '@zona-cero/i18n';
import type { TelegramWebhookResult } from '@zona-cero/contracts';

import { isRecord } from './parsing';
import { resolveTelegramCommand, readCommandArgument } from './telegram-update';
import type { TelegramUpdateLike } from './types';

export function resolveTelegramLocale(update: TelegramUpdateLike, preferredLocale?: string | null): SupportedLocale {
  return resolveLocaleFromCandidates([preferredLocale, inferTelegramLocaleFromText(update.message?.text), update.message?.from?.language_code]);
}

function inferTelegramLocaleFromText(text: string | null | undefined): SupportedLocale | null {
  const normalized = text?.trim().toLowerCase() ?? '';
  if (!normalized) return null;

  if (/\b(tengo|d[oó]nde|necesitan|necesito|necesitamos|busco|quiero|reportar|ayuda|medicamentos|agua potable|comida|mantas)\b/.test(normalized)) {
    return 'es';
  }

  if (/\b(i have|where|needed|need|looking for|searching for|available|surplus|medicine|water|food|blankets)\b/.test(normalized)) {
    return 'en';
  }

  return null;
}

function localeName(locale: SupportedLocale, displayLocale: SupportedLocale): string {
  return formatMessage(displayLocale, `locale.${locale}`);
}

export function getPreferredLocaleFromState(state: unknown): SupportedLocale | undefined {
  return isRecord(state) && (state.preferredLocale === 'es' || state.preferredLocale === 'en') ? state.preferredLocale : undefined;
}

export function withPreferredLocale<TState extends object>(state: TState, locale: SupportedLocale): TState & { preferredLocale: SupportedLocale } {
  return { ...state, preferredLocale: locale };
}

type TelegramLanguageCommandResult = TelegramWebhookResult & { locale: SupportedLocale };

export function handleTelegramLanguageCommand(update: TelegramUpdateLike, currentLocale?: SupportedLocale): TelegramLanguageCommandResult | null {
  const command = resolveTelegramCommand(update);
  if (command !== '/idioma' && command !== '/language') return null;

  const requestedLocale = readCommandArgument(update);
  if (!requestedLocale) {
    const locale = resolveTelegramLocale(update, currentLocale);
    return { accepted: true, command, locale, responseText: formatMessage(locale, 'telegram.language.choose') };
  }

  const locale = resolveLocaleFromCandidates([requestedLocale, currentLocale, update.message?.from?.language_code]);
  return {
    accepted: true,
    command,
    locale,
    responseText: formatMessage(locale, 'telegram.language.changed', { localeName: localeName(locale, locale) }),
  };
}

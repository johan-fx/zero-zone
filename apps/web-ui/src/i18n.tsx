import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { formatMessage, resolveLocaleFromCandidates, supportedLocales, type MessageId, type MessageValues, type SupportedLocale } from '@zona-cero/i18n';

const storageKey = 'zona-cero-locale';

type I18nContextValue = {
  locale: SupportedLocale;
  setLocale(locale: SupportedLocale): void;
  t(id: WebMessageId, values?: MessageValues): string;
};

const localCatalogs = {
  es: {
    'web.trust.title': 'Confianza contextual',
    'web.trust.loading': 'Comprobando señales de confianza…',
    'web.trust.unavailable': 'Aún no hay señales de confianza contextual para este elemento. Trata esta información como no verificada.',
    'web.trust.status.label': 'Estado',
    'web.trust.visibility.label': 'Visibilidad',
    'web.trust.score.label': 'Puntuación del servidor',
    'web.trust.signals.label': 'Señales',
    'web.trust.disputes.label': 'Disputas',
    'web.trust.explanation.empty': 'El servidor todavía no publicó explicación.',
    'web.trust.action.corroborate': 'Corroborar',
    'web.trust.action.dispute': 'Disputar',
    'web.trust.action.loading': 'Enviando…',
    'web.trust.action.corroborated': 'Señal enviada. El servidor recalculó la confianza contextual.',
    'web.trust.action.disputed': 'Disputa enviada. El servidor recalculó la confianza contextual.',
    'web.trust.status.self_declared': 'Autodeclarado',
    'web.trust.status.field_attested': 'Confirmado en terreno',
    'web.trust.status.trusted_by_context': 'Confiable por contexto',
    'web.trust.status.disputed': 'Disputado',
    'web.trust.status.degraded': 'Degradado',
    'web.trust.status.pending_corroboration': 'Pendiente de corroborar',
    'web.trust.visibility.normal': 'Normal',
    'web.trust.visibility.elevated': 'Elevada',
    'web.trust.visibility.limited': 'Limitada',
    'web.trust.visibility.blocked': 'Bloqueada',
  },
  en: {
    'web.trust.title': 'Contextual trust',
    'web.trust.loading': 'Checking trust signals…',
    'web.trust.unavailable': 'No contextual trust signals are available for this item yet. Treat this information as unverified.',
    'web.trust.status.label': 'Status',
    'web.trust.visibility.label': 'Visibility',
    'web.trust.score.label': 'Server score',
    'web.trust.signals.label': 'Signals',
    'web.trust.disputes.label': 'Disputes',
    'web.trust.explanation.empty': 'The server has not published an explanation yet.',
    'web.trust.action.corroborate': 'Corroborate',
    'web.trust.action.dispute': 'Dispute',
    'web.trust.action.loading': 'Sending…',
    'web.trust.action.corroborated': 'Signal sent. The server recalculated contextual trust.',
    'web.trust.action.disputed': 'Dispute sent. The server recalculated contextual trust.',
    'web.trust.status.self_declared': 'Self-declared',
    'web.trust.status.field_attested': 'Field attested',
    'web.trust.status.trusted_by_context': 'Trusted by context',
    'web.trust.status.disputed': 'Disputed',
    'web.trust.status.degraded': 'Degraded',
    'web.trust.status.pending_corroboration': 'Pending corroboration',
    'web.trust.visibility.normal': 'Normal',
    'web.trust.visibility.elevated': 'Elevated',
    'web.trust.visibility.limited': 'Limited',
    'web.trust.visibility.blocked': 'Blocked',
  },
} as const;

type LocalMessageId = keyof typeof localCatalogs.es;
type WebMessageId = MessageId | LocalMessageId;

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => resolveInitialLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
    window.localStorage.setItem(storageKey, locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale(locale: SupportedLocale) {
      setLocaleState(locale);
    },
    t(id: WebMessageId, values?: MessageValues) {
      if (id in localCatalogs.es) {
        return interpolateLocalMessage(localCatalogs[locale][id as LocalMessageId], values);
      }
      return formatMessage(locale, id as MessageId, values);
    },
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function interpolateLocalMessage(message: string, values: MessageValues = {}): string {
  return message.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ''));
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="language-selector">
      {t('locale.selector.label')}
      <select value={locale} onChange={(event) => setLocale(event.currentTarget.value as SupportedLocale)}>
        {supportedLocales.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>{t(`locale.${supportedLocale}`)}</option>
        ))}
      </select>
    </label>
  );
}

function resolveInitialLocale(): SupportedLocale {
  const params = new URLSearchParams(window.location.search);
  return resolveLocaleFromCandidates([
    params.get('lang'),
    params.get('locale'),
    window.localStorage.getItem(storageKey),
  ]);
}

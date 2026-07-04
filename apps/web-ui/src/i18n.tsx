import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { formatMessage, resolveLocaleFromCandidates, supportedLocales, type MessageId, type MessageValues, type SupportedLocale } from '@zona-cero/i18n';

const storageKey = 'zona-cero-locale';

type I18nContextValue = {
  locale: SupportedLocale;
  setLocale(locale: SupportedLocale): void;
  t(id: MessageId, values?: MessageValues): string;
};

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
    t(id: MessageId, values?: MessageValues) {
      return formatMessage(locale, id, values);
    },
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
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

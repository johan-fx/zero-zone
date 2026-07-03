import { useEffect, useState } from 'react';

export type AppThemeOverride = 'auto' | 'day' | 'night';
export type AppThemeMode = 'day' | 'night';
export type DocumentThemeName = 'light' | 'dark';

export const themeOverrideStorageKey = 'zc-theme-mode';

export function resolveAutomaticThemeMode(date: Date = new Date()): AppThemeMode {
  const hour = date.getHours();
  return hour >= 7 && hour < 20 ? 'day' : 'night';
}

export function resolveThemeMode(override: AppThemeOverride, date: Date = new Date()): AppThemeMode {
  return override === 'auto' ? resolveAutomaticThemeMode(date) : override;
}

export function millisecondsUntilNextThemeBoundary(date: Date = new Date()): number {
  const nextBoundary = new Date(date);

  if (date.getHours() < 7) {
    nextBoundary.setHours(7, 0, 0, 0);
  } else if (date.getHours() < 20) {
    nextBoundary.setHours(20, 0, 0, 0);
  } else {
    nextBoundary.setDate(nextBoundary.getDate() + 1);
    nextBoundary.setHours(7, 0, 0, 0);
  }

  return Math.max(nextBoundary.getTime() - date.getTime(), 0);
}

export function toDocumentThemeName(mode: AppThemeMode): DocumentThemeName {
  return mode === 'day' ? 'light' : 'dark';
}

function getLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function readStoredThemeOverride(storage?: Storage): AppThemeOverride {
  try {
    const stored = (storage ?? getLocalStorage())?.getItem(themeOverrideStorageKey);
    return stored === 'day' || stored === 'night' || stored === 'auto' ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

function persistThemeOverride(override: AppThemeOverride, storage?: Storage): void {
  try {
    (storage ?? getLocalStorage())?.setItem(themeOverrideStorageKey, override);
  } catch {
    // Ignore unavailable storage; theme still works for this session.
  }
}

export function useAppThemeMode() {
  const [override, setOverrideState] = useState<AppThemeOverride>(() => readStoredThemeOverride());
  const [now, setNow] = useState(() => new Date());
  const resolvedMode = resolveThemeMode(override, now);

  useEffect(() => {
    persistThemeOverride(override);
  }, [override]);

  useEffect(() => {
    if (override !== 'auto') return;
    const timeout = window.setTimeout(
      () => setNow(new Date()),
      millisecondsUntilNextThemeBoundary(now) + 10,
    );
    return () => window.clearTimeout(timeout);
  }, [now, override]);

  useEffect(() => {
    const documentTheme = toDocumentThemeName(resolvedMode);
    document.documentElement.dataset.zcTheme = documentTheme;
    document.documentElement.dataset.zcThemeMode = override;
    return () => {
      if (document.documentElement.dataset.zcTheme === documentTheme) {
        delete document.documentElement.dataset.zcTheme;
      }
      if (document.documentElement.dataset.zcThemeMode === override) {
        delete document.documentElement.dataset.zcThemeMode;
      }
    };
  }, [override, resolvedMode]);

  function setOverride(nextOverride: AppThemeOverride) {
    setNow(new Date());
    setOverrideState(nextOverride);
  }

  return { override, resolvedMode, setOverride };
}

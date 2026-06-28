import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { operationalThemePalettes, OperationalThemeName, ThemePreference } from './tokens';

type OperationalThemeContextValue = {
  preference: ThemePreference;
  setPreference: (nextPreference: ThemePreference) => void;
  themeName: OperationalThemeName;
  colors: (typeof operationalThemePalettes)[OperationalThemeName];
};

const OperationalThemeContext = createContext<OperationalThemeContextValue | null>(null);

export function resolveOperationalTheme(
  preference: ThemePreference,
  systemScheme: 'light' | 'dark' | 'unspecified' | null | undefined,
): OperationalThemeName {
  if (preference === 'day') {
    return 'light';
  }

  if (preference === 'night') {
    return 'dark';
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function OperationalThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const themeName = resolveOperationalTheme(preference, systemScheme);

  const value = useMemo<OperationalThemeContextValue>(
    () => ({
      preference,
      setPreference,
      themeName,
      colors: operationalThemePalettes[themeName],
    }),
    [preference, themeName],
  );

  return <OperationalThemeContext.Provider value={value}>{children}</OperationalThemeContext.Provider>;
}

export function useOperationalTheme() {
  const value = useContext(OperationalThemeContext);

  if (!value) {
    throw new Error('useOperationalTheme must be used within OperationalThemeProvider');
  }

  return value;
}

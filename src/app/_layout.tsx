import '../tamagui.generated.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TamaguiProvider, Theme } from 'tamagui';

import { OperationalThemeProvider, useOperationalTheme } from '@/shared/theme';
import { tamaguiConfig } from '../../tamagui.config';

function ThemedAppShell() {
  const { colors, themeName } = useOperationalTheme();

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={themeName} key={themeName}>
      <Theme name={themeName}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="index" options={{ title: 'Live operations' }} />
          <Stack.Screen name="design-system" options={{ title: 'Design system preview' }} />
          <Stack.Screen name="visual-audit" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
      </Theme>
    </TamaguiProvider>
  );
}

export default function RootLayout() {
  return (
    <OperationalThemeProvider>
      <ThemedAppShell />
    </OperationalThemeProvider>
  );
}

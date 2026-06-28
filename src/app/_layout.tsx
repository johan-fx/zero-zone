import '../tamagui.generated.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import { tamaguiConfig } from '../../tamagui.config';

const navigationColors = {
  light: {
    background: '#F6F8FB',
    surface: '#FFFFFF',
    text: '#0B1220',
  },
  dark: {
    background: '#07111F',
    surface: '#0D1B2A',
    text: '#F8FAFC',
  },
} as const;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const themeName = colorScheme === 'dark' ? 'dark' : 'light';
  const theme = navigationColors[themeName];

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={themeName}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.surface },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: theme.background },
        }}>
        <Stack.Screen name="index" options={{ title: 'Zona Cero' }} />
      </Stack>
      <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
    </TamaguiProvider>
  );
}

import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paragraph, Text, XStack, YStack } from 'tamagui';

import { LiveOperationalEntryScreen } from '@/features/operations/liveOperations';
import { createInMemoryLocalOperationDatabase } from '@/infrastructure/local-db/local-db';
import { ThemePreference, useOperationalTheme } from '@/shared/theme';
import { ActionButton, OperationalCard, StatusBadge } from '@/shared/ui';

const themeOptions: ThemePreference[] = ['system', 'day', 'night'];

export default function HomeScreen() {
  const router = useRouter();
  const database = useMemo(() => createInMemoryLocalOperationDatabase(), []);
  const { preference, setPreference, themeName } = useOperationalTheme();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <YStack bg="$background" grow={1}>
        <OperationalCard rounded={0} variant="default" px="$4" py="$3">
          <YStack gap="$3">
            <XStack items="center" justify="space-between">
              <YStack grow={1} gap="$1">
                <Text color="$text" fontSize={28} fontWeight="900">
                  Zona Cero
                </Text>
                <Paragraph color="$textMuted" fontSize={14} lineHeight={19}>
                  Live operational entry with local signed operations
                </Paragraph>
              </YStack>
              <StatusBadge tone={themeName === 'dark' ? 'info' : 'success'} label={`${themeName} theme`} />
            </XStack>

            <XStack flexWrap="wrap" gap="$2">
              {themeOptions.map((option) => (
                <ActionButton
                  key={option}
                  accessibilityLabel={`Set ${option} theme`}
                  label={option}
                  onPress={() => setPreference(option)}
                  size="$3"
                  testID={`theme-${option}`}
                  tone={preference === option ? 'primary' : 'info'}
                />
              ))}
            </XStack>

            <ActionButton testID="tamagui-smoke-button" accessibilityLabel="Tamagui smoke check" label="Tamagui smoke check" />
            <ActionButton
              testID="open-design-system"
              accessibilityLabel="Open design system"
              label="Open design system previews"
              onPress={() => router.push('/design-system')}
              tone="success"
            />
            <ActionButton
              testID="open-visual-audit"
              accessibilityLabel="Open visual audit"
              label="Open visual audit"
              onPress={() => router.push('/visual-audit')}
              tone="info"
            />
          </YStack>
        </OperationalCard>

        <LiveOperationalEntryScreen database={database} />
      </YStack>
    </SafeAreaView>
  );
}
